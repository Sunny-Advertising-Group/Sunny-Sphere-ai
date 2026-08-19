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
import { logOpti, updateScheduleLabel } from "./actions";

export type { ClientCardData, TeamSplitRow };

// A low-alpha tint of the tier's colour, used as a card background band so
// the tier reads at a glance without fighting the text for contrast.
function tierTint(colour: string): string {
  return `${colour}1A`;
}

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

  function tick(clientId: number, channelId: number) {
    setClientRows((prev) =>
      prev.map((c) =>
        c.id !== clientId
          ? c
          : {
              ...c,
              channels: c.channels.map((ch) => (ch.id === channelId ? { ...ch, done: true } : ch)),
            },
      ),
    );
    startTransition(async () => {
      const result = await logOpti(channelId);
      if ((result as { error?: string })?.error) {
        setClientRows((prev) =>
          prev.map((c) =>
            c.id !== clientId
              ? c
              : { ...c, channels: c.channels.map((ch) => (ch.id === channelId ? { ...ch, done: false } : ch)) },
          ),
        );
      }
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
              </tr>
            </thead>
            <tbody>
              {teamSplit.map((row) => (
                <tr key={row.lead} className="border-b border-border-c last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{row.lead}</td>
                  <td className="px-4 py-2.5 text-charcoal">{row.clients}</td>
                  <td className="px-4 py-2.5 text-charcoal">{currency.format(row.retainer)}</td>
                </tr>
              ))}
              <tr className="font-semibold text-ink">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5">{teamSplit.reduce((n, r) => n + r.clients, 0)}</td>
                <td className="px-4 py-2.5">
                  {currency.format(teamSplit.reduce((n, r) => n + r.retainer, 0))}
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredRows.map((client) => {
            const status = clientStatusMeta(client.status);
            return (
              <Card key={client.id} style={client.tier ? { background: tierTint(client.tier.colour) } : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 flex-none rounded-full"
                      style={{ background: client.colour || "#FDB600" }}
                    />
                    <span className="font-semibold text-ink">{client.name}</span>
                    {client.wipDocUrl && (
                      <a
                        href={client.wipDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-border-c bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal hover:border-gold/50 hover:text-gold"
                      >
                        WIP
                        <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
                      </a>
                    )}
                    {client.tier && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: client.tier.colour }}
                      >
                        {client.tier.name}
                      </span>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-charcoal">
                  <span>{client.leadName ?? "Unassigned"}</span>
                  {client.retainer != null && <span>· {currency.format(client.retainer)}</span>}
                  <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal">
                    {cadenceLabel(client.cadence)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {client.channels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      disabled={ch.done}
                      onClick={() => tick(client.id, ch.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold text-ink transition-colors ${
                        ch.done
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-border-c bg-white hover:border-gold/50"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${
                          ch.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border-c bg-white"
                        }`}
                      >
                        {ch.done && "✓"}
                      </span>
                      {channelLabel(ch.channel)}
                    </button>
                  ))}
                </div>
              </Card>
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
