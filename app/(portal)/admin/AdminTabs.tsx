"use client";

import { useState, type ReactNode } from "react";
import { Building2, LayoutGrid } from "lucide-react";

// Clients — ATL & Digital outgrew the click-to-open-a-modal card grid (it's
// a full management surface with nested pickers, not a quick add/edit form),
// so it gets its own top-level tab instead. Everything else stays in the
// grid under "Sections".
export function AdminTabs({
  initialTab = "sections",
  sectionsContent,
  clientsContent,
}: {
  initialTab?: "sections" | "clients";
  sectionsContent: ReactNode;
  clientsContent: ReactNode;
}) {
  const [tab, setTab] = useState<"sections" | "clients">(initialTab);

  return (
    <div>
      <div className="flex gap-2 border-b border-border-c bg-white px-8 py-4">
        <button
          onClick={() => setTab("sections")}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            tab === "sections" ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Sections
        </button>
        <button
          onClick={() => setTab("clients")}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            tab === "clients" ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Clients — ATL & Digital
        </button>
      </div>
      <div className="p-8">{tab === "sections" ? sectionsContent : clientsContent}</div>
    </div>
  );
}
