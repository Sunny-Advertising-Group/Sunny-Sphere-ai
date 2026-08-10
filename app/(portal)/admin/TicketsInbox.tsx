"use client";

import { useState, useTransition } from "react";
import { setTicketStatus } from "@/lib/actions/admin";
import { LifeBuoy } from "lucide-react";
import { Card, EmptyState, Select } from "@/components/ui";

const STATUSES = ["open", "in_progress", "resolved"];

export type Ticket = {
  id: number;
  body: string;
  category: string | null;
  urgency: string | null;
  status: string;
};

export function TicketsInbox({ tickets }: { tickets: Ticket[] }) {
  const [items, setItems] = useState(tickets);
  const [, startTransition] = useTransition();

  function updateStatus(id: number, status: string) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    startTransition(async () => {
      await setTicketStatus(id, status);
    });
  }

  if (items.length === 0) return <EmptyState icon={LifeBuoy} title="No tickets" />;

  return (
    <div className="space-y-3">
      {items.map((t) => (
        <Card key={t.id} className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink">{t.body}</p>
            <p className="mt-1 text-xs text-charcoal">
              {t.category} {t.urgency && `· ${t.urgency}`}
            </p>
          </div>
          <Select
            value={t.status}
            onChange={(e) => updateStatus(t.id, e.target.value)}
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
