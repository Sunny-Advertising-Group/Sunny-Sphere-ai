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

  const { data: channel } = await supabase
    .from("digital_client_channels")
    .select("cadence")
    .eq("id", clientChannelId)
    .single();
  if (!channel) return { error: "Channel not found." };

  const start = periodStart(channel.cadence).toISOString();
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

// --- Admin: clients ---

export async function addDigitalClient(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const colour = String(formData.get("colour") ?? "").trim();
  const leadId = String(formData.get("lead_id") ?? "").trim();
  const retainerRaw = String(formData.get("retainer") ?? "").trim();
  const wipDocUrl = String(formData.get("wip_doc_url") ?? "").trim();
  const status = String(formData.get("status") ?? "active").trim();
  if (!name) return { error: "Client name is required." };

  const { error } = await supabase.from("digital_clients").insert({
    name,
    colour: colour || null,
    lead_id: leadId || null,
    retainer: retainerRaw ? Number(retainerRaw) : null,
    wip_doc_url: wipDocUrl || null,
    status,
  });
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateDigitalClient(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const colour = String(formData.get("colour") ?? "").trim();
  const leadId = String(formData.get("lead_id") ?? "").trim();
  const retainerRaw = String(formData.get("retainer") ?? "").trim();
  const wipDocUrl = String(formData.get("wip_doc_url") ?? "").trim();
  const status = String(formData.get("status") ?? "active").trim();
  if (!id || !name) return { error: "Client name is required." };

  const { error } = await supabase
    .from("digital_clients")
    .update({
      name,
      colour: colour || null,
      lead_id: leadId || null,
      retainer: retainerRaw ? Number(retainerRaw) : null,
      wip_doc_url: wipDocUrl || null,
      status,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteDigitalClient(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("digital_clients").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

// --- Admin: client channels ---

export async function addClientChannel(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const clientId = Number(formData.get("client_id"));
  const channel = String(formData.get("channel") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "").trim();
  if (!clientId || !channel || !cadence) return { error: "Channel and cadence are required." };

  const { error } = await supabase.from("digital_client_channels").insert({
    client_id: clientId,
    channel,
    cadence,
  });
  if (error) return { error: error.message };

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateClientChannel(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const id = Number(formData.get("id"));
  const cadence = String(formData.get("cadence") ?? "").trim();
  const isActive = formData.get("is_active") === "true";
  if (!id || !cadence) return { error: "Cadence is required." };

  const { error } = await supabase
    .from("digital_client_channels")
    .update({ cadence, is_active: isActive })
    .eq("id", id);
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
