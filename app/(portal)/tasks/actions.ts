"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORY_COLOR, type CategoryColorKey, type TaskLink } from "@/lib/tasks";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// --- Categories (columns on a profile's own board) ---

export async function createCategory(title: string, color: CategoryColorKey = DEFAULT_CATEGORY_COLOR) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const trimmed = title.trim();
  if (!trimmed) return { error: "Give the category a title." };

  const { data: existing } = await supabase
    .from("task_categories")
    .select("position")
    .eq("owner_id", user.id)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("task_categories")
    .insert({ owner_id: user.id, title: trimmed, color, position: nextPosition })
    .select("id, owner_id, title, color, position, is_system, created_at")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true, category: data };
}

export async function renameCategory(id: number, title: string) {
  const { supabase } = await requireUser();
  const trimmed = title.trim();
  if (!trimmed) return { error: "Title can't be empty." };

  const { error } = await supabase.from("task_categories").update({ title: trimmed }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function recolorCategory(id: number, color: CategoryColorKey) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("task_categories").update({ color }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function deleteCategory(id: number) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("task_categories").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function moveCategory(id: number, direction: "left" | "right") {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const { data: categories } = await supabase
    .from("task_categories")
    .select("id, position, is_system")
    .eq("owner_id", user.id)
    .eq("is_system", false)
    .order("position", { ascending: true });
  if (!categories) return { error: "Board not found." };

  const index = categories.findIndex((c) => c.id === id);
  const swapWith = direction === "left" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= categories.length) return { success: true };

  const a = categories[index];
  const b = categories[swapWith];
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("task_categories").update({ position: b.position }).eq("id", a.id),
    supabase.from("task_categories").update({ position: a.position }).eq("id", b.id),
  ]);
  if (e1 || e2) return { error: (e1 ?? e2)?.message };

  revalidatePath("/tasks");
  return { success: true };
}

// --- Tasks ---

export type CreateTaskInput = {
  categoryId: number;
  assigneeId?: string | null;
  title: string;
  description?: string;
  dueDate?: string | null;
  links?: TaskLink[];
};

export async function createTask(input: CreateTaskInput) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const title = input.title.trim();
  if (!title) return { error: "Give the task a title." };

  let categoryId = input.categoryId;

  // Tagging someone else: the task goes on *their* board, in their reserved
  // "Tagged Tasks" category — not the category the composer was opened from.
  if (input.assigneeId && input.assigneeId !== user.id) {
    const { data: taggedCategory, error: lookupError } = await supabase
      .from("task_categories")
      .select("id")
      .eq("owner_id", input.assigneeId)
      .eq("is_system", true)
      .single();
    if (lookupError || !taggedCategory) return { error: "Couldn't find that person's board." };
    categoryId = taggedCategory.id;
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      category_id: categoryId,
      title,
      description: input.description?.trim() || null,
      due_date: input.dueDate || null,
      links: input.links ?? [],
      created_by: user.id,
      assigned_by: input.assigneeId && input.assigneeId !== user.id ? user.id : null,
    })
    .select("id, category_id, title, description, due_date, links, created_by, assigned_by, position, completed_at, created_at")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true, task: data };
}

export async function updateTask(
  id: number,
  fields: { title?: string; description?: string | null; dueDate?: string | null; links?: TaskLink[] },
) {
  const { supabase } = await requireUser();
  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined) {
    const trimmed = fields.title.trim();
    if (!trimmed) return { error: "Title can't be empty." };
    patch.title = trimmed;
  }
  if (fields.description !== undefined) patch.description = fields.description?.trim() || null;
  if (fields.dueDate !== undefined) patch.due_date = fields.dueDate || null;
  if (fields.links !== undefined) patch.links = fields.links;

  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function completeTask(id: number) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tasks").update({ completed_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function uncompleteTask(id: number) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tasks").update({ completed_at: null }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function deleteTask(id: number) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function moveTaskToCategory(id: number, categoryId: number) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tasks").update({ category_id: categoryId }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}
