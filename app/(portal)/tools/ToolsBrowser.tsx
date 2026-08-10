"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, Input, Pill } from "@/components/ui";

export type Tool = {
  id: number;
  name: string;
  tool_type: string;
  category: string;
  description: string;
  how_to_use: string | null;
  link_url: string | null;
  file_path: string | null;
  status: string;
  use_count: number | null;
  owner_id: string | null;
};

export function ToolsBrowser({ tools, isOwnerView }: { tools: Tool[]; isOwnerView?: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Tool | null>(null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(tools.map((t) => t.category))).sort()],
    [tools],
  );

  const filtered = tools.filter((tool) => {
    const matchesCategory = category === "All" || tool.category === category;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      tool.name.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-border-c bg-white px-8 py-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools…"
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                category === c ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">
        {filtered.length === 0 ? (
          <EmptyState
            icon="🔧"
            title={isOwnerView ? "Nothing pending" : "No tools found"}
            description={isOwnerView ? undefined : "Try a different search or category."}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tool) => (
              <button key={tool.id} onClick={() => setSelected(tool)} className="text-left">
                <Card className="h-full transition-colors hover:border-gold/50">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Pill tone="gold">{tool.tool_type}</Pill>
                    {tool.status !== "published" && <Pill tone="muted">{tool.status}</Pill>}
                  </div>
                  <div className="font-semibold text-ink">{tool.name}</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-charcoal">
                    {tool.category}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-charcoal">{tool.description}</p>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && <ToolModal tool={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ToolModal({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const [opening, setOpening] = useState(false);

  async function handleOpen() {
    setOpening(true);
    const supabase = createClient();
    await supabase.rpc("increment_tool_use", { tool_id: tool.id });

    if (tool.file_path) {
      const { data } = await supabase.storage.from("tools").createSignedUrl(tool.file_path, 60);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } else if (tool.link_url) {
      window.open(tool.link_url, "_blank", "noopener,noreferrer");
    }
    setOpening(false);
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
    >
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-charcoal hover:text-ink" aria-label="Close">
          ✕
        </button>
        <Pill tone="gold">{tool.category}</Pill>
        <h2 className="mt-3 text-lg font-extrabold text-ink">{tool.name}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-charcoal">{tool.description}</p>
        {tool.how_to_use && (
          <div className="mt-4 rounded-xl bg-bg p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-charcoal">How to use it</div>
            <p className="whitespace-pre-wrap text-sm text-ink">{tool.how_to_use}</p>
          </div>
        )}
        {(tool.link_url || tool.file_path) && (
          <button
            onClick={handleOpen}
            disabled={opening}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {opening ? "Opening…" : "Open tool →"}
          </button>
        )}
      </div>
    </div>
  );
}
