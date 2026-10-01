"use server";

import { revalidatePath } from "next/cache";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CADENCE_OPTIONS, CHANNEL_ORDER, CLIENT_STATUS_OPTIONS, periodStart } from "@/lib/digitalOpti";

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

// Unlike a brand-new client, a tactical goes live straight away — it hangs
// off a client that's already been approved, so there's nothing for an admin
// to vet. Like saveDigitalClient, this checks Digital section access itself
// and then writes with the service-role client (RLS only lets a submitter
// insert a pending row, and only admins can create channel rows).
export async function submitDigitalTactical(_prevState: unknown, formData: FormData) {
  const visibility = await getVisibility();
  if (!visibility || !visibility.canSee("digital_opti")) return { error: "You don't have access to Digital." };

  const name = String(formData.get("name") ?? "").trim();
  const parentClientId = Number(formData.get("parent_client_id") ?? "");
  if (!name) return { error: "Tactical name is required." };
  if (!parentClientId) return { error: "Choose which client this tactical belongs to." };

  const includedInParentRetainer = formData.get("retainer_type") === "included";
  const retainerRaw = String(formData.get("retainer") ?? "").trim();
  if (!includedInParentRetainer && !retainerRaw) {
    return { error: "Enter the extra retainer amount, or mark it as included in the current retainer." };
  }
  const retainer = includedInParentRetainer ? null : Number(retainerRaw);
  if (retainer != null && (!Number.isFinite(retainer) || retainer < 0)) {
    return { error: "Retainer must be a positive number." };
  }
  const channels = [...new Set(formData.getAll("channels").map(String).filter(Boolean))];
  if (channels.some((c) => !CHANNEL_ORDER.includes(c))) return { error: "Invalid channel." };

  const supabase = createAdminClient();

  // Inherit the parent's tier/cadence so the tactical sits in the same
  // optimisation rotation and reads correctly nested under it on the board.
  const { data: parent } = await supabase
    .from("clients")
    .select("digital_tier_id, digital_cadence, parent_client_id, on_digital, approval_status")
    .eq("id", parentClientId)
    .single();
  if (!parent || !parent.on_digital || parent.approval_status !== "approved" || parent.parent_client_id != null) {
    return { error: "Parent client not found." };
  }

  const now = new Date().toISOString();
  const { data: tactical, error } = await supabase
    .from("clients")
    .insert({
      name,
      parent_client_id: parentClientId,
      team: "Digital",
      on_atl: false,
      on_digital: true,
      is_active: true,
      digital_status: "set_up",
      digital_cadence: parent.digital_cadence ?? "weekly",
      digital_tier_id: parent.digital_tier_id,
      retainer,
      included_in_parent_retainer: includedInParentRetainer,
      requested_channels: channels.length > 0 ? channels : null,
      approval_status: "approved",
      submitted_by: visibility.profile.id,
      reviewed_by: visibility.profile.id,
      reviewed_at: now,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (channels.length > 0) {
    const { error: channelError } = await supabase
      .from("digital_client_channels")
      .insert(channels.map((channel) => ({ client_id: tactical.id, channel })));
    if (channelError) return { error: `Tactical added, but channels failed: ${channelError.message}` };
  }

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}

// --- Self-serve: the board's "Edit client" popup. Anyone with the Digital
// section can edit a live client and it applies straight away, so this
// checks section access itself and then writes with the service-role client
// (the underlying tables' RLS only lets admins write). Only the fields the
// popup owns are ever touched — never approval/ATL fields.

export type DigitalClientEdit = {
  name: string;
  // Parent client when this is a sub-client / tactical; null = top-level.
  parentId: number | null;
  tierId: number | null;
  cadence: string;
  status: string;
  retainer: number | null;
  includedInParentRetainer: boolean;
  wipDocUrl: string | null;
  endDate: string | null;
  // The full desired state: these channels active, each with these owners.
  channels: { channel: string; ownerIds: string[] }[];
  owners: { profileId: string; splitPct: number }[];
};

export async function saveDigitalClient(clientId: number, edit: DigitalClientEdit) {
  const visibility = await getVisibility();
  if (!visibility || !visibility.canSee("digital_opti")) return { error: "You don't have access to Digital." };

  const name = edit.name.trim();
  if (!name) return { error: "Client name is required." };
  if (!CADENCE_OPTIONS.some((c) => c.value === edit.cadence)) return { error: "Invalid cadence." };
  if (!CLIENT_STATUS_OPTIONS.some((s) => s.value === edit.status)) return { error: "Invalid status." };
  if (edit.retainer != null && (!Number.isFinite(edit.retainer) || edit.retainer < 0)) {
    return { error: "Retainer must be a positive number." };
  }
  if (edit.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(edit.endDate)) return { error: "Invalid end date." };
  if (edit.channels.some((c) => !CHANNEL_ORDER.includes(c.channel))) return { error: "Invalid channel." };
  if (edit.owners.some((o) => !o.profileId || !Number.isFinite(o.splitPct) || o.splitPct < 0 || o.splitPct > 100)) {
    return { error: "Each split needs a person and a percentage between 0 and 100." };
  }
  if (new Set(edit.owners.map((o) => o.profileId)).size !== edit.owners.length) {
    return { error: "The same person is listed twice in the retainer split." };
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, parent_client_id, on_digital, approval_status")
    .eq("id", clientId)
    .single();
  if (!client || !client.on_digital || client.approval_status !== "approved") return { error: "Client not found." };

  if (edit.parentId != null) {
    if (edit.parentId === clientId) return { error: "A client can't be its own sub-client." };
    const [{ data: parent }, { count: childCount }] = await Promise.all([
      supabase
        .from("clients")
        .select("id, parent_client_id, on_digital, approval_status")
        .eq("id", edit.parentId)
        .single(),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("parent_client_id", clientId),
    ]);
    if (!parent || !parent.on_digital || parent.approval_status !== "approved" || parent.parent_client_id != null) {
      return { error: "Choose a top-level Digital client as the parent." };
    }
    if ((childCount ?? 0) > 0) return { error: "This client has its own sub-clients, so it can't be nested." };
  }

  const isTactical = edit.parentId != null;
  const included = isTactical && edit.includedInParentRetainer;
  const { error: clientError } = await supabase
    .from("clients")
    .update({
      name,
      parent_client_id: edit.parentId,
      digital_tier_id: edit.tierId,
      digital_cadence: edit.cadence,
      digital_status: edit.status,
      retainer: included ? null : edit.retainer,
      included_in_parent_retainer: included,
      wip_doc_url: edit.wipDocUrl?.trim() || null,
      end_date: edit.endDate || null,
    })
    .eq("id", clientId);
  if (clientError) return { error: clientError.message };

  // Channels: a dropped channel is deactivated rather than deleted, so its
  // tick history (digital_opti_logs) survives and re-adding it later just
  // reactivates the same row — same as the Admin page's channel toggle.
  const { data: existingChannels, error: chError } = await supabase
    .from("digital_client_channels")
    .select("id, channel, is_active, owners:digital_channel_owners(id, profile_id)")
    .eq("client_id", clientId);
  if (chError) return { error: chError.message };

  const wanted = new Map(edit.channels.map((c) => [c.channel, new Set(c.ownerIds)]));
  for (const row of existingChannels ?? []) {
    if (!wanted.has(row.channel) && row.is_active) {
      const { error } = await supabase.from("digital_client_channels").update({ is_active: false }).eq("id", row.id);
      if (error) return { error: error.message };
    }
  }
  for (const [channel, ownerIds] of wanted) {
    let row = (existingChannels ?? []).find((r) => r.channel === channel);
    if (!row) {
      const { data, error } = await supabase
        .from("digital_client_channels")
        .insert({ client_id: clientId, channel })
        .select("id, channel, is_active")
        .single();
      if (error) return { error: error.message };
      row = { ...data, owners: [] };
    } else if (!row.is_active) {
      const { error } = await supabase.from("digital_client_channels").update({ is_active: true }).eq("id", row.id);
      if (error) return { error: error.message };
    }

    const current = row.owners ?? [];
    const toRemove = current.filter((o) => !ownerIds.has(o.profile_id)).map((o) => o.id);
    const toAdd = [...ownerIds].filter((id) => !current.some((o) => o.profile_id === id));
    if (toRemove.length > 0) {
      const { error } = await supabase.from("digital_channel_owners").delete().in("id", toRemove);
      if (error) return { error: error.message };
    }
    if (toAdd.length > 0) {
      const { error } = await supabase
        .from("digital_channel_owners")
        .insert(toAdd.map((profile_id) => ({ client_channel_id: row.id, profile_id })));
      if (error) return { error: error.message };
    }
  }

  // Retainer split (drives lead/second and the Team split table).
  const { data: existingOwners, error: ownersError } = await supabase
    .from("digital_client_owners")
    .select("id, profile_id, split_pct")
    .eq("client_id", clientId);
  if (ownersError) return { error: ownersError.message };

  const removedOwnerIds = (existingOwners ?? [])
    .filter((o) => !edit.owners.some((w) => w.profileId === o.profile_id))
    .map((o) => o.id);
  if (removedOwnerIds.length > 0) {
    const { error } = await supabase.from("digital_client_owners").delete().in("id", removedOwnerIds);
    if (error) return { error: error.message };
  }
  for (const owner of edit.owners) {
    const existing = (existingOwners ?? []).find((o) => o.profile_id === owner.profileId);
    const { error } = existing
      ? Number(existing.split_pct) === owner.splitPct
        ? { error: null }
        : await supabase.from("digital_client_owners").update({ split_pct: owner.splitPct }).eq("id", existing.id)
      : await supabase
          .from("digital_client_owners")
          .insert({ client_id: clientId, profile_id: owner.profileId, split_pct: owner.splitPct });
    if (error) return { error: error.message };
  }

  revalidatePath("/digital-opti");
  revalidatePath("/admin");
  return { success: true };
}
