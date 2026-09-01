"use client";

import { useMemo, useState } from "react";
import { BookOpen, Building2, HelpCircle, Sparkles } from "lucide-react";
import { EmptyState, Input } from "@/components/ui";
import { PolicyCard, type Policy } from "./PolicyCard";

type ResourceRow = Policy & { group_name: string | null };

const TABS = [
  { key: "policies", label: "Policies", icon: Building2 },
  { key: "key_resources", label: "Key Resources", icon: Sparkles },
  { key: "faqs", label: "FAQs", icon: HelpCircle },
  { key: "acronyms", label: "Acronym Library", icon: BookOpen },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function matches(item: ResourceRow, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    (item.description ?? "").toLowerCase().includes(q) ||
    (item.body ?? "").toLowerCase().includes(q)
  );
}

function groupByName(items: ResourceRow[]): Record<string, ResourceRow[]> {
  return items.reduce<Record<string, ResourceRow[]>>((acc, r) => {
    const key = r.group_name || "General";
    (acc[key] ??= []).push(r);
    return acc;
  }, {});
}

export function AgencyTabs({
  policies,
  keyResources,
  faqs,
  acronyms,
}: {
  policies: ResourceRow[];
  keyResources: ResourceRow[];
  faqs: ResourceRow[];
  acronyms: ResourceRow[];
}) {
  const [tab, setTab] = useState<TabKey>("policies");
  const [search, setSearch] = useState("");

  const byTab: Record<TabKey, ResourceRow[]> = { policies, key_resources: keyResources, faqs, acronyms };
  const filtered = useMemo(
    () => byTab[tab].filter((item) => matches(item, search)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- byTab is rebuilt every render from these same props
    [tab, search, policies, keyResources, faqs, acronyms],
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.key ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {t.label}
              <span className="opacity-60">{byTab[t.key].length}</span>
            </button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${TABS.find((t) => t.key === tab)!.label.toLowerCase()}…`}
          className="max-w-xs"
        />
      </div>

      {tab === "acronyms" ? (
        <AcronymGrid items={filtered} />
      ) : (
        <GroupedGrid items={filtered} emptyIcon={TABS.find((t) => t.key === tab)!.icon} />
      )}
    </div>
  );
}

function GroupedGrid({ items, emptyIcon }: { items: ResourceRow[]; emptyIcon: typeof Building2 }) {
  if (items.length === 0) return <EmptyState icon={emptyIcon} title="Nothing here yet" />;

  const groups = groupByName(items);
  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([group, groupItems]) => (
        <div key={group}>
          <h2 className="mb-3 text-sm font-bold text-ink">{group}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupItems.map((item) => (
              <PolicyCard key={item.id} policy={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Acronyms are meant to be scanned, not clicked into — a dense alphabetised
// grid of term + meaning, no expand/modal like the other tabs.
function AcronymGrid({ items }: { items: ResourceRow[] }) {
  if (items.length === 0) return <EmptyState icon={BookOpen} title="No acronyms added yet" />;

  const sorted = items.slice().sort((a, b) => a.title.localeCompare(b.title));
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((item) => (
        <div key={item.id} className="flex gap-2 border-b border-border-c pb-2">
          <span className="flex-none font-bold text-gold">{item.title}</span>
          <span className="text-sm text-charcoal">{item.body}</span>
        </div>
      ))}
    </div>
  );
}
