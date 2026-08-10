import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { Building2, HelpCircle } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PolicyCard } from "./PolicyCard";

export default async function AgencyPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const supabase = await createClient();
  const [{ data: policies }, { data: faqs }] = await Promise.all([
    supabase.from("resources").select("*").eq("section", "policy").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "faq").order("sort_order"),
  ]);

  const groups = (policies ?? []).reduce<Record<string, typeof policies>>((acc, r) => {
    const key = r.group_name || "General";
    (acc[key] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Agency" description="Policies, guides and answers to the questions that come up most." />
      <div className="space-y-10 p-8">
        <div>
          {Object.keys(groups).length === 0 ? (
            <EmptyState icon={Building2} title="Nothing added yet" />
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-8">
                <h2 className="mb-3 text-sm font-bold text-ink">{group}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items!.map((r) => (
                    <PolicyCard key={r.id} policy={r} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">FAQs</h2>
          {!faqs || faqs.length === 0 ? (
            <EmptyState icon={HelpCircle} title="No FAQs yet" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {faqs.map((f) => (
                <Card key={f.id}>
                  <div className="font-semibold text-ink">{f.title}</div>
                  {f.body && <p className="mt-1 text-sm text-charcoal">{f.body}</p>}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
