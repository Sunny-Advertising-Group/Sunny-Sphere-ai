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

  const [{ data: clients }, { data: channels }, { data: logs }, { data: settings }] = await Promise.all([
    supabase
      .from("digital_clients")
      .select("id, name, colour, retainer, wip_doc_url, status, lead:profiles(full_name, email)")
      .neq("status", "archived")
      .order("name"),
    supabase
      .from("digital_client_channels")
      .select("id, client_id, channel, cadence, is_active")
      .eq("is_active", true),
    supabase
      .from("digital_opti_logs")
      .select("id, client_channel_id, completed_at, voided_at")
      .gte("completed_at", lookbackIso),
    supabase.from("digital_opti_settings").select("schedule_label").eq("id", 1).single(),
  ]);

  const clientInputs = (clients ?? []).map((client) => {
    const lead = client.lead as unknown as { full_name: string | null; email: string } | null;
    return {
      id: client.id,
      name: client.name,
      colour: client.colour,
      retainer: client.retainer,
      wipDocUrl: client.wip_doc_url,
      status: client.status,
      leadName: lead?.full_name || lead?.email || null,
    };
  });

  const board = buildDigitalOptiBoardData(clientInputs, channels ?? [], logs ?? [], now);

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
      />
    </div>
  );
}
