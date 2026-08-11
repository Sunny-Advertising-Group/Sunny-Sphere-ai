"use client";

import { useState, useTransition } from "react";
import { deleteTool } from "@/lib/actions/admin";
import { Card, EmptyState, Pill } from "@/components/ui";

export type PublishedTool = {
  id: number;
  name: string;
  category: string;
  tool_type: string;
  use_count: number | null;
};

export function PublishedToolsList({ tools }: { tools: PublishedTool[] }) {
  const [items, setItems] = useState(tools);
  const [, startTransition] = useTransition();

  function remove(id: number) {
    if (!confirm("Delete this tool? This can't be undone.")) return;
    setItems((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await deleteTool(id);
    });
  }

  if (items.length === 0) return <EmptyState title="No published tools yet" />;

  return (
    <div className="space-y-2">
      {items.map((tool) => (
        <Card key={tool.id} className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">{tool.name}</span>
            <Pill tone="gold">{tool.tool_type}</Pill>
            <Pill>{tool.category}</Pill>
            <span className="text-xs text-charcoal">{tool.use_count ?? 0} opens</span>
          </div>
          <button onClick={() => remove(tool.id)} className="text-xs font-semibold text-red-600 hover:underline">
            Delete
          </button>
        </Card>
      ))}
    </div>
  );
}
