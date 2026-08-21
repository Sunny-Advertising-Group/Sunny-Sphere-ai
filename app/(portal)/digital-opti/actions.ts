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

// --- Admin: per-channel owners (who works this channel, and their share of
// its retainer credit — the client's displayed "lead" is derived from this,
// not stored directly) ---

export async function addChannelOwner(clientChannelId: number, profileId: string, splitPct: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("digital_channel_owners")
    .insert({ client_channel_id: clientChannelId, profile_id: profileId, split_pct: splitPct })
    .select("id, client_channel_id, profile_id, split_pct")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true, owner: data };
}

export async function updateChannelOwnerSplit(ownerId: number, splitPct: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("digital_channel_owners").update({ split_pct: splitPct }).eq("id", ownerId);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function removeChannelOwner(ownerId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("digital_channel_owners").delete().eq("id", ownerId);
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
