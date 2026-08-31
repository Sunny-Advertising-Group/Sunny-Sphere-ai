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
  clientId?: number | null;
};

export async function createTask(input: CreateTaskInput) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const title = input.title.trim();
  if (!title) return { error: "Give the task a title." };

  const tagged = !!input.assigneeId && input.assigneeId !== user.id;

  // The task always stays in the column it was added to — tagging someone
  // only sets assigned_to so it also surfaces on their Tagged Tasks line
  // (see groupTasksByCategory), it doesn't move the row anywhere.
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      category_id: input.categoryId,
      title,
      description: input.description?.trim() || null,
      due_date: input.dueDate || null,
      links: input.links ?? [],
      client_id: input.clientId ?? null,
      created_by: user.id,
      assigned_to: tagged ? input.assigneeId : null,
      assigned_by: tagged ? user.id : null,
    })
    .select(
      "id, category_id, title, description, due_date, links, client_id, created_by, assigned_to, assigned_by, position, completed_at, created_at",
    )
    .single();
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true, task: data };
}

export async function updateTask(
  id: number,
  fields: {
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    links?: TaskLink[];
    clientId?: number | null;
    assigneeId?: string | null;
  },
) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined) {
    const trimmed = fields.title.trim();
    if (!trimmed) return { error: "Title can't be empty." };
    patch.title = trimmed;
  }
  if (fields.description !== undefined) patch.description = fields.description?.trim() || null;
  if (fields.dueDate !== undefined) patch.due_date = fields.dueDate || null;
  if (fields.links !== undefined) patch.links = fields.links;
  if (fields.clientId !== undefined) patch.client_id = fields.clientId;
  if (fields.assigneeId !== undefined) {
    const tagged = !!fields.assigneeId && fields.assigneeId !== user.id;
    patch.assigned_to = tagged ? fields.assigneeId : null;
    patch.assigned_by = tagged ? user.id : null;
  }

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

// --- Checklist items (subtasks within a task, each with its own optional due date) ---

export async function addChecklistItem(taskId: number, title: string, dueDate?: string | null) {
  const { supabase } = await requireUser();
  const trimmed = title.trim();
  if (!trimmed) return { error: "Give the checklist item a title." };

  const { data: existing } = await supabase
    .from("task_checklist_items")
    .select("position")
    .eq("task_id", taskId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("task_checklist_items")
    .insert({ task_id: taskId, title: trimmed, due_date: dueDate || null, position: nextPosition })
    .select("id, task_id, title, due_date, completed, position, created_at")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true, item: data };
}

export async function toggleChecklistItem(id: number, completed: boolean) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("task_checklist_items").update({ completed }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function updateChecklistItem(id: number, fields: { title?: string; dueDate?: string | null }) {
  const { supabase } = await requireUser();
  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined) {
    const trimmed = fields.title.trim();
    if (!trimmed) return { error: "Title can't be empty." };
    patch.title = trimmed;
  }
  if (fields.dueDate !== undefined) patch.due_date = fields.dueDate || null;

  const { error } = await supabase.from("task_checklist_items").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function deleteChecklistItem(id: number) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("task_checklist_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

// --- Board sharing (who besides me can view my board) ---

export async function grantBoardAccess(viewerId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };
  if (viewerId === user.id) return { error: "You already see your own board." };

  const { error } = await supabase.from("task_board_access").insert({ owner_id: user.id, viewer_id: viewerId });
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function revokeBoardAccess(viewerId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("task_board_access")
    .delete()
    .eq("owner_id", user.id)
    .eq("viewer_id", viewerId);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}
