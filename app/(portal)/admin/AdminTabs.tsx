"use client";

import { useState, type ReactNode } from "react";
import { Building2, LayoutGrid, Users } from "lucide-react";

type Tab = "sections" | "clients" | "people";

const TABS: { key: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { key: "sections", label: "Sections", icon: LayoutGrid },
  { key: "clients", label: "Clients — ATL & Digital", icon: Building2 },
  { key: "people", label: "People, access & invites", icon: Users },
];

// Clients — ATL & Digital and People, access & invites both outgrew the
// click-to-open-a-modal card grid (full management surfaces with nested
// pickers/tables, not a quick add/edit form), so they get their own
// top-level tabs instead. Everything else stays in the grid under
// "Sections".
export function AdminTabs({
  initialTab = "sections",
  sectionsContent,
  clientsContent,
  peopleContent,
}: {
  initialTab?: Tab;
  sectionsContent: ReactNode;
  clientsContent: ReactNode;
  peopleContent: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const content = tab === "sections" ? sectionsContent : tab === "clients" ? clientsContent : peopleContent;

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-border-c bg-white px-8 py-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.key ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> {t.label}
          </button>
        ))}
      </div>
      <div className="p-8">{content}</div>
    </div>
  );
}
