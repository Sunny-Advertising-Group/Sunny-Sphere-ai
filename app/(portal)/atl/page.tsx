import Link from "next/link";
import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { currentInstant, lookbackIsoDate } from "@/lib/digitalOpti";
import { PageHeader } from "@/components/ui";
import { AtlHub, type LinkRow } from "./AtlHub";

// Covers a full quarterly cadence period plus buffer, same as Digital Opti,
// so "is this link's checklist ticked for its current period" always has
// enough log history to check.
const LOG_LOOKBACK_DAYS = 100;

export default async function AtlPage() {
  const visibility = await getVisibility();
  if (!visibility || !visibility.canSee("atl")) redirect("/");

  const supabase = await createClient();
  const now = currentInstant();
  const [
    { data: clients },
    { data: rawLinks },
    { data: checklistLogs },
    { data: serviceTasks },
    { data: serviceTaskLogs },
    { data: loaLinks },
    { data: rawAssignees },
    { data: people },
  ] = await Promise.all([
    supabase.from("clients").select("id, name, colour, team, is_active").eq("on_atl", true).order("name"),
    supabase
      .from("atl_links")
      .select("id, client_id, kind, title, url, version_label, cadence, client:clients(name, colour)")
      .order("sort_order"),
    supabase
      .from("atl_checklist_logs")
      .select("atl_link_id, completed_at, voided_at")
      .gte("completed_at", lookbackIsoDate(LOG_LOOKBACK_DAYS, now)),
    supabase
      .from("atl_service_level_tasks")
      .select("id, client_id, title, cadence, assigned_to, sort_order")
      .order("client_id")
      .order("sort_order"),
    supabase
      .from("atl_service_level_logs")
      .select("task_id, completed_by, completed_at, voided_at, note")
      .gte("completed_at", lookbackIsoDate(LOG_LOOKBACK_DAYS, now)),
    supabase.from("resources").select("id, title, url").eq("section", "atl_loa_link").order("sort_order"),
    supabase.from("atl_client_assignees").select("client_id, profile_id"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  const peopleById = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));
  const assigneesByClient = new Map<number, { id: string; name: string }[]>();
  for (const a of rawAssignees ?? []) {
    const arr = assigneesByClient.get(a.client_id) ?? [];
    arr.push({ id: a.profile_id, name: peopleById.get(a.profile_id) ?? "Unknown" });
    assigneesByClient.set(a.client_id, arr);
  }

  const onAtlNames = new Set((clients ?? []).map((c) => c.name));
  const links: LinkRow[] = (rawLinks ?? [])
    .filter((l) => l.client && onAtlNames.has((l.client as unknown as { name: string }).name))
    .map((l) => ({
      id: l.id,
      client_id: l.client_id,
      kind: l.kind,
      title: l.title,
      url: l.url,
      version_label: l.version_label,
      cadence: l.cadence,
      client_name: (l.client as unknown as { name: string; colour: string | null }).name,
      client_colour: (l.client as unknown as { name: string; colour: string | null }).colour,
    }));

  return (
    <div>
      <PageHeader
        title="ATL"
        description="Flight plans, WIPs, rate cards, budgets, assets and reporting — checklist, by client, or by category."
        action={
          visibility.isAdmin ? (
            <Link
              href="/admin?section=clients"
              className="rounded-full border border-gold bg-gold px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gold/90"
            >
              Manage clients & links
            </Link>
          ) : undefined
        }
      />
      <AtlHub
        clients={clients ?? []}
        links={links}
        checklistLogs={checklistLogs ?? []}
        serviceTasks={serviceTasks ?? []}
        serviceTaskLogs={serviceTaskLogs ?? []}
        loaLinks={loaLinks ?? []}
        assigneesByClient={Object.fromEntries(assigneesByClient)}
        people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email }))}
        isAdmin={visibility.isAdmin}
        currentUserId={visibility.profile.id}
      />
    </div>
  );
}
