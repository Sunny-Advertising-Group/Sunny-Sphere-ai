"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    file_path: filePath,
    owner_id: user.id,
    status: "pending",
  });

  if (error) return { error: error.message };

  revalidatePath("/tools");
  redirect("/tools");
}
