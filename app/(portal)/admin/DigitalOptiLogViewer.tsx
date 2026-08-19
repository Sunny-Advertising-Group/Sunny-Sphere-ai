"use client";

import { useMemo, useState, useTransition } from "react";
import { restoreOptiLog, voidOptiLog } from "../digital-opti/actions";
import { Card, EmptyState, Input } from "@/components/ui";
import { channelLabel } from "@/lib/digitalOpti";

export type OptiLogRow = {
  id: number;
  clientName: string;
  channel: string;
  completedByName: string;
  completedAt: string;
  voidedAt: string | null;
  voidedByName: string | null;
};

export function DigitalOptiLogViewer({ logs }: { logs: OptiLogRow[] }) {
  const [rows, setRows] = useState(logs);
  const [filter, setFilter] = useState("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.clientName.toLowerCase().includes(q));
  }, [rows, filter]);

  function toggleVoid(row: OptiLogRow) {
    const isVoided = !!row.voidedAt;
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, voidedAt: isVoided ? null : new Date().toISOString() } : r)),
    );
    startTransition(async () => {
      if (isVoided) await restoreOptiLog(row.id);
      else await voidOptiLog(row.id);
    });
  }

  if (logs.length === 0) {
    return <EmptyState title="No ticks logged yet" description="Every optimisation tick from the tracker will show up here." />;
  }

  return (
    <div className="space-y-3">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by client…"
        className="w-64"
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-c text-left text-xs uppercase text-charcoal">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Ticked by</th>
              <th className="px-4 py-3">Ticked at</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-border-c last:border-0">
                <td className="px-4 py-2.5 font-medium text-ink">{row.clientName}</td>
                <td className="px-4 py-2.5 text-charcoal">{channelLabel(row.channel)}</td>
                <td className="px-4 py-2.5 text-charcoal">{row.completedByName}</td>
                <td className="px-4 py-2.5 text-charcoal">{new Date(row.completedAt).toLocaleString("en-AU")}</td>
                <td className="px-4 py-2.5">
                  {row.voidedAt ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      Voided{row.voidedByName ? ` by ${row.voidedByName}` : ""}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Logged
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => toggleVoid(row)}
                    className="text-xs font-semibold text-charcoal hover:text-gold"
                  >
                    {row.voidedAt ? "Restore" : "Void"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
