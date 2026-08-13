"use client";

import { useState } from "react";
import { Link2, Radio } from "lucide-react";
import { Card, EmptyState, Pill } from "@/components/ui";
import { cadenceLabel, HOUSEKEEPING_STATUS_META, housekeepingStatus, kindLabel, liveMaterialStatusClassName } from "@/lib/atl";

export type AtlLinkRow = {
  id: number;
  kind: string;
  title: string;
  url: string;
  version_label: string | null;
  cadence: string | null;
  drive_modified_at: string | null;
  drive_modified_by: string | null;
};

export type LiveMaterialRow = {
  id: number;
  partner: string | null;
  channel: string | null;
  asset_name: string | null;
  status: string | null;
  due_date: string | null;
  synced_at: string | null;
  source_kind: string | null;
};

const TABS = [
  { key: "links", label: "Links", icon: Link2 },
  { key: "live_material", label: "Live material", icon: Radio },
] as const;

function ageDays(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function relativeDays(iso: string) {
  const days = ageDays(iso);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function AtlClientTabs({
  links,
  liveMaterial,
}: {
  links: AtlLinkRow[];
  liveMaterial: LiveMaterialRow[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("links");

  // Most clients have one tracker sheet; Lincoln Place has three (NSW/QLD/VIC).
  // Group by source_kind and only show sub-tabs when there's more than one.
  const liveMaterialGroups = liveMaterial.reduce<Record<string, LiveMaterialRow[]>>((acc, row) => {
    const key = row.source_kind ?? "live_material_tracker";
    (acc[key] ??= []).push(row);
    return acc;
  }, {});
  const liveMaterialGroupKeys = Object.keys(liveMaterialGroups);
  const [activeLiveMaterialGroup, setActiveLiveMaterialGroup] = useState<string | null>(null);
  const currentGroupKey = activeLiveMaterialGroup ?? liveMaterialGroupKeys[0] ?? null;
  const currentGroupRows = currentGroupKey ? (liveMaterialGroups[currentGroupKey] ?? []) : [];
  const latestSync = currentGroupRows.find((m) => m.synced_at)?.synced_at;

  const tracked = links.filter((l) => l.cadence && l.cadence !== "none");
  const statuses = tracked.map((l) => housekeepingStatus(l.cadence, l.drive_modified_at));
  const counts = {
    current: statuses.filter((s) => s === "current").length,
    due_soon: statuses.filter((s) => s === "due_soon").length,
    overdue: statuses.filter((s) => s === "overdue").length,
  };
  const oldestKnownAgeDays = links
    .map((l) => l.drive_modified_at)
    .filter((d): d is string => Boolean(d))
    .map(ageDays);
  const oldestUpdate = oldestKnownAgeDays.length ? Math.max(...oldestKnownAgeDays) : null;
  const anySyncedAt = links
    .map((l) => l.drive_modified_at)
    .filter((d): d is string => Boolean(d));

  return (
    <div>
      <div className="mb-6 flex gap-6 border-b border-border-c">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 border-b-2 pb-3 text-sm font-semibold transition-colors ${
              tab === key
                ? "border-gold text-ink"
                : "border-transparent text-charcoal hover:text-ink"
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "links" && (
        <div>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <div className="text-3xl font-extrabold text-gold">{counts.current}</div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal">Current</div>
            </Card>
            <Card>
              <div className="text-3xl font-extrabold text-amber-700">{counts.due_soon}</div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal">Due soon</div>
            </Card>
            <Card>
              <div className="text-3xl font-extrabold text-red-700">{counts.overdue}</div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal">Overdue</div>
            </Card>
            <Card>
              <div className="text-3xl font-extrabold text-ink">{oldestUpdate !== null ? `${oldestUpdate}d` : "—"}</div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal">Oldest update</div>
            </Card>
          </div>

          {links.length === 0 ? (
            <EmptyState icon={Link2} title="No links yet" description="Admins can add flight plans, WIPs, rate cards and more from Admin → ATL — clients & links." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-c text-left text-xs uppercase text-charcoal">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Cadence</th>
                    <th className="px-4 py-3">Last updated</th>
                    <th className="px-4 py-3">By</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => {
                    const status = housekeepingStatus(link.cadence, link.drive_modified_at);
                    const meta = HOUSEKEEPING_STATUS_META[status];
                    return (
                      <tr key={link.id} className="border-b border-border-c last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink">{link.title}</div>
                          <div className="text-xs text-charcoal">
                            {kindLabel(link.kind)}
                            {link.version_label && ` · ${link.version_label}`}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-charcoal">{cadenceLabel(link.cadence)}</td>
                        <td className="px-4 py-3">
                          {link.drive_modified_at ? (
                            <>
                              <div>{new Date(link.drive_modified_at).toLocaleDateString()}</div>
                              <div className="text-xs text-charcoal">{relativeDays(link.drive_modified_at)}</div>
                            </>
                          ) : (
                            <span className="text-charcoal">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-charcoal">{link.drive_modified_by ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${meta.className}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-border-c px-3 py-1.5 text-xs font-semibold text-ink hover:border-gold/50"
                          >
                            Open ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          <p className="mt-6 border-l-2 border-gold pl-4 text-xs leading-relaxed text-charcoal">
            {anySyncedAt.length > 0
              ? "Last updated / By are pulled from Google Drive file metadata."
              : "Last updated / By aren't live yet — the Drive metadata sync hasn't been switched on. Cadence is saved and will start producing statuses as soon as it is."}
            {" "}This tab is a mirror — never the source of truth.
          </p>
        </div>
      )}

      {tab === "live_material" && (
        <div>
          {liveMaterialGroupKeys.length > 1 && (
            <div className="mb-4 flex gap-2">
              {liveMaterialGroupKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveLiveMaterialGroup(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    key === currentGroupKey
                      ? "bg-gold text-ink"
                      : "border border-border-c text-charcoal hover:border-gold/50"
                  }`}
                >
                  {kindLabel(key)}
                </button>
              ))}
            </div>
          )}

          <div className="mb-3 flex items-center gap-2">
            {latestSync ? (
              <Pill tone="muted">Last synced {new Date(latestSync).toLocaleString()}</Pill>
            ) : (
              <Pill tone="muted">Sync not yet configured</Pill>
            )}
          </div>
          {currentGroupRows.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No live material data"
              description="The hourly sync from the LIVE MATERIAL sheet hasn't been switched on yet — this is a mirror, never the source of truth."
            />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-c text-left text-xs uppercase text-charcoal">
                    <th className="px-4 py-3">Partner</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {currentGroupRows.map((row) => (
                    <tr key={row.id} className="border-b border-border-c last:border-0">
                      <td className="px-4 py-3">{row.partner}</td>
                      <td className="px-4 py-3">{row.channel}</td>
                      <td className="px-4 py-3">{row.asset_name}</td>
                      <td className="px-4 py-3">
                        {row.status ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${liveMaterialStatusClassName(row.status)}`}>
                            {row.status}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">{row.due_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
