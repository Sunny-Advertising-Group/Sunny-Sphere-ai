import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { buildDigitalOptiBoardData, currentInstant, lookbackIsoDate } from "@/lib/digitalOpti";
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

  const [
    { data: clients, error: clientsError },
    { data: channels, error: channelsError },
    { data: logs, error: logsError },
    { data: settings },
    { data: tiers },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, colour, retainer, wip_doc_url, digital_status, digital_cadence, lead:profiles!clients_account_lead_id_fkey(full_name, email), tier:client_tiers(id, name, colour, sort_order)",
      )
      .eq("on_digital", true)
      .neq("digital_status", "archived")
      .order("name"),
    supabase
      .from("digital_client_channels")
      .select("id, client_id, channel, is_active")
      .eq("is_active", true),
    supabase
      .from("digital_opti_logs")
      .select("id, client_channel_id, completed_at, voided_at")
      .gte("completed_at", lookbackIso),
    supabase.from("digital_opti_settings").select("schedule_label").eq("id", 1).single(),
    supabase.from("client_tiers").select("id, name, colour, sort_order").order("sort_order"),
  ]);

  if (clientsError) console.error("[digital-opti] clients query failed:", clientsError);
  if (channelsError) console.error("[digital-opti] channels query failed:", channelsError);
  if (logsError) console.error("[digital-opti] logs query failed:", logsError);

  const clientInputs = (clients ?? []).map((client) => {
    const lead = client.lead as unknown as { full_name: string | null; email: string } | null;
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
      leadName: lead?.full_name || lead?.email || null,
      tier,
    };
  });

  const board = buildDigitalOptiBoardData(clientInputs, channels ?? [], logs ?? [], now);
  const tierOptions = (tiers ?? []).map((t) => ({ id: t.id, name: t.name, colour: t.colour, sortOrder: t.sort_order }));

  return (
    <div>
      <PageHeader
        title="Digital Opti Tracking"
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
      />
    </div>
  );
}
