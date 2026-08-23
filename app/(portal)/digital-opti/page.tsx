import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import {
  buildDigitalOptiBoardData,
  currentInstant,
  currentWeekCommencing,
  lookbackIsoDate,
  SCHEDULED_TIER_NAMES,
} from "@/lib/digitalOpti";
import { DigitalOptiBoard } from "./DigitalOptiBoard";

// Covers a full quarterly cadence period plus buffer, so "is this channel
// done for its current period" always has enough log history to check.
const LOG_LOOKBACK_DAYS = 100;

export default async function DigitalOptiPage() {
  const visibility = await getVisibility();
  if (!visibility || !visibility.canSee("digital_opti")) redirect("/");

  const supabase = await createClient();
  const now = currentInstant();
  const lookbackIso = lookbackIsoDate(LOG_LOOKBACK_DAYS, now);
  const weekCommencingIso = currentWeekCommencing(now).toISOString().slice(0, 10);

  const [
    { data: clients, error: clientsError },
    { data: channels, error: channelsError },
    { data: logs, error: logsError },
    { data: settings },
    { data: tiers },
    { data: scheduleRow },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, colour, retainer, wip_doc_url, digital_status, digital_cadence, tier:client_tiers(id, name, colour, sort_order)",
      )
      .eq("on_digital", true)
      .neq("digital_status", "archived")
      .order("name"),
    supabase
      .from("digital_client_channels")
      .select("id, client_id, channel, is_active, owners:digital_channel_owners(profile_id, split_pct, profile:profiles(full_name, email))")
      .eq("is_active", true),
    supabase
      .from("digital_opti_logs")
      .select("id, client_channel_id, completed_at, voided_at")
      .gte("completed_at", lookbackIso),
    supabase.from("digital_opti_settings").select("schedule_label").eq("id", 1).single(),
    supabase.from("client_tiers").select("id, name, colour, sort_order").order("sort_order"),
    supabase.from("digital_opti_schedule").select("tier_ids").eq("week_commencing", weekCommencingIso).maybeSingle(),
  ]);

  if (clientsError) console.error("[digital-opti] clients query failed:", clientsError);
  if (channelsError) console.error("[digital-opti] channels query failed:", channelsError);
  if (logsError) console.error("[digital-opti] logs query failed:", logsError);

  const clientInputs = (clients ?? []).map((client) => {
    const rawTier = client.tier as unknown as { id: number; name: string; colour: string; sort_order: number } | null;
    const tier = rawTier ? { id: rawTier.id, name: rawTier.name, colour: rawTier.colour, sortOrder: rawTier.sort_order } : null;
    return {
      id: client.id,
      name: client.name,
      colour: client.colour,
      retainer: client.retainer,
      wipDocUrl: client.wip_doc_url,
      status: client.digital_status ?? "active",
      cadence: client.digital_cadence ?? "weekly",
      tier,
    };
  });

  const channelInputs = (channels ?? []).map((ch) => ({
    id: ch.id,
    client_id: ch.client_id,
    channel: ch.channel,
    owners: (ch.owners ?? []).map((o) => {
      const profile = o.profile as unknown as { full_name: string | null; email: string } | null;
      return {
        profileId: o.profile_id,
        name: profile?.full_name || profile?.email || "Unknown",
        splitPct: Number(o.split_pct),
      };
    }),
  }));

  const tierOptions = (tiers ?? []).map((t) => ({ id: t.id, name: t.name, colour: t.colour, sortOrder: t.sort_order }));
  const scheduledTierIds = tierOptions.filter((t) => SCHEDULED_TIER_NAMES.includes(t.name)).map((t) => t.id);
  const activeTierIds = (scheduleRow?.tier_ids as number[] | undefined) ?? null;

  const board = buildDigitalOptiBoardData(clientInputs, channelInputs, logs ?? [], now, scheduledTierIds, activeTierIds);

  return (
    <div>
      <PageHeader
        title="Digital"
        description="Optimisation cadence, this week's completion, and the audit log of every tick."
      />
      <DigitalOptiBoard
        clients={board.clientCards}
        completionPct={board.completionPct}
        totalDone={board.totalDone}
        totalActive={board.totalActive}
        lastUpdatedAt={board.lastUpdatedAt}
        teamSplit={board.teamSplit}
        scheduleLabel={settings?.schedule_label ?? null}
        isAdmin={visibility.isAdmin}
        tiers={tierOptions}
        myProfileId={visibility.profile.id}
      />
    </div>
  );
}
