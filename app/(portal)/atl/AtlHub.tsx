"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { kindLabel, KIND_ORDER } from "@/lib/atl";
import { Card, EmptyState } from "@/components/ui";
import { BarChart3 } from "lucide-react";

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
  kind: string;
  title: string;
  url: string;
  version_label: string | null;
  client_name: string;
  client_colour: string | null;
};

export function AtlHub({ clients, links }: { clients: ClientRow[]; links: LinkRow[] }) {
  const [view, setView] = useState<"client" | "category">("client");

  const byTeam = useMemo(
    () =>
      TEAM_ORDER.map((team) => ({ team, clients: clients.filter((c) => c.team === team) })).filter(
        (g) => g.clients.length > 0,
      ),
    [clients],
  );

  const byCategory = useMemo(() => {
    const kinds = Array.from(new Set(links.map((l) => l.kind)));
    const ordered = [
      ...KIND_ORDER.filter((k) => kinds.includes(k)),
      ...kinds.filter((k) => !KIND_ORDER.includes(k)).sort(),
    ];
    return ordered.map((kind) => ({
      kind,
      links: links.filter((l) => l.kind === kind).sort((a, b) => a.client_name.localeCompare(b.client_name)),
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
        {(["client", "category"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              view === v ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
            }`}
          >
            {v === "client" ? "By client" : "By category"}
          </button>
        ))}
      </div>

      <div className="space-y-10 p-8">
        {view === "client"
          ? byTeam.map((group) => (
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
          : byCategory.length === 0 ? (
              <EmptyState icon={BarChart3} title="No links yet" description="Add links to clients to see them grouped by category here." />
            ) : (
              byCategory.map((group) => (
                <div key={group.kind}>
                  <h2 className="mb-3 text-sm font-bold text-ink">{kindLabel(group.kind)}</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.links.map((link) => (
                      <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="block">
                        <Card className="h-full transition-colors hover:border-gold/50">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 flex-none rounded-full"
                              style={{ background: link.client_colour || "#FDB600" }}
                            />
                            <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">
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
                </div>
              ))
            )}
      </div>
    </div>
  );
}
