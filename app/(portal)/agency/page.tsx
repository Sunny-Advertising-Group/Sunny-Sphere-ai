import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { AgencyTabs } from "./AgencyTabs";

function formatMonth(wrapMonth: string) {
  return new Date(`${wrapMonth}T00:00:00Z`).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function AgencyPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const supabase = await createClient();
  const [{ data: policies }, { data: keyResources }, { data: faqs }, { data: acronyms }, { data: latestWrap }] =
    await Promise.all([
      supabase.from("resources").select("*").eq("section", "policy").order("sort_order"),
      supabase.from("resources").select("*").eq("section", "key_resource").order("sort_order"),
      supabase.from("resources").select("*").eq("section", "faq").order("sort_order"),
      supabase.from("resources").select("*").eq("section", "acronym").order("sort_order"),
      supabase.from("monthly_wraps").select("wrap_month, title").order("wrap_month", { ascending: false }).limit(1).maybeSingle(),
    ]);

  return (
    <div>
      <PageHeader
        title="Agency"
        description="Policies, key resources, FAQs, and the acronym library — everything agency-wide in one place."
      />
      <div className="px-8 pt-8">
        <Link
          href="/agency/monthly-wraps"
          className="flex items-center justify-between gap-4 rounded-2xl border border-gold/40 bg-gold/10 px-5 py-4 transition-colors hover:border-gold"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 flex-none text-ink" strokeWidth={2} aria-hidden />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-ink">Monthly Wraps</div>
              <p className="mt-0.5 text-sm text-charcoal">
                {latestWrap
                  ? `${latestWrap.title || `${formatMonth(latestWrap.wrap_month)} Wrap`} is up — see every wrap`
                  : "Nothing uploaded yet — see every wrap"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 flex-none text-charcoal" strokeWidth={2} aria-hidden />
        </Link>
      </div>
      <AgencyTabs
        policies={policies ?? []}
        keyResources={keyResources ?? []}
        faqs={faqs ?? []}
        acronyms={acronyms ?? []}
      />
    </div>
  );
}
