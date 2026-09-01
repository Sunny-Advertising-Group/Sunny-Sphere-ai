"use server";

import { createClient } from "@/lib/supabase/server";
import { getVisibility } from "@/lib/access";
import { NAV_ITEMS } from "@/lib/nav";

export type SearchResultItem = { id: string; label: string; sublabel?: string; href: string };
export type SearchResults = {
  pages: SearchResultItem[];
  tools: SearchResultItem[];
  clients: SearchResultItem[];
  howTos: SearchResultItem[];
};

const EMPTY_RESULTS: SearchResults = { pages: [], tools: [], clients: [], howTos: [] };
const HOWTO_SECTIONS = ["policy", "faq", "learning_path", "loom"];

// Plain keyword search — no LLM call. Matches happen server-side per table
// (RLS already scopes clients/resources correctly, e.g. an ATL/Digital
// client just returns nothing to someone without that section) so results
// never leak more than the person could already see on the real pages.
export async function searchSunnySphere(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return EMPTY_RESULTS;

  const visibility = await getVisibility();
  if (!visibility) return EMPTY_RESULTS;

  const supabase = await createClient();
  const like = `%${q.replace(/[%,]/g, "")}%`;

  const [{ data: tools }, { data: clients }, { data: resources }] = await Promise.all([
    supabase
      .from("tools")
      .select("id, name, category")
      .eq("status", "published")
      .or(`name.ilike.${like},description.ilike.${like},category.ilike.${like}`)
      .limit(5),
    supabase.from("clients").select("id, name, on_atl").eq("is_active", true).ilike("name", like).limit(5),
    supabase
      .from("resources")
      .select("id, title, description, section")
      .in("section", HOWTO_SECTIONS)
      .or(`title.ilike.${like},description.ilike.${like},body.ilike.${like}`)
      .limit(5),
  ]);

  const pages: SearchResultItem[] = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !visibility.isAdmin) return false;
    if (item.section && !visibility.canSee(item.section)) return false;
    return item.label.toLowerCase().includes(q.toLowerCase());
  }).map((item) => ({ id: item.href, label: item.label, href: item.href }));

  return {
    pages,
    tools: (tools ?? []).map((t) => ({
      id: String(t.id),
      label: t.name,
      sublabel: t.category,
      href: "/tools",
    })),
    clients: (clients ?? []).map((c) => ({
      id: String(c.id),
      label: c.name,
      href: c.on_atl ? `/atl/${encodeURIComponent(c.name)}` : "/digital-opti",
    })),
    howTos: (resources ?? []).map((r) => ({
      id: String(r.id),
      label: r.title,
      sublabel: r.description ?? undefined,
      href: r.section === "policy" || r.section === "faq" ? "/agency" : "/learning",
    })),
  };
}
