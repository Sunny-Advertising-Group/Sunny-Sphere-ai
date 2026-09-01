"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { BarChart3, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import {
  buildAtlChecklistData,
  cadenceLabel,
  categoryKind,
  groupChecklistByClient,
  kindLabel,
  KIND_ORDER,
  type ChecklistLogInput,
} from "@/lib/atl";
import { logAtlChecklist, unlogAtlChecklist } from "./actions";
import { LoaLinks, type LoaLink } from "./LoaLinks";

const TEAM_ORDER = ["ATL", "Digital", "Comms"];

export type ClientRow = {
  id: number;
  name: string;
  colour: string | null;
  team: string;
  is_active: boolean;
};

export type LinkRow = {
  id: number;
  client_id: number;
  kind: string;
  title: string;
  url: string;
  version_label: string | null;
  cadence: string | null;
  client_name: string;
  client_colour: string | null;
};

export function AtlHub({
  clients,
  links,
  checklistLogs,
  loaLinks,
  isAdmin,
}: {
  clients: ClientRow[];
  links: LinkRow[];
  checklistLogs: ChecklistLogInput[];
  loaLinks: LoaLink[];
  isAdmin: boolean;
}) {
  const [view, setView] = useState<"checklist" | "client" | "category">("checklist");
  const [openKinds, setOpenKinds] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState(checklistLogs);
  const [, startTransition] = useTransition();

  function toggleKind(kind: string) {
    setOpenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const checklist = useMemo(
    () =>
      buildAtlChecklistData(
        links.map((l) => ({
          id: l.id,
          clientId: l.client_id,
          clientName: l.client_name,
          clientColour: l.client_colour,
          kind: l.kind,
          title: l.title,
          cadence: l.cadence,
        })),
        logs,
      ),
    [links, logs],
  );

  function tick(atlLinkId: number) {
    const optimisticStamp = new Date().toISOString();
    setLogs((prev) => [...prev, { atl_link_id: atlLinkId, completed_at: optimisticStamp, voided_at: null }]);
    startTransition(async () => {
      const result = await logAtlChecklist(atlLinkId);
      if ((result as { error?: string })?.error) {
        setLogs((prev) => prev.filter((l) => !(l.atl_link_id === atlLinkId && l.completed_at === optimisticStamp)));
      }
    });
  }

  function untick(atlLinkId: number) {
    const voidedAt = new Date().toISOString();
    let reverted: ChecklistLogInput[] = logs;
    setLogs((prev) => {
      reverted = prev;
      return prev.map((l) => (l.atl_link_id === atlLinkId && !l.voided_at ? { ...l, voided_at: voidedAt } : l));
    });
    startTransition(async () => {
      const result = await unlogAtlChecklist(atlLinkId);
      if ((result as { error?: string })?.error) setLogs(reverted);
    });
  }

  const byTeam = useMemo(
    () =>
      TEAM_ORDER.map((team) => ({ team, clients: clients.filter((c) => c.team === team) })).filter(
        (g) => g.clients.length > 0,
      ),
    [clients],
  );

  const byCategory = useMemo(() => {
    const kinds = Array.from(new Set(links.map((l) => categoryKind(l.kind))));
    const ordered = [
      ...KIND_ORDER.filter((k) => kinds.includes(k)),
      ...kinds.filter((k) => !KIND_ORDER.includes(k)).sort(),
    ];
    return ordered.map((kind) => ({
      kind,
      links: links
        .filter((l) => categoryKind(l.kind) === kind)
        .sort((a, b) => a.client_name.localeCompare(b.client_name)),
    }));
  }, [links]);

  if (clients.length === 0) {
    return (
      <div className="p-8">
        <EmptyState icon={BarChart3} title="No clients yet" description="Add a client to start linking their ATL material." />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 border-b border-border-c bg-white px-8 py-4">
        {(["checklist", "client", "category"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              view === v ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
            }`}
          >
            {v === "checklist" ? "Checklist" : v === "client" ? "By client" : "By category"}
          </button>
        ))}
      </div>

      <div className="space-y-10 p-8">
        {view === "checklist" ? (
          <div className="space-y-4">
            <LoaLinks items={loaLinks} isAdmin={isAdmin} />
            <ChecklistBoard cards={checklist.cards} completionPct={checklist.completionPct} totalDone={checklist.totalDone} totalActive={checklist.totalActive} onTick={tick} onUntick={untick} />
          </div>
        ) : view === "client" ? (
          byTeam.map((group) => (
            <div key={group.team}>
              <h2 className="mb-3 text-sm font-bold text-ink">{group.team}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.clients.map((client) => (
                  <Link key={client.id} href={`/atl/${encodeURIComponent(client.name)}`}>
                    <Card className="flex items-center gap-3 transition-colors hover:border-gold/50">
                      <span
                        className="h-3 w-3 flex-none rounded-full"
                        style={{ background: client.colour || "#FDB600" }}
                      />
                      <div>
                        <div className="font-semibold text-ink">{client.name}</div>
                        {!client.is_active && <div className="text-xs text-charcoal">Inactive</div>}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))
        ) : byCategory.length === 0 ? (
          <EmptyState icon={BarChart3} title="No links yet" description="Add links to clients to see them grouped by category here." />
        ) : (
          byCategory.map((group) => {
            const isOpen = openKinds.has(group.kind);
            return (
              <div key={group.kind}>
                <button
                  onClick={() => toggleKind(group.kind)}
                  className="mb-3 flex w-full items-center gap-2 text-left"
                >
                  {isOpen ? (
                    <ChevronDown size={18} className="flex-none text-charcoal" />
                  ) : (
                    <ChevronRight size={18} className="flex-none text-charcoal" />
                  )}
                  <h2 className="text-sm font-bold text-ink">{kindLabel(group.kind)}</h2>
                  <span className="text-xs font-medium text-charcoal">({group.links.length})</span>
                </button>
                {isOpen && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.links.map((link) => (
                      <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="block">
                        <Card className="h-full transition-colors hover:border-gold/50">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 flex-none rounded-full"
                              style={{ background: link.client_colour || "#FDB600" }}
                            />
                            <div
                              className="text-sm font-bold uppercase tracking-wide"
                              style={{ color: link.client_colour || "#FDB600" }}
                            >
                              {link.client_name}
                            </div>
                          </div>
                          <div className="mt-1 font-semibold text-ink">{link.title}</div>
                          {link.version_label && (
                            <div className="mt-1 text-xs text-charcoal">{link.version_label}</div>
                          )}
                        </Card>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ChecklistBoard({
  cards,
  completionPct,
  totalDone,
  totalActive,
  onTick,
  onUntick,
}: {
  cards: ReturnType<typeof buildAtlChecklistData>["cards"];
  completionPct: number;
  totalDone: number;
  totalActive: number;
  onTick: (id: number) => void;
  onUntick: (id: number) => void;
}) {
  if (cards.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No cadenced links yet"
        description="Give a link a reporting cadence (not 'Doesn't need to be updated') from Admin to have it show up here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal">
          Checklist completion this period
        </div>
        <div className="mt-0.5 text-lg font-extrabold text-ink">{completionPct}%</div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-gold" style={{ width: `${completionPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-charcoal">
          {totalDone} of {totalActive} updated this period
        </div>
      </Card>

      <div className="flex flex-col gap-1.5">
        {groupChecklistByClient(cards).map((group) => (
          <div
            key={group.clientId}
            className={`flex flex-wrap items-center gap-2 rounded-xl border p-1.5 transition-colors ${
              group.allDone ? "border-emerald-300 bg-emerald-50" : "border-border-c bg-white"
            }`}
          >
            <div className="flex min-w-[180px] flex-none items-center gap-2 rounded-lg bg-ink px-2.5 py-1.5 text-white">
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: group.clientColour || "#FDB600" }} />
              <div>
                <div className="text-sm font-bold">{group.clientName}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                  {group.cadences.map(cadenceLabel).join(" · ")}
                </div>
              </div>
            </div>
            <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-1.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.done ? onUntick(item.id) : onTick(item.id))}
                  title={item.done ? "Click to undo this period's tick" : "Mark updated for this period"}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    item.done
                      ? "border-emerald-300 bg-emerald-100 text-emerald-800 hover:border-emerald-400"
                      : "border-border-c bg-white text-ink hover:border-gold/50"
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded border ${
                      item.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border-c bg-white"
                    }`}
                  >
                    {item.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </span>
                  {kindLabel(item.kind)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
