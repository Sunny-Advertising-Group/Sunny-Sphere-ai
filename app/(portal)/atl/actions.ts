"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addClient(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const colour = String(formData.get("colour") ?? "").trim();
  if (!name) return { error: "Client name is required." };

  const { error } = await supabase.from("clients").insert({
    name,
    colour: colour || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/atl");
  return { success: true };
}

export async function addAtlLink(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const clientId = Number(formData.get("client_id"));
  const kind = String(formData.get("kind") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const versionLabel = String(formData.get("version_label") ?? "").trim();

  if (!clientId || !kind || !title || !url) {
    return { error: "Kind, title and URL are required." };
  }

  const { error } = await supabase.from("atl_links").insert({
    client_id: clientId,
    kind,
    title,
    url,
    version_label: versionLabel || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/atl`);
  return { success: true };
}
