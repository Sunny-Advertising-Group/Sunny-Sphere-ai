"use client";

import { useState, useTransition } from "react";
import { setAiRequestStatus } from "@/lib/actions/admin";
import { Card, EmptyState, Select } from "@/components/ui";

const STATUSES = ["new", "in_review", "building", "shipped", "parked"];

export type AiRequest = {
  id: number;
  task: string;
  frequency: string | null;
  hours_estimate: string | null;
  status: string;
};

export function RequestsInbox({ requests }: { requests: AiRequest[] }) {
  const [items, setItems] = useState(requests);
  const [, startTransition] = useTransition();

  function updateStatus(id: number, status: string) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    startTransition(async () => {
      await setAiRequestStatus(id, status);
    });
  }

  if (items.length === 0) return <EmptyState icon="💡" title="Inbox is empty" />;

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <Card key={r.id} className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink">{r.task}</p>
            <p className="mt-1 text-xs text-charcoal">
              {r.frequency && `${r.frequency} · `}
              {r.hours_estimate}
            </p>
          </div>
          <Select
            value={r.status}
            onChange={(e) => updateStatus(r.id, e.target.value)}
            className="w-36 flex-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Card>
      ))}
    </div>
  );
}
