import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { AgencyTabs } from "./AgencyTabs";

export default async function AgencyPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const supabase = await createClient();
  const [{ data: policies }, { data: keyResources }, { data: faqs }, { data: acronyms }] = await Promise.all([
    supabase.from("resources").select("*").eq("section", "policy").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "key_resource").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "faq").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "acronym").order("sort_order"),
  ]);

  return (
    <div>
      <PageHeader
        title="Agency"
        description="Policies, key resources, FAQs, and the acronym library — everything agency-wide in one place."
      />
      <AgencyTabs
        policies={policies ?? []}
        keyResources={keyResources ?? []}
        faqs={faqs ?? []}
        acronyms={acronyms ?? []}
      />
    </div>
  );
}
