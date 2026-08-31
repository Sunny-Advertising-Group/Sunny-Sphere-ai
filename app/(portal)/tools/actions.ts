"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

// Anyone can add a new category inline from the upload form — the canonical
// list only needs admin approval to rename/delete (see lib/actions/admin.ts).
// Case-insensitive: reuses an existing category rather than creating a
// near-duplicate ("Research" vs "research").
export async function addToolCategory(name: string) {
  const supabase = await createClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Category name can't be empty." };

  const { data: existing } = await supabase
    .from("tool_categories")
    .select("id, name")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return { success: true, category: existing };

  const { data, error } = await supabase
    .from("tool_categories")
    .insert({ name: trimmed })
    .select("id, name")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/tools/upload");
  return { success: true, category: data };
}

export async function submitTool(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const toolType = String(formData.get("tool_type") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const howToUse = String(formData.get("how_to_use") ?? "").trim();
  const linkUrl = String(formData.get("link_url") ?? "").trim();
  const colourInput = String(formData.get("colour") ?? "").trim();
  const colour = HEX_COLOUR.test(colourInput) ? colourInput : null;
  const file = formData.get("file");

  if (!name || !toolType || !category || !description) {
    return { error: "Name, type, category and description are required." };
  }

  let filePath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const path = `${crypto.randomUUID()}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from("tools").upload(path, file);
    if (uploadError) return { error: `File upload failed: ${uploadError.message}` };
    filePath = path;
  }

  const { error } = await supabase.from("tools").insert({
    name,
    tool_type: toolType,
    category,
    description,
    how_to_use: howToUse || null,
    link_url: linkUrl || null,
    colour,
    file_path: filePath,
    owner_id: user.id,
    status: "pending",
  });

  if (error) return { error: error.message };

  revalidatePath("/tools");
  redirect("/tools");
}
