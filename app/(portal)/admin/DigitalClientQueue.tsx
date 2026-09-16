"use client";

import { useState, useTransition } from "react";
import { Target } from "lucide-react";
import { approveDigitalClient, rejectDigitalClient } from "@/lib/actions/admin";
import { channelLabel } from "@/lib/digitalOpti";
import { Card, EmptyState, Pill } from "@/components/ui";

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export type PendingDigitalClient = {
  id: number;
  name: string;
  parentName: string | null;
  retainer: number | null;
  includedInParentRetainer: boolean;
  requestedChannels: string[];
  submittedBy: string;
};

export function DigitalClientQueue({ items: initialItems }: { items: PendingDigitalClient[] }) {
  const [items, setItems] = useState(initialItems);
  const [pending, startTransition] = useTransition();

  function act(id: number, action: "approve" | "reject") {
    startTransition(async () => {
      await (action === "approve" ? approveDigitalClient(id) : rejectDigitalClient(id));
      setItems((prev) => prev.filter((i) => i.id !== id));
    });
  }

  if (items.length === 0) return <EmptyState icon={Target} title="Nothing pending from the Digital tab" />;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{item.name}</span>
              {item.parentName && <Pill tone="gold">Tactical — under {item.parentName}</Pill>}
              {item.retainer != null && <Pill>{currency.format(item.retainer)}</Pill>}
              {item.parentName && item.includedInParentRetainer && <Pill tone="muted">Included in retainer</Pill>}
            </div>
            {item.requestedChannels.length > 0 && (
              <p className="mt-1 text-sm text-charcoal">
                Channels: {item.requestedChannels.map(channelLabel).join(", ")}
              </p>
            )}
            <p className="mt-1 text-xs text-charcoal">Submitted by {item.submittedBy}</p>
          </div>
          <div className="flex flex-none gap-2">
            <button
              disabled={pending}
              onClick={() => act(item.id, "approve")}
              className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={pending}
              onClick={() => act(item.id, "reject")}
              className="rounded-lg border border-border-c px-3 py-1.5 text-xs font-semibold text-charcoal disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
