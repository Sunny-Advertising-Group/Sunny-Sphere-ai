"use client";

import { useState, useTransition } from "react";
import { deleteTip } from "@/lib/actions/admin";
import { Card, EmptyState, Pill } from "@/components/ui";

export type PublishedTip = {
  id: number;
  title: string | null;
  body: string;
  is_prompt: boolean;
};

export function PublishedTipsList({ tips }: { tips: PublishedTip[] }) {
  const [items, setItems] = useState(tips);
  const [, startTransition] = useTransition();

  function remove(id: number) {
    if (!confirm("Delete this tip? This can't be undone.")) return;
    setItems((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await deleteTip(id);
    });
  }

  if (items.length === 0) return <EmptyState title="Nothing published yet" />;

  return (
    <div className="space-y-2">
      {items.map((tip) => (
        <Card key={tip.id} className="flex items-center justify-between gap-4 py-3">
          <div>
            <Pill tone="gold">{tip.is_prompt ? "Prompt" : "Tip"}</Pill>
            <p className="mt-1 line-clamp-1 text-sm text-ink">{tip.title || tip.body}</p>
          </div>
          <button onClick={() => remove(tip.id)} className="flex-none text-xs font-semibold text-red-600 hover:underline">
            Delete
          </button>
        </Card>
      ))}
    </div>
  );
}
