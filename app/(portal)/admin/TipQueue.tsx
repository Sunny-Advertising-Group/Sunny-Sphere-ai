"use client";

import { useState, useTransition } from "react";
import { reviewTip } from "@/lib/actions/admin";
import { Card, EmptyState, Pill } from "@/components/ui";

export type PendingTip = {
  id: number;
  title: string | null;
  body: string;
  category: string | null;
  is_prompt: boolean;
};

export function TipQueue({ tips }: { tips: PendingTip[] }) {
  const [items, setItems] = useState(tips);
  const [pending, startTransition] = useTransition();

  function act(id: number, status: "published" | "rejected") {
    startTransition(async () => {
      await reviewTip(id, status);
      setItems((prev) => prev.filter((t) => t.id !== id));
    });
  }

  if (items.length === 0) return <EmptyState icon="✨" title="Nothing pending review" />;

  return (
    <div className="space-y-3">
      {items.map((tip) => (
        <Card key={tip.id} className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Pill tone="gold">{tip.is_prompt ? "Prompt" : "Tip"}</Pill>
              {tip.category && <Pill>{tip.category}</Pill>}
            </div>
            {tip.title && <div className="mt-1 font-semibold text-ink">{tip.title}</div>}
            <p className="mt-1 whitespace-pre-wrap text-sm text-charcoal">{tip.body}</p>
          </div>
          <div className="flex flex-none gap-2">
            <button
              disabled={pending}
              onClick={() => act(tip.id, "published")}
              className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
            >
              Publish
            </button>
            <button
              disabled={pending}
              onClick={() => act(tip.id, "rejected")}
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
