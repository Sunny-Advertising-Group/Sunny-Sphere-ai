"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { periodStart } from "@/lib/digitalOpti";
import { AUDIO_STAGES } from "@/lib/audio";
import { serviceLevelCadence } from "@/lib/atl";

// `clients` is the single shared roster for both ATL and Digital — a client
// can be on either, both, or neither (on_atl/on_digital), with shared fields
// (name, colour, WIP link) living once and each team's own fields (ATL: team/
// is_active; Digital: retainer/status/cadence/lead) alongside them.
const CLIENT_SELECT =
  "id, name, colour, team, is_active, on_atl, on_digital, wip_doc_url, retainer, atl_revenue, digital_status, digital_cadence, digital_tier_id, account_lead_id";

function clientFieldsFromForm(formData: FormData) {
  const retainerRaw = String(formData.get("retainer") ?? "").trim();
  const atlRevenueRaw = String(formData.get("atl_revenue") ?? "").trim();
  const digitalStatus = String(formData.get("digital_status") ?? "").trim();
  const digitalCadence = String(formData.get("digital_cadence") ?? "").trim();
  const accountLeadId = String(formData.get("account_lead_id") ?? "").trim();
  const digitalTierIdRaw = String(formData.get("digital_tier_id") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    colour: String(formData.get("colour") ?? "").trim() || null,
    team: String(formData.get("team") ?? "ATL").trim(),
    on_atl: formData.get("on_atl") === "true",
    on_digital: formData.get("on_digital") === "true",
    wip_doc_url: String(formData.get("wip_doc_url") ?? "").trim() || null,
    retainer: retainerRaw ? Number(retainerRaw) : null,
    atl_revenue: atlRevenueRaw ? Number(atlRevenueRaw) : null,
    digital_status: digitalStatus || null,
    digital_cadence: digitalCadence || null,
    digital_tier_id: digitalTierIdRaw ? Number(digitalTierIdRaw) : null,
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

// Monthly/quarterly bulk update of just the two figures admins actually need
// to revisit on a cadence — retainer and ATL revenue — via the CSV round-trip
// in ClientsManager (download, edit in Excel/Sheets, re-upload). Only ever
// touches these two columns per row, scoped by id, so a stale or partial
// re-upload can't clobber anything else about a client.
export async function bulkUpdateFinancials(
  updates: { id: number; retainer: number | null; atl_revenue: number | null }[],
) {
  if (updates.length === 0) return { error: "No rows to update." };

  const supabase = await createClient();
  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from("clients")
        .update({ retainer: u.retainer, atl_revenue: u.atl_revenue })
        .eq("id", u.id),
    ),
  );
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    return { error: `${failed.length} of ${updates.length} row(s) failed: ${failed[0].error!.message}` };
  }

  revalidatePath("/atl");
  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true, updated: updates.length };
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

// --- Admin: ATL revenue split (who's credited for this client's ATL
// revenue, and what share) — the ATL counterpart to Digital's
// digital_client_owners / retainer split. ---

export async function addAtlClientOwner(clientId: number, profileId: string, splitPct: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atl_client_owners")
    .insert({ client_id: clientId, profile_id: profileId, split_pct: splitPct })
    .select("id, client_id, profile_id, split_pct")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/admin");
  return { success: true, owner: data };
}

export async function updateAtlClientOwnerSplit(ownerId: number, splitPct: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("atl_client_owners").update({ split_pct: splitPct }).eq("id", ownerId);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/admin");
  return { success: true };
}

export async function removeAtlClientOwner(ownerId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("atl_client_owners").delete().eq("id", ownerId);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/admin");
  return { success: true };
}

export type PendingAssignmentKind =
  | "atl_assignee"
  | "digital_assignee"
  | "digital_owner"
  | "digital_channel_owner"
  | "atl_owner";

// Pre-assigns a client to someone who hasn't signed up yet, by email. When a
// profile is later created with a matching email (handle_new_user()), it's
// applied straight into the real assignment table (atl_client_assignees,
// digital_client_assignees, digital_client_owners or digital_channel_owners)
// and this row is cleared — see the pending_client_assignments migration.
export async function addPendingAssignee(
  clientId: number,
  email: string,
  kind: PendingAssignmentKind,
  extra?: { channel?: string; splitPct?: number },
) {
  const supabase = await createClient();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Give an email address." };

  const { data, error } = await supabase
    .from("pending_client_assignments")
    .insert({
      client_id: clientId,
      email: trimmed,
      kind,
      channel: extra?.channel ?? null,
      split_pct: extra?.splitPct ?? null,
    })
    .select("id, email, client_id, kind, channel, split_pct")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true, pending: data };
}

export async function removePendingAssignee(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("pending_client_assignments").delete().eq("id", id);
  if (error) return { error: error.message };

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

// --- Checklist: ticking an ATL link off for its current cadence period ---

export async function logAtlChecklist(atlLinkId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: link } = await supabase.from("atl_links").select("cadence").eq("id", atlLinkId).single();
  if (!link?.cadence) return { error: "Link not found." };

  const start = periodStart(link.cadence).toISOString();
  const { data: existing } = await supabase
    .from("atl_checklist_logs")
    .select("id")
    .eq("atl_link_id", atlLinkId)
    .is("voided_at", null)
    .gte("completed_at", start)
    .limit(1);
  if (existing && existing.length > 0) return { success: true };

  const { error } = await supabase.from("atl_checklist_logs").insert({
    atl_link_id: atlLinkId,
    completed_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/atl");
  return { success: true };
}

// --- Audio production tracker (Lincoln Place and any other ATL client that
// runs radio/audio spots split by estate) ---

const AUDIO_SELECT =
  "id, client_id, estate, title, tag, messaging, placement, station, voice, duration, script_url, audio_url, live_date, end_date, status, key_number, notes, sort_order";

const AUDIO_STATUS_KEYS = new Set<string>(AUDIO_STAGES.map((s) => s.key));

function audioFieldsFromForm(formData: FormData) {
  const status = String(formData.get("status") ?? "briefed").trim();
  return {
    estate: String(formData.get("estate") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    tag: String(formData.get("tag") ?? "").trim() || null,
    messaging: String(formData.get("messaging") ?? "").trim() || null,
    placement: String(formData.get("placement") ?? "").trim() || null,
    station: String(formData.get("station") ?? "").trim() || null,
    voice: String(formData.get("voice") ?? "").trim() || null,
    duration: String(formData.get("duration") ?? "").trim() || null,
    script_url: String(formData.get("script_url") ?? "").trim() || null,
    audio_url: String(formData.get("audio_url") ?? "").trim() || null,
    live_date: String(formData.get("live_date") ?? "").trim() || null,
    end_date: String(formData.get("end_date") ?? "").trim() || null,
    status: AUDIO_STATUS_KEYS.has(status) ? status : "briefed",
    key_number: String(formData.get("key_number") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function addAudioItem(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const clientId = Number(formData.get("client_id"));
  const fields = audioFieldsFromForm(formData);
  if (!clientId || !fields.estate || !fields.title) {
    return { error: "Estate and audio title are required." };
  }

  const { data, error } = await supabase
    .from("atl_audio_items")
    .insert({ client_id: clientId, ...fields })
    .select(AUDIO_SELECT)
    .single();
  if (error) return { error: error.message };

  // The tracker lives on the client detail page (/atl/[client]), not /atl
  // itself — revalidating just "/atl" left that page's cached RSC payload
  // stale until a hard refresh forced a fresh fetch.
  revalidatePath("/atl");
  revalidatePath("/atl/[client]", "page");
  return { success: true, item: data };
}

export async function updateAudioItem(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const id = Number(formData.get("id"));
  const fields = audioFieldsFromForm(formData);
  if (!id || !fields.estate || !fields.title) {
    return { error: "Estate and audio title are required." };
  }

  const { data, error } = await supabase
    .from("atl_audio_items")
    .update(fields)
    .eq("id", id)
    .select(AUDIO_SELECT)
    .single();
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/atl/[client]", "page");
  return { success: true, item: data };
}

export async function updateAudioItemStatus(id: number, status: string) {
  if (!AUDIO_STATUS_KEYS.has(status)) return { error: "Unknown status." };

  const supabase = await createClient();
  const { error } = await supabase.from("atl_audio_items").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/atl/[client]", "page");
  return { success: true };
}

export async function deleteAudioItem(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("atl_audio_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/atl/[client]", "page");
  return { success: true };
}

export async function unlogAtlChecklist(atlLinkId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: link } = await supabase.from("atl_links").select("cadence").eq("id", atlLinkId).single();
  if (!link?.cadence) return { error: "Link not found." };

  const start = periodStart(link.cadence).toISOString();
  const { error } = await supabase
    .from("atl_checklist_logs")
    .update({ voided_at: new Date().toISOString(), voided_by: user.id })
    .eq("atl_link_id", atlLinkId)
    .is("voided_at", null)
    .gte("completed_at", start);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  return { success: true };
}

// --- Service level: ticking one of the three fixed client obligations
// (call/face_to_face/proactive) off for its current cadence period, with a
// short note captured on every tick ---

export async function logAtlServiceLevel(clientId: number, kind: string, note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const cadence = serviceLevelCadence(kind);
  const start = periodStart(cadence).toISOString();
  const { data: existing } = await supabase
    .from("atl_service_level_logs")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", kind)
    .is("voided_at", null)
    .gte("completed_at", start)
    .limit(1);
  if (existing && existing.length > 0) return { success: true };

  const { error } = await supabase.from("atl_service_level_logs").insert({
    client_id: clientId,
    kind,
    completed_by: user.id,
    note: note.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/atl");
  return { success: true };
}

export async function unlogAtlServiceLevel(clientId: number, kind: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const cadence = serviceLevelCadence(kind);
  const start = periodStart(cadence).toISOString();
  const { error } = await supabase
    .from("atl_service_level_logs")
    .update({ voided_at: new Date().toISOString(), voided_by: user.id })
    .eq("client_id", clientId)
    .eq("kind", kind)
    .is("voided_at", null)
    .gte("completed_at", start);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  return { success: true };
}

// --- Admin: service level audit log (verify / deny a tick) ---

export async function voidServiceLevelLog(logId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("atl_service_level_logs")
    .update({ voided_at: new Date().toISOString(), voided_by: user.id })
    .eq("id", logId);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/admin");
  return { success: true };
}

export async function restoreServiceLevelLog(logId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("atl_service_level_logs")
    .update({ voided_at: null, voided_by: null })
    .eq("id", logId);
  if (error) return { error: error.message };

  revalidatePath("/atl");
  revalidatePath("/admin");
  return { success: true };
}
