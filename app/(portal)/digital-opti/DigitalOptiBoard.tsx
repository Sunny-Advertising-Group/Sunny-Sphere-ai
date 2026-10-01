"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, CornerDownRight, Download, ExternalLink, Pencil } from "lucide-react";
import { Button, Card, EmptyState, Input, Pill } from "@/components/ui";
import {
  cadenceLabel,
  channelLabel,
  clientStatusMeta,
  currentWeekCommencing,
  initials,
  type ClientCardData,
  type TeamSplitRow,
  type TierInfo,
} from "@/lib/digitalOpti";
import { logOpti, unlogOpti, updateClientWipUrl } from "./actions";
import { AddClientModal, AddTacticalModal } from "./AddClientForms";
import { EditClientModal, type PersonOption } from "./EditClientModal";

export type { ClientCardData, TeamSplitRow };

export type PendingSubmission = { id: number; name: string; parent_client_id: number | null; approval_status: string };

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function formatWeekCommencing(): string {
  return currentWeekCommencing().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function formatEndDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Which slice of the client list the board shows. "week" is this week's
// opti rotation (the default); "all" is every live client regardless of
// rotation (for grabbing a WIP link, checking the split, etc); "not_optid"
// is every client — due this week or not — with at least one unticked
// channel, for the end-of-week check.
type ViewFilter = "week" | "all" | "not_optid";

const VIEW_FILTERS: { value: ViewFilter; label: string }[] = [
  { value: "week", label: "This week's opti" },
  { value: "all", label: "All clients" },
  { value: "not_optid", label: "Not opti'd" },
];

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildBoardCsv(rows: ClientCardData[]): string {
  const nameById = new Map(rows.map((c) => [c.id, c.name]));
  const header = [
    "Client",
    "Parent client",
    "Tier",
    "Status",
    "Cadence",
    "Due this week",
    "Retainer",
    "Included in parent retainer",
    "Lead",
    "Second",
    "Retainer split",
    "Channels",
    "Channels done",
    "Channels not done",
    "WIP link",
    "End date",
  ];
  const lines = rows.map((c) =>
    [
      c.name,
      c.parentId != null ? (nameById.get(c.parentId) ?? "") : "",
      c.tier?.name ?? "",
      clientStatusMeta(c.status).label,
      cadenceLabel(c.cadence),
      c.dueThisWeek ? "Yes" : "No",
      c.retainer ?? "",
      c.parentId != null ? (c.includedInParentRetainer ? "Yes" : "No") : "",
      c.leadName ?? "",
      c.secondName ?? "",
      c.effectiveOwners.map((o) => `${o.name} ${o.splitPct}%`).join("; "),
      c.channels
        .map((ch) => {
          const owners = ch.owners.map((o) => o.name).join(", ");
          return owners ? `${channelLabel(ch.channel)} (${owners})` : channelLabel(ch.channel);
        })
        .join("; "),
      c.channels.filter((ch) => ch.done).map((ch) => channelLabel(ch.channel)).join("; "),
      c.channels.filter((ch) => !ch.done).map((ch) => channelLabel(ch.channel)).join("; "),
      c.wipDocUrl ?? "",
      c.endDate ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...lines].join("\n");
}

function downloadCsv(filename: string, content: string) {
  // BOM so Excel opens it as UTF-8 (names with accents etc).
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatRelativeTime(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function LiveRelativeTime({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return <>{formatRelativeTime(iso, now)}</>;
}

export function DigitalOptiBoard({
  clients,
  completionPct,
  totalDone,
  totalActive,
  lastUpdatedAt,
  teamSplit,
  scheduleLabel,
  isAdmin,
  tiers,
  myProfileId,
  parentClientOptions,
  myPending,
  people,
}: {
  clients: ClientCardData[];
  completionPct: number;
  totalDone: number;
  totalActive: number;
  lastUpdatedAt: string | null;
  teamSplit: TeamSplitRow[];
  scheduleLabel: string | null;
  isAdmin: boolean;
  tiers: TierInfo[];
  myProfileId: string;
  parentClientOptions: { id: number; name: string }[];
  myPending: PendingSubmission[];
  people: PersonOption[];
}) {
  const [clientRows, setClientRows] = useState(clients);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("week");
  const [tierFilter, setTierFilter] = useState<number | "all">("all");
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [myClientsOnly, setMyClientsOnly] = useState(false);
  const [hidePaused, setHidePaused] = useState(false);
  const [addingClient, setAddingClient] = useState(false);
  const [addingTactical, setAddingTactical] = useState(false);
  const [collapsedParents, setCollapsedParents] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  function toggleParentCollapsed(clientId: number) {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  // Keep the board in sync after an edit popup save (router.refresh hands
  // down fresh server data).
  const [prevClients, setPrevClients] = useState(clients);
  if (prevClients !== clients) {
    setPrevClients(clients);
    setClientRows(clients);
  }

  // Not every client is due every week — by default the board shows only
  // clients whose tier is in this week's Black/Yellow/Blue rotation; the
  // other views widen it out.
  const viewRows = useMemo(() => {
    if (viewFilter === "week") return clientRows.filter((c) => c.dueThisWeek);
    if (viewFilter === "not_optid") return clientRows.filter((c) => c.channels.some((ch) => !ch.done));
    return clientRows;
  }, [clientRows, viewFilter]);
  const usedTiers = useMemo(
    () => tiers.filter((t) => viewRows.some((c) => c.tier?.id === t.id)),
    [tiers, viewRows],
  );
  const filteredRows = viewRows
    .filter((c) => tierFilter === "all" || c.tier?.id === tierFilter)
    .filter(
      (c) => !myClientsOnly || c.channels.some((ch) => ch.owners.some((o) => o.profileId === myProfileId)),
    )
    .filter((c) => !hidePaused || c.status !== "paused");

  // How many of a parent's tacticals are currently in view — drives the
  // collapse toggle and its count badge (only a parent with at least one
  // visible child gets one).
  const childCountByParent = useMemo(() => {
    const counts = new Map<number, number>();
    for (const row of filteredRows) {
      if (row.parentId == null) continue;
      counts.set(row.parentId, (counts.get(row.parentId) ?? 0) + 1);
    }
    return counts;
  }, [filteredRows]);

  const visibleRows = filteredRows.filter(
    (row) => row.parentId == null || !collapsedParents.has(row.parentId),
  );

  const editingClient = editingClientId != null ? clientRows.find((c) => c.id === editingClientId) : undefined;

  function exportCsv(scope: "week" | "all") {
    const rows = scope === "week" ? clientRows.filter((c) => c.dueThisWeek) : clientRows;
    const weekIso = currentWeekCommencing().toISOString().slice(0, 10);
    downloadCsv(`digital-opti-${scope === "week" ? "this-week" : "all-clients"}-${weekIso}.csv`, buildBoardCsv(rows));
    setExportOpen(false);
  }

  function setWipUrl(clientId: number, url: string | null) {
    setClientRows((prev) => prev.map((c) => (c.id !== clientId ? c : { ...c, wipDocUrl: url })));
  }

  function setChannelDone(clientId: number, channelId: number, done: boolean) {
    setClientRows((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const channels = c.channels.map((ch) => (ch.id === channelId ? { ...ch, done } : ch));
        return { ...c, channels, allDone: channels.length > 0 && channels.every((ch) => ch.done) };
      }),
    );
  }

  function tick(clientId: number, channelId: number) {
    setChannelDone(clientId, channelId, true);
    startTransition(async () => {
      const result = await logOpti(channelId);
      if ((result as { error?: string })?.error) setChannelDone(clientId, channelId, false);
    });
  }

  function untick(clientId: number, channelId: number) {
    setChannelDone(clientId, channelId, false);
    startTransition(async () => {
      const result = await unlogOpti(channelId);
      if ((result as { error?: string })?.error) setChannelDone(clientId, channelId, true);
    });
  }

  return (
    <div className="space-y-4 p-8">
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Week commencing" value={formatWeekCommencing()} />
          <StatTile label="Schedule" value={scheduleLabel ?? "—"} />
          <Card className="p-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal">
              Optimisation completion
            </div>
            <div className="mt-0.5 text-base font-extrabold text-ink">{completionPct}%</div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/5">
              <div className="h-full rounded-full bg-gold" style={{ width: `${completionPct}%` }} />
            </div>
            <div className="mt-1 text-[10px] text-charcoal">
              {totalDone} of {totalActive} due this period
            </div>
          </Card>
          <Card className="p-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal">Last updated</div>
            <div className="mt-0.5 text-xs font-bold text-ink">
              {lastUpdatedAt ? <LiveRelativeTime iso={lastUpdatedAt} /> : "No optis logged yet"}
            </div>
          </Card>
        </div>

        {teamSplit.length > 0 && (
          <details className="rounded-2xl border border-border-c bg-white">
            <summary className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide text-charcoal">
              Team split
            </summary>
            <table className="w-full border-t border-border-c text-sm">
              <thead>
                <tr className="border-b border-border-c text-left text-xs uppercase text-charcoal">
                  <th className="px-4 py-2">Lead</th>
                  <th className="px-4 py-2">Clients</th>
                  <th className="px-4 py-2">Retainer</th>
                  <th className="px-4 py-2">Channels</th>
                </tr>
              </thead>
              <tbody>
                {teamSplit.map((row) => (
                  <tr key={row.lead} className="border-b border-border-c last:border-0">
                    <td className="px-4 py-1.5 font-medium text-ink">{row.lead}</td>
                    <td className="px-4 py-1.5 text-charcoal">{row.clients}</td>
                    <td className="px-4 py-1.5 text-charcoal">{currency.format(row.retainer)}</td>
                    <td className="px-4 py-1.5 text-charcoal">{row.channels}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-ink">
                  <td className="px-4 py-1.5">Total</td>
                  <td className="px-4 py-1.5">{teamSplit.reduce((n, r) => n + r.clients, 0)}</td>
                  <td className="px-4 py-1.5">
                    {currency.format(teamSplit.reduce((n, r) => n + r.retainer, 0))}
                  </td>
                  <td className="px-4 py-1.5">
                    {Math.round(teamSplit.reduce((n, r) => n + r.channels, 0) * 10) / 10}
                  </td>
                </tr>
              </tbody>
            </table>
          </details>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAddingClient(true)} className="px-3 py-1.5 text-xs">
            + Add client
          </Button>
          <Button variant="ghost" onClick={() => setAddingTactical(true)} className="px-3 py-1.5 text-xs">
            + Add tactical
          </Button>
          {clientRows.length > 0 && (
            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setExportOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Export CSV
              </Button>
              {exportOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border-c bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => exportCsv("week")}
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-ink hover:bg-bg"
                  >
                    This week&apos;s opti clients
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCsv("all")}
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-ink hover:bg-bg"
                  >
                    All clients
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {myPending.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-charcoal">Your submissions:</span>
            {myPending.map((p) => (
              <Pill key={p.id} tone={p.approval_status === "rejected" ? "muted" : "gold"}>
                {p.name} — {p.approval_status === "rejected" ? "Rejected" : "Pending approval"}
              </Pill>
            ))}
          </div>
        )}
      </div>

      {clientRows.length === 0 ? (
        <EmptyState title="No Digital clients yet" description="Add a client above, or from the Admin page." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {VIEW_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setViewFilter(f.value);
                  setTierFilter("all");
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewFilter === f.value ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="my-auto h-4 w-px bg-border-c" aria-hidden />
            <button
              onClick={() => setMyClientsOnly((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                myClientsOnly ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
              }`}
            >
              My clients
            </button>
            <button
              onClick={() => setHidePaused((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                hidePaused ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
              }`}
            >
              Hide paused
            </button>
            {usedTiers.length > 0 && (
              <>
                <span className="my-auto h-4 w-px bg-border-c" aria-hidden />
                <button
                  onClick={() => setTierFilter("all")}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    tierFilter === "all" ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
                  }`}
                >
                  All tiers
                </button>
                {usedTiers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTierFilter(t.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      tierFilter === t.id ? "text-white" : "text-charcoal hover:border-gold/50"
                    }`}
                    style={
                      tierFilter === t.id
                        ? { background: t.colour, borderColor: t.colour }
                        : { borderColor: "var(--border-c)" }
                    }
                  >
                    {t.name}
                  </button>
                ))}
              </>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
          {visibleRows.length === 0 && (
            <p className="rounded-xl border border-dashed border-border-c px-4 py-6 text-center text-sm text-charcoal">
              {viewFilter === "not_optid" ? "Everything's opti'd — nice." : "No clients match these filters."}
            </p>
          )}
          {visibleRows.map((client) => {
            const status = clientStatusMeta(client.status);
            const childCount = childCountByParent.get(client.id) ?? 0;
            const isCollapsed = collapsedParents.has(client.id);
            return (
              <div
                key={client.id}
                className={`flex flex-wrap items-stretch gap-1 rounded-xl border p-1 transition-colors ${
                  client.parentId != null ? "ml-6" : ""
                } ${client.allDone ? "border-emerald-300 bg-emerald-50" : "border-border-c bg-white"}`}
                style={client.tier ? { borderLeftColor: client.tier.colour, borderLeftWidth: 4 } : undefined}
              >
                <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg bg-ink px-2.5 py-1 text-white">
                  {client.parentId != null ? (
                    <CornerDownRight className="h-3.5 w-3.5 flex-none text-white/60" strokeWidth={2} aria-hidden />
                  ) : childCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleParentCollapsed(client.id)}
                      aria-label={isCollapsed ? "Expand sub-clients" : "Collapse sub-clients"}
                      className="flex-none text-white/70 hover:text-white"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <ChevronDown className="h-4 w-4" strokeWidth={2} />
                      )}
                    </button>
                  ) : (
                    <span className="h-2 w-2 flex-none rounded-full" style={{ background: "#FDB600" }} />
                  )}
                  <span className="text-sm font-bold">{client.name}</span>
                  {childCount > 0 && (
                    <span className="text-[10px] font-semibold text-white/50">
                      {isCollapsed ? `+${childCount}` : ""}
                    </span>
                  )}
                  <div className="ml-auto flex flex-none items-center gap-1.5">
                    {viewFilter !== "week" && !client.dueThisWeek && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">
                        Off week
                      </span>
                    )}
                    {client.endDate && (
                      <span className="rounded-full bg-gold/90 px-2 py-0.5 text-[10px] font-semibold text-ink">
                        Ends {formatEndDate(client.endDate)}
                      </span>
                    )}
                    {client.parentId != null && client.includedInParentRetainer ? (
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                        Included in retainer
                      </span>
                    ) : (
                      client.retainer != null && (
                        <span className="text-[11px] font-semibold text-white/70">
                          {client.parentId != null ? "+" : ""}
                          {currency.format(client.retainer)}
                        </span>
                      )
                    )}
                    {client.tier && (
                      <span
                        className="flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: client.tier.colour }}
                      >
                        {client.tier.name}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingClientId(client.id)}
                      className="flex-none text-white/60 hover:text-gold"
                      aria-label={`Edit ${client.name}`}
                      title="Edit client"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                <div
                  className={`flex flex-none items-center justify-center rounded-lg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${status.className}`}
                  style={{ minWidth: 84 }}
                >
                  {status.label}
                </div>

                <div className="flex flex-none items-center rounded-lg border border-border-c px-3 py-1">
                  <WipBadge
                    clientId={client.id}
                    url={client.wipDocUrl}
                    isAdmin={isAdmin}
                    onSaved={(url) => setWipUrl(client.id, url)}
                  />
                </div>

                <div className="flex flex-none flex-col justify-center gap-0.5 rounded-lg border border-border-c px-3 py-1 text-xs">
                  <span className="font-semibold" style={{ color: "#CA8A04" }}>
                    {client.leadName ?? "Unassigned"}
                  </span>
                  {client.secondName && <span className="font-medium text-charcoal">{client.secondName}</span>}
                </div>

                <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-1">
                  {client.channels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => (ch.done ? untick(client.id, ch.id) : tick(client.id, ch.id))}
                      title={ch.done ? "Click to undo this week's tick" : "Mark done for this period"}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-left text-[11px] font-semibold text-ink transition-colors ${
                        ch.done
                          ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400"
                          : "border-border-c bg-white hover:border-gold/50"
                      }`}
                    >
                      <span
                        className={`flex h-3 w-3 flex-none items-center justify-center rounded border ${
                          ch.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border-c bg-white"
                        }`}
                      >
                        {ch.done && "✓"}
                      </span>
                      <span className="flex items-center gap-1">
                        {channelLabel(ch.channel)}
                        {ch.owners.length > 0 && (
                          <span className="text-[9px] font-semibold normal-case text-charcoal/70">
                            {ch.owners.map((o) => initials(o.name)).join(" ")}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          </div>
        </>
      )}

      {editingClient && (
        <EditClientModal
          client={editingClient}
          tiers={tiers}
          people={people}
          parentClientOptions={parentClientOptions}
          hasChildren={clientRows.some((c) => c.parentId === editingClient.id)}
          onClose={() => setEditingClientId(null)}
        />
      )}
      {addingClient && <AddClientModal tiers={tiers} onClose={() => setAddingClient(false)} />}
      {addingTactical && (
        <AddTacticalModal parentClientOptions={parentClientOptions} onClose={() => setAddingTactical(false)} />
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal">{label}</div>
      <div className="mt-0.5 text-xs font-bold text-ink">{value}</div>
    </Card>
  );
}

function WipBadge({
  clientId,
  url,
  isAdmin,
  onSaved,
}: {
  clientId: number;
  url: string | null;
  isAdmin: boolean;
  onSaved: (url: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(fd: FormData) {
    setError(null);
    const next = String(fd.get("wip_url") ?? "").trim() || null;
    startTransition(async () => {
      const result = await updateClientWipUrl(clientId, next);
      if ((result as { error?: string })?.error) setError((result as { error?: string }).error!);
      else {
        onSaved(next);
        setEditing(false);
      }
    });
  }

  if (editing) {
    return (
      <form action={handleSubmit} className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Input
          name="wip_url"
          defaultValue={url ?? ""}
          placeholder="https://…"
          autoFocus
          className="h-7 w-48 py-1 text-xs"
        />
        <Button type="submit" disabled={pending} className="px-2 py-1 text-xs">
          {pending ? "…" : "Save"}
        </Button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-charcoal hover:text-ink"
        >
          Cancel
        </button>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </form>
    );
  }

  if (!url) {
    if (!isAdmin) return null;
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-c bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal hover:border-gold/50 hover:text-gold"
      >
        + Add WIP
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-full border border-border-c bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal hover:border-gold/50 hover:text-gold"
      >
        WIP
        <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
      </a>
      {isAdmin && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-charcoal hover:text-gold"
          aria-label="Edit WIP link"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
        </button>
      )}
    </span>
  );
}
