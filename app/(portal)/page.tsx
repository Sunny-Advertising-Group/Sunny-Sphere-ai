import Link from "next/link";
import { Bell, ExternalLink, FileText, Link2, Sun } from "lucide-react";
import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { Card, Pill } from "@/components/ui";
import { GlobalSearch } from "@/components/GlobalSearch";
import { currentInstant, lookbackIsoDate } from "@/lib/digitalOpti";
import { buildOutstandingItems, type AtlTaskInput, type DigitalTaskInput } from "@/lib/dashboardTasks";

const LOG_LOOKBACK_DAYS = 100;

export default async function DashboardPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");
  const { profile, isAdmin } = visibility;

  const supabase = await createClient();
  const now = currentInstant();

  const [
    { count: publishedTools },
    { count: myRequests },
    { data: dashboardDocs },
    { data: dashboardNotifications },
    { data: dashboardLinks },
  ] = await Promise.all([
    supabase.from("tools").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("ai_requests").select("id", { count: "exact", head: true }).eq("submitted_by", profile.id),
    supabase
      .from("resources")
      .select("id, title, description, url, resource_type")
      .eq("section", "dashboard_doc")
      .order("sort_order"),
    supabase
      .from("resources")
      .select("id, title, body")
      .eq("section", "dashboard_notification")
      .order("sort_order"),
    supabase.from("resources").select("id, title, url").eq("section", "dashboard_link").order("sort_order"),
  ]);

  let pendingTools = 0;
  let openTickets = 0;
  let newAiRequests = 0;
  if (isAdmin) {
    const [{ count: pt }, { count: ot }, { count: nar }] = await Promise.all([
      supabase.from("tools").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("ai_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);
    pendingTools = pt ?? 0;
    openTickets = ot ?? 0;
    newAiRequests = nar ?? 0;
  }

  // "Your outstanding & upcoming" — ATL links and Digital channels assigned
  // to this specific person (not a team-wide view). RLS already scopes
  // atl_client_assignees/digital_client_assignees rows to has_section, so
  // these simply come back empty for someone without ATL/Digital access.
  const [{ data: atlAssignedRows }, { data: digitalOwnedChannelRows }, { data: digitalAssignedRows }] = await Promise.all([
    supabase.from("atl_client_assignees").select("client_id").eq("profile_id", profile.id),
    // "Lead" is derived from channel ownership now, not a plain client field —
    // see buildDigitalOptiBoardData in lib/digitalOpti.ts.
    supabase
      .from("digital_channel_owners")
      .select("channel:digital_client_channels(client_id)")
      .eq("profile_id", profile.id),
    supabase.from("digital_client_assignees").select("client_id").eq("profile_id", profile.id),
  ]);

  const atlClientIds = Array.from(new Set((atlAssignedRows ?? []).map((r) => r.client_id)));
  const digitalClientIds = Array.from(
    new Set([
      ...(digitalOwnedChannelRows ?? [])
        .map((r) => (r.channel as unknown as { client_id: number } | null)?.client_id)
        .filter((id): id is number => id != null),
      ...(digitalAssignedRows ?? []).map((r) => r.client_id),
    ]),
  );

  const [{ data: atlLinkRows }, { data: digitalChannelRows }] = await Promise.all([
    atlClientIds.length > 0
      ? supabase
          .from("atl_links")
          .select("title, cadence, drive_modified_at, client:clients(name)")
          .in("client_id", atlClientIds)
      : Promise.resolve({ data: [] as { title: string; cadence: string | null; drive_modified_at: string | null; client: unknown }[] }),
    digitalClientIds.length > 0
      ? supabase
          .from("digital_client_channels")
          .select("id, channel, client:clients(name, digital_cadence)")
          .in("client_id", digitalClientIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as { id: number; channel: string; client: unknown }[] }),
  ]);

  const digitalChannelIds = (digitalChannelRows ?? []).map((c) => c.id);
  const { data: digitalLogRows } =
    digitalChannelIds.length > 0
      ? await supabase
          .from("digital_opti_logs")
          .select("client_channel_id, completed_at, voided_at")
          .in("client_channel_id", digitalChannelIds)
          .gte("completed_at", lookbackIsoDate(LOG_LOOKBACK_DAYS, now))
      : { data: [] as { client_channel_id: number; completed_at: string; voided_at: string | null }[] };

  const logsByChannel = new Map<number, { completed_at: string; voided_at: string | null }[]>();
  for (const log of digitalLogRows ?? []) {
    const arr = logsByChannel.get(log.client_channel_id) ?? [];
    arr.push({ completed_at: log.completed_at, voided_at: log.voided_at });
    logsByChannel.set(log.client_channel_id, arr);
  }

  const atlInputs: AtlTaskInput[] = (atlLinkRows ?? []).map((l) => ({
    clientName: (l.client as unknown as { name: string } | null)?.name ?? "Unknown",
    title: l.title,
    cadence: l.cadence,
    driveModifiedAt: l.drive_modified_at,
  }));

  const digitalInputs: DigitalTaskInput[] = (digitalChannelRows ?? []).map((ch) => {
    const client = ch.client as unknown as { name: string; digital_cadence: string } | null;
    return {
      clientName: client?.name ?? "Unknown",
      channel: ch.channel,
      cadence: client?.digital_cadence ?? "weekly",
      logs: logsByChannel.get(ch.id) ?? [],
    };
  });

  const taskItems = buildOutstandingItems(atlInputs, digitalInputs, now);

  const tiles = [
    {
      href: "/tools",
      label: "Tools",
      value: publishedTools ?? 0,
      hint: "published tools",
      show: true,
    },
    {
      href: "/could-this-be-aid",
      label: "Could this be AI'd?",
      value: myRequests ?? 0,
      hint: "your submissions",
      show: true,
    },
  ];

  return (
    <div>
      <div className="border-b border-border-c bg-white px-8 py-10">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-ink">
          Welcome back, {profile.full_name?.split(" ")[0] || profile.email.split("@")[0]}
          <Sun className="h-7 w-7 text-gold" strokeWidth={2} aria-hidden />
        </h1>
        <p className="mt-1 text-sm text-charcoal">Here&rsquo;s what&rsquo;s happening in Sunny Sphere.</p>
        <div className="mt-4">
          <GlobalSearch />
        </div>
      </div>

      {dashboardNotifications && dashboardNotifications.length > 0 && (
        <div className="space-y-2 px-8 pt-8">
          {dashboardNotifications.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
              <Bell className="mt-0.5 h-4 w-4 flex-none text-gold" strokeWidth={2} aria-hidden />
              <div>
                <div className="font-semibold text-ink">{n.title}</div>
                {n.body && <p className="mt-0.5 text-sm text-charcoal">{n.body}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {dashboardLinks && dashboardLinks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-8 pt-6">
          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-charcoal">
            <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Quick links
          </span>
          {dashboardLinks.map((link) =>
            link.url ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border-c bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-gold/50"
              >
                {link.title}
              </a>
            ) : null,
          )}
        </div>
      )}

      {dashboardDocs && dashboardDocs.length > 0 && (
        <div className="px-8 pt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <FileText className="h-4 w-4 text-gold" strokeWidth={2} aria-hidden /> Important docs
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dashboardDocs.map((doc) =>
              doc.url ? (
                <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer">
                  <Card className="h-full transition-colors hover:border-gold/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-ink">{doc.title}</div>
                      <ExternalLink className="h-3.5 w-3.5 flex-none text-charcoal" strokeWidth={2} aria-hidden />
                    </div>
                    {doc.description && <p className="mt-1 text-sm text-charcoal">{doc.description}</p>}
                  </Card>
                </a>
              ) : (
                <Card key={doc.id}>
                  <div className="font-semibold text-ink">{doc.title}</div>
                  {doc.description && <p className="mt-1 text-sm text-charcoal">{doc.description}</p>}
                </Card>
              ),
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2">
        {tiles
          .filter((t) => t.show)
          .map((tile) => (
            <Link key={tile.href} href={tile.href}>
              <Card className="transition-colors hover:border-gold/50">
                <div className="text-xs font-semibold uppercase tracking-wide text-gold">{tile.label}</div>
                <div className="mt-3 text-3xl font-extrabold text-ink">{tile.value}</div>
                <div className="mt-1 text-xs text-charcoal">{tile.hint}</div>
              </Card>
            </Link>
          ))}
      </div>

      {taskItems.length > 0 && (
        <div className="px-8 pb-8">
          <h2 className="mb-3 text-sm font-bold text-ink">Your outstanding & upcoming</h2>
          <div className="space-y-2">
            {taskItems.map((item, i) => (
              <Link key={i} href={item.href}>
                <Card className="flex items-center justify-between gap-4 transition-colors hover:border-gold/50">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">
                      {item.kind === "atl" ? "ATL" : "Digital"} · {item.clientName}
                    </div>
                    <div className="font-medium text-ink">{item.itemLabel}</div>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    {item.dueDate && (
                      <span className="text-xs text-charcoal">
                        Due{" "}
                        {new Date(item.dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        item.status === "outstanding" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {item.status === "outstanding" ? "Outstanding" : "Upcoming"}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="px-8 pb-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-bold text-ink">Admin queue</h2>
            <Pill tone="gold">Admin</Pill>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link href="/admin">
              <Card className="transition-colors hover:border-gold/50">
                <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">Tools pending review</div>
                <div className="mt-3 text-3xl font-extrabold text-ink">{pendingTools}</div>
              </Card>
            </Link>
            <Link href="/admin">
              <Card className="transition-colors hover:border-gold/50">
                <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">New AI&rsquo;d requests</div>
                <div className="mt-3 text-3xl font-extrabold text-ink">{newAiRequests}</div>
              </Card>
            </Link>
            <Link href="/admin">
              <Card className="transition-colors hover:border-gold/50">
                <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">Open support tickets</div>
                <div className="mt-3 text-3xl font-extrabold text-ink">{openTickets}</div>
              </Card>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
