"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { periodStart } from "@/lib/digitalOpti";

// --- Tracker: ticking a channel off ---

export async function logOpti(clientChannelId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Cadence lives on the client now (shared across every channel it runs),
  // not on the individual channel row.
  const { data: channel } = await supabase
    .from("digital_client_channels")
    .select("client:clients(digital_cadence)")
    .eq("id", clientChannelId)
    .single();
  const cadence = (channel?.client as unknown as { digital_cadence: string } | null)?.digital_cadence;
  if (!cadence) return { error: "Channel not found." };

  const start = periodStart(cadence).toISOString();
  const { data: existing } = await supabase
    .from("digital_opti_logs")
    .select("id")
    .eq("client_channel_id", clientChannelId)
    .is("voided_at", null)
    .gte("completed_at", start)
    .limit(1);
  if (existing && existing.length > 0) return { success: true };

  const { error } = await supabase.from("digital_opti_logs").insert({
    client_channel_id: clientChannelId,
    completed_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function unlogOpti(clientChannelId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: channel } = await supabase
    .from("digital_client_channels")
    .select("client:clients(digital_cadence)")
    .eq("id", clientChannelId)
    .single();
  const cadence = (channel?.client as unknown as { digital_cadence: string } | null)?.digital_cadence;
  if (!cadence) return { error: "Channel not found." };

  const start = periodStart(cadence).toISOString();
  const { error } = await supabase
    .from("digital_opti_logs")
    .update({ voided_at: new Date().toISOString(), voided_by: user.id })
    .eq("client_channel_id", clientChannelId)
    .is("voided_at", null)
    .gte("completed_at", start);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateScheduleLabel(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const label = String(formData.get("schedule_label") ?? "").trim();

  const { error } = await supabase
    .from("digital_opti_settings")
    .update({ schedule_label: label || null })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  return { success: true };
}

// --- Admin: audit log (verify / deny a tick) ---

export async function voidOptiLog(logId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("digital_opti_logs")
    .update({ voided_at: new Date().toISOString(), voided_by: user.id })
    .eq("id", logId);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function restoreOptiLog(logId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("digital_opti_logs")
    .update({ voided_at: null, voided_by: null })
    .eq("id", logId);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

// --- Admin: Digital-specific secondary assignees (the client's main "lead" is
// a plain field on `clients`, edited via atl/actions.ts's updateClient) ---

export async function addDigitalClientAssignee(clientId: number, profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("digital_client_assignees")
    .insert({ client_id: clientId, profile_id: profileId });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function removeDigitalClientAssignee(clientId: number, profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("digital_client_assignees")
    .delete()
    .eq("client_id", clientId)
    .eq("profile_id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

// --- Admin: client channels (which channels a client runs — cadence is set
// once on the client itself, not per channel) ---

export async function addClientChannel(clientId: number, channel: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("digital_client_channels")
    .insert({ client_id: clientId, channel })
    .select("id, client_id, channel, is_active")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true, channel: data };
}

export async function setClientChannelActive(id: number, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("digital_client_channels").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateClientWipUrl(clientId: number, url: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ wip_doc_url: url }).eq("id", clientId);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

// One-click pause/resume from the Admin Clients card, without having to open
// Edit and resubmit the whole client form — same underlying field
// (digital_status) the edit form's dropdown writes to.
export async function setClientDigitalStatus(clientId: number, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ digital_status: status }).eq("id", clientId);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

// --- Admin: per-channel owners (who's tagged as working this channel — no
// percentage; see the digital_client_owners actions below for the retainer
// split that actually drives the client's derived lead/second) ---

export async function addChannelOwner(clientChannelId: number, profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("digital_channel_owners")
    .insert({ client_channel_id: clientChannelId, profile_id: profileId })
    .select("id, client_channel_id, profile_id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true, owner: data };
}

export async function removeChannelOwner(ownerId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("digital_channel_owners").delete().eq("id", ownerId);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

// --- Admin: client-level retainer split (who's credited for this client's
// revenue, and what share — this is what derives the lead/second shown on
// the board and the Team split Retainer column) ---

export async function addClientOwner(clientId: number, profileId: string, splitPct: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("digital_client_owners")
    .insert({ client_id: clientId, profile_id: profileId, split_pct: splitPct })
    .select("id, client_id, profile_id, split_pct")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true, owner: data };
}

export async function updateClientOwnerSplit(ownerId: number, splitPct: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("digital_client_owners").update({ split_pct: splitPct }).eq("id", ownerId);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function removeClientOwner(ownerId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("digital_client_owners").delete().eq("id", ownerId);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteClientChannel(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("digital_client_channels").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

// --- Self-serve: anyone on the Digital tab can propose a new client or a
// "tactical" (a sub-client nested under an existing one). Both land as a
// pending clients row — invisible on the live board — until an admin
// approves it (lib/actions/admin.ts's approveDigitalClient/rejectDigitalClient).
// RLS (clients_insert_pending_digital) is the real gate here: it only ever
// allows inserting a row that's self-attributed and already 'pending'.

export async function submitDigitalClient(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Client name is required." };

  const retainerRaw = String(formData.get("retainer") ?? "").trim();
  const tierIdRaw = String(formData.get("digital_tier_id") ?? "").trim();
  const cadence = String(formData.get("digital_cadence") ?? "weekly").trim();
  const channels = formData.getAll("channels").map(String).filter(Boolean);

  const { error } = await supabase.from("clients").insert({
    name,
    team: "Digital",
    on_atl: false,
    on_digital: true,
    is_active: true,
    digital_status: "set_up",
    digital_cadence: cadence || "weekly",
    digital_tier_id: tierIdRaw ? Number(tierIdRaw) : null,
    retainer: retainerRaw ? Number(retainerRaw) : null,
    requested_channels: channels.length > 0 ? channels : null,
    approval_status: "pending",
    submitted_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function submitDigitalTactical(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const name = String(formData.get("name") ?? "").trim();
  const parentClientId = Number(formData.get("parent_client_id") ?? "");
  if (!name) return { error: "Tactical name is required." };
  if (!parentClientId) return { error: "Choose which client this tactical belongs to." };

  const includedInParentRetainer = formData.get("retainer_type") === "included";
  const retainerRaw = String(formData.get("retainer") ?? "").trim();
  if (!includedInParentRetainer && !retainerRaw) {
    return { error: "Enter the extra retainer amount, or mark it as included in the current retainer." };
  }
  const channels = formData.getAll("channels").map(String).filter(Boolean);

  // Inherit the parent's tier/cadence so the tactical sits in the same
  // optimisation rotation and reads correctly nested under it on the board.
  const { data: parent } = await supabase
    .from("clients")
    .select("digital_tier_id, digital_cadence")
    .eq("id", parentClientId)
    .single();
  if (!parent) return { error: "Parent client not found." };

  const { error } = await supabase.from("clients").insert({
    name,
    parent_client_id: parentClientId,
    team: "Digital",
    on_atl: false,
    on_digital: true,
    is_active: true,
    digital_status: "set_up",
    digital_cadence: parent.digital_cadence ?? "weekly",
    digital_tier_id: parent.digital_tier_id,
    retainer: includedInParentRetainer ? null : Number(retainerRaw),
    included_in_parent_retainer: includedInParentRetainer,
    requested_channels: channels.length > 0 ? channels : null,
    approval_status: "pending",
    submitted_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}
