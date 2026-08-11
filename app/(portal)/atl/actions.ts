"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addClient(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const colour = String(formData.get("colour") ?? "").trim();
  const team = String(formData.get("team") ?? "ATL").trim();
  if (!name) return { error: "Client name is required." };

  const { error } = await supabase.from("clients").insert({
    name,
    colour: colour || null,
    team,
  });
  if (error) return { error: error.message };

  revalidatePath("/atl");
  return { success: true };
}

export async function updateClient(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const colour = String(formData.get("colour") ?? "").trim();
  const team = String(formData.get("team") ?? "ATL").trim();
  const isActive = formData.get("is_active") === "true";
  if (!id || !name) return { error: "Client name is required." };

  const { error } = await supabase
    .from("clients")
    .update({ name, colour: colour || null, team, is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteClient(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/admin");
  return { success: true };
}

export async function addAtlLink(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const clientId = Number(formData.get("client_id"));
  const kind = String(formData.get("kind") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const versionLabel = String(formData.get("version_label") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "").trim();

  if (!clientId || !kind || !title || !url || !cadence) {
    return { error: "Kind, title, URL and reporting cadence are required." };
  }

  const { error } = await supabase.from("atl_links").insert({
    client_id: clientId,
    kind,
    title,
    url,
    version_label: versionLabel || null,
    cadence,
  });
  if (error) return { error: error.message };

  revalidatePath(`/atl`);
  return { success: true };
}

export async function updateAtlLink(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const id = Number(formData.get("id"));
  const kind = String(formData.get("kind") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const versionLabel = String(formData.get("version_label") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "").trim();

  if (!id || !kind || !title || !url || !cadence) {
    return { error: "Kind, title, URL and reporting cadence are required." };
  }

  const { error } = await supabase
    .from("atl_links")
    .update({ kind, title, url, version_label: versionLabel || null, cadence })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteAtlLink(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("atl_links").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/admin");
  return { success: true };
}
