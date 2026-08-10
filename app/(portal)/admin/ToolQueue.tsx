"use client";

import { useState, useTransition } from "react";
import { reviewTool } from "@/lib/actions/admin";
import { Card, EmptyState, Pill } from "@/components/ui";

export type PendingTool = {
  id: number;
  name: string;
  category: string;
  tool_type: string;
  description: string;
  status: string;
};

export function ToolQueue({ tools }: { tools: PendingTool[] }) {
  const [items, setItems] = useState(tools);
  const [pending, startTransition] = useTransition();

  function act(id: number, status: "published" | "rejected") {
    startTransition(async () => {
      await reviewTool(id, status);
      setItems((prev) => prev.filter((t) => t.id !== id));
    });
  }

  if (items.length === 0) return <EmptyState icon="🛠" title="Nothing pending review" />;

  return (
    <div className="space-y-3">
      {items.map((tool) => (
        <Card key={tool.id} className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink">{tool.name}</span>
              <Pill tone="gold">{tool.tool_type}</Pill>
              <Pill>{tool.category}</Pill>
            </div>
            <p className="mt-1 text-sm text-charcoal">{tool.description}</p>
          </div>
          <div className="flex flex-none gap-2">
            <button
              disabled={pending}
              onClick={() => act(tool.id, "published")}
              className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
            >
              Publish
            </button>
            <button
              disabled={pending}
              onClick={() => act(tool.id, "rejected")}
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
