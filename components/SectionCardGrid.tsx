"use client";

import { useState, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";

export type SectionCardDef = {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  badge?: string | number;
  content: ReactNode;
};

// Grid of clickable cards that open a modal with the section's full content —
// same pattern as the Tools browser (grid of cards -> click -> modal), rather
// than an always-expanded accordion, so the admin page reads as a set of
// distinct destinations instead of one long scrolling document.
export function SectionCardGrid({
  sections,
  initialSectionId = null,
}: {
  sections: SectionCardDef[];
  initialSectionId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSectionId);
  const selected = sections.find((s) => s.id === selectedId) ?? null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <button key={s.id} onClick={() => setSelectedId(s.id)} className="text-left">
            <Card className="h-full transition-colors hover:border-gold/50">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gold/15 text-gold">
                  <s.icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{s.title}</div>
                  {s.description && <div className="mt-0.5 text-xs text-charcoal">{s.description}</div>}
                </div>
                {s.badge !== undefined && s.badge !== "" && (
                  <span className="ml-auto flex-none rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-ink">
                    {s.badge}
                  </span>
                )}
              </div>
            </Card>
          </button>
        ))}
      </div>

      {selected && (
        <div
          onClick={() => setSelectedId(null)}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative my-8 w-full max-w-3xl rounded-2xl bg-white p-8 shadow-xl"
          >
            <button
              onClick={() => setSelectedId(null)}
              className="absolute right-4 top-4 text-charcoal hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gold/15 text-gold">
                <selected.icon className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <h2 className="text-lg font-extrabold text-ink">{selected.title}</h2>
            </div>
            {selected.content}
          </div>
        </div>
      )}
    </>
  );
}
