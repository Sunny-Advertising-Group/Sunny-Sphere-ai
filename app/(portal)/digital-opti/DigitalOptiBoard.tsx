"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { Button, Card, EmptyState, Input } from "@/components/ui";
import {
  cadenceLabel,
  channelLabel,
  clientStatusMeta,
  currentWeekCommencing,
  type ClientCardData,
  type TeamSplitRow,
  type TierInfo,
} from "@/lib/digitalOpti";
import { logOpti, unlogOpti, updateClientWipUrl, updateScheduleLabel } from "./actions";

export type { ClientCardData, TeamSplitRow };

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
}) {
  const [clientRows, setClientRows] = useState(clients);
  const [tierFilter, setTierFilter] = useState<number | "all">("all");
  const [, startTransition] = useTransition();

  const usedTiers = useMemo(
    () => tiers.filter((t) => clientRows.some((c) => c.tier?.id === t.id)),
    [tiers, clientRows],
  );
  const filteredRows =
    tierFilter === "all" ? clientRows : clientRows.filter((c) => c.tier?.id === tierFilter);

  function setWipUrl(clientId: number, url: string | null) {
    setClientRows((prev) => prev.map((c) => (c.id !== clientId ? c : { ...c, wipDocUrl: url })));
  }

  function setChannelDone(clientId: number, channelId: number, done: boolean) {
    setClientRows((prev) =>
      prev.map((c) =>
        c.id !== clientId
          ? c
          : { ...c, channels: c.channels.map((ch) => (ch.id === channelId ? { ...ch, done } : ch)) },
      ),
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
    <div className="space-y-6 p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Week commencing" value={formatWeekCommencing()} />
        <ScheduleTile label={scheduleLabel} isAdmin={isAdmin} />
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">
            Optimisation completion
          </div>
          <div className="mt-2 text-3xl font-extrabold text-ink">{completionPct}%</div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full bg-gold" style={{ width: `${completionPct}%` }} />
          </div>
          <div className="mt-1.5 text-xs text-charcoal">
            {totalDone} of {totalActive} due this period
          </div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">Last updated</div>
          <div className="mt-2 text-lg font-bold text-ink">
            {lastUpdatedAt ? <LiveRelativeTime iso={lastUpdatedAt} /> : "No optis logged yet"}
          </div>
        </Card>
      </div>

      {teamSplit.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-c text-left text-xs uppercase text-charcoal">
                <th className="px-4 py-3">Team split</th>
                <th className="px-4 py-3">Clients</th>
                <th className="px-4 py-3">Retainer</th>
                <th className="px-4 py-3">Channels</th>
              </tr>
            </thead>
            <tbody>
              {teamSplit.map((row) => (
                <tr key={row.lead} className="border-b border-border-c last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{row.lead}</td>
                  <td className="px-4 py-2.5 text-charcoal">{row.clients}</td>
                  <td className="px-4 py-2.5 text-charcoal">{currency.format(row.retainer)}</td>
                  <td className="px-4 py-2.5 text-charcoal">{row.channels}</td>
                </tr>
              ))}
              <tr className="font-semibold text-ink">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5">{teamSplit.reduce((n, r) => n + r.clients, 0)}</td>
                <td className="px-4 py-2.5">
                  {currency.format(teamSplit.reduce((n, r) => n + r.retainer, 0))}
                </td>
                <td className="px-4 py-2.5">
                  {Math.round(teamSplit.reduce((n, r) => n + r.channels, 0) * 10) / 10}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {clientRows.length === 0 ? (
        <EmptyState title="No Digital clients yet" description="Add a client and their channels from the Admin page." />
      ) : (
        <>
          {usedTiers.length > 0 && (
            <div className="flex flex-wrap gap-2">
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
            </div>
          )}
          <div className="flex flex-col gap-2">
          {filteredRows.map((client) => {
            const status = clientStatusMeta(client.status);
            return (
              <div
                key={client.id}
                className="flex flex-wrap items-stretch gap-2 rounded-xl border border-border-c bg-white p-2"
                style={client.tier ? { borderLeftColor: client.tier.colour, borderLeftWidth: 4 } : undefined}
              >
                <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg bg-ink px-3 py-2 text-white">
                  <span
                    className="h-2.5 w-2.5 flex-none rounded-full"
                    style={{ background: client.colour || "#FDB600" }}
                  />
                  <div className="flex flex-col leading-tight">
                    {client.retainer != null && (
                      <span className="text-[11px] font-semibold text-white/70">
                        {currency.format(client.retainer)}
                      </span>
                    )}
                    <span className="text-sm font-bold">{client.name}</span>
                  </div>
                  {client.tier && (
                    <span
                      className="ml-auto flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ background: client.tier.colour }}
                    >
                      {client.tier.name}
                    </span>
                  )}
                </div>

                <div
                  className={`flex flex-none items-center justify-center rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${status.className}`}
                  style={{ minWidth: 84 }}
                >
                  {status.label}
                </div>

                <div className="flex flex-none items-center rounded-lg border border-border-c px-3 py-2">
                  <WipBadge
                    clientId={client.id}
                    url={client.wipDocUrl}
                    isAdmin={isAdmin}
                    onSaved={(url) => setWipUrl(client.id, url)}
                  />
                </div>

                <div className="flex flex-none flex-col justify-center gap-0.5 rounded-lg border border-border-c px-3 py-2 text-xs">
                  <span className="font-semibold text-ink">{client.leadName ?? "Unassigned"}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-charcoal">
                    {cadenceLabel(client.cadence)}
                  </span>
                </div>

                <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-1.5">
                  {client.channels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => (ch.done ? untick(client.id, ch.id) : tick(client.id, ch.id))}
                      title={ch.done ? "Click to undo this week's tick" : "Mark done for this period"}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold text-ink transition-colors ${
                        ch.done
                          ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400"
                          : "border-border-c bg-white hover:border-gold/50"
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded border ${
                          ch.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border-c bg-white"
                        }`}
                      >
                        {ch.done && "✓"}
                      </span>
                      <span className="flex flex-col">
                        {channelLabel(ch.channel)}
                        {ch.owners.length > 0 && (
                          <span className="text-[9px] font-medium normal-case text-charcoal/70">
                            {ch.owners.map((o) => `${o.name} ${o.splitPct}%`).join(" · ")}
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
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">{label}</div>
      <div className="mt-2 text-lg font-bold text-ink">{value}</div>
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

function ScheduleTile({ label, isAdmin }: { label: string | null; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateScheduleLabel(undefined, fd);
      if (result?.success) setEditing(false);
      else if (result?.error) setError(result.error);
    });
  }

  if (editing) {
    return (
      <Card>
        <form action={handleSubmit} className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">Schedule</div>
          <Input name="schedule_label" defaultValue={label ?? ""} placeholder="e.g. PBR & BLUE" autoFocus />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "…" : "Save"}
            </Button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-charcoal hover:text-ink">
              Cancel
            </button>
          </div>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">Schedule</div>
        {isAdmin && (
          <button onClick={() => setEditing(true)} className="text-charcoal hover:text-gold" aria-label="Edit schedule">
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="mt-2 text-lg font-bold text-ink">{label || "—"}</div>
    </Card>
  );
}
