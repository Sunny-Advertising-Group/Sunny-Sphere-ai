"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// `clients` is the single shared roster for both ATL and Digital — a client
// can be on either, both, or neither (on_atl/on_digital), with shared fields
// (name, colour, WIP link) living once and each team's own fields (ATL: team/
// is_active; Digital: retainer/status/cadence/lead) alongside them.
const CLIENT_SELECT =
  "id, name, colour, team, is_active, on_atl, on_digital, wip_doc_url, retainer, digital_status, digital_cadence, account_lead_id";

function clientFieldsFromForm(formData: FormData) {
  const retainerRaw = String(formData.get("retainer") ?? "").trim();
  const digitalStatus = String(formData.get("digital_status") ?? "").trim();
  const digitalCadence = String(formData.get("digital_cadence") ?? "").trim();
  const accountLeadId = String(formData.get("account_lead_id") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    colour: String(formData.get("colour") ?? "").trim() || null,
    team: String(formData.get("team") ?? "ATL").trim(),
    on_atl: formData.get("on_atl") === "true",
    on_digital: formData.get("on_digital") === "true",
    wip_doc_url: String(formData.get("wip_doc_url") ?? "").trim() || null,
    retainer: retainerRaw ? Number(retainerRaw) : null,
    digital_status: digitalStatus || null,
    digital_cadence: digitalCadence || null,
    account_lead_id: accountLeadId || null,
  };
}

export async function addClient(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const fields = clientFieldsFromForm(formData);
  if (!fields.name) return { error: "Client name is required." };

  const { data, error } = await supabase.from("clients").insert(fields).select(CLIENT_SELECT).single();
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/digital-opti");
  return { success: true, client: data };
}

export async function updateClient(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const id = Number(formData.get("id"));
  const fields = clientFieldsFromForm(formData);
  const isActive = formData.get("is_active") === "true";
  if (!id || !fields.name) return { error: "Client name is required." };

  const { data, error } = await supabase
    .from("clients")
    .update({ ...fields, is_active: isActive })
    .eq("id", id)
    .select(CLIENT_SELECT)
    .single();
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true, client: data };
}

export async function addClientAssignee(clientId: number, profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("atl_client_assignees").insert({ client_id: clientId, profile_id: profileId });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function removeClientAssignee(clientId: number, profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("atl_client_assignees")
    .delete()
    .eq("client_id", clientId)
    .eq("profile_id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
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

  const { data, error } = await supabase
    .from("atl_links")
    .insert({
      client_id: clientId,
      kind,
      title,
      url,
      version_label: versionLabel || null,
      cadence,
    })
    .select("id, client_id, kind, title, url, version_label, cadence")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/atl`);
  return { success: true, link: data };
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
