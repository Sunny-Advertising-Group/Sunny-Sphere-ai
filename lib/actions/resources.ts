"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addResource(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { error: "Admins only." };

  const section = String(formData.get("section") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!section || !title) return { error: "Section and title are required." };

  // Dashboard quick links are meant to be a short, current-at-a-glance
  // list — capped so it can't quietly grow into another Important docs.
  if (section === "dashboard_link") {
    const { count } = await supabase.from("resources").select("id", { count: "exact", head: true }).eq("section", "dashboard_link");
    if ((count ?? 0) >= 5) return { error: "Quick links are capped at 5 — delete one first to add another." };
  }

  const moduleCount = formData.get("module_count");

  const { error } = await supabase.from("resources").insert({
    section,
    group_name: String(formData.get("group_name") ?? "").trim() || null,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    resource_type: String(formData.get("resource_type") ?? "").trim() || null,
    url: String(formData.get("url") ?? "").trim() || null,
    duration: String(formData.get("duration") ?? "").trim() || null,
    module_count: moduleCount ? Number(moduleCount) : null,
    body: String(formData.get("body") ?? "").trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/agency");
  revalidatePath("/learning");
  revalidatePath("/");
  return { success: true };
}

export async function updateResource(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { error: "Admins only." };

  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  if (!id || !title) return { error: "Title is required." };

  const moduleCount = formData.get("module_count");

  const { error } = await supabase
    .from("resources")
    .update({
      group_name: String(formData.get("group_name") ?? "").trim() || null,
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      resource_type: String(formData.get("resource_type") ?? "").trim() || null,
      url: String(formData.get("url") ?? "").trim() || null,
      duration: String(formData.get("duration") ?? "").trim() || null,
      module_count: moduleCount ? Number(moduleCount) : null,
      body: String(formData.get("body") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/agency");
  revalidatePath("/learning");
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function deleteResource(id: number) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { error: "Admins only." };

  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/agency");
  revalidatePath("/learning");
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function setLearningProgress(resourceId: number, modulesDone: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("learning_progress")
    .upsert({ user_id: user.id, resource_id: resourceId, modules_done: modulesDone });

  revalidatePath("/learning");
}
