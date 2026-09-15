import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { MonthlyWrapsGrid } from "./MonthlyWrapsGrid";

const WRAPS_OWNER_EMAIL = "lily@sunnyadvertising.com.au";

export default async function MonthlyWrapsPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const canUpload = visibility.profile.email === WRAPS_OWNER_EMAIL;

  const supabase = await createClient();
  const { data: wraps } = await supabase
    .from("monthly_wraps")
    .select("id, wrap_month, title")
    .order("wrap_month", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Monthly Wraps"
        description="Every monthly wrap-up, opened right here in Sunny Sphere."
        backHref="/agency"
        backLabel="Back to Agency"
        action={canUpload ? <LinkButton href="/agency/monthly-wraps/upload">+ Upload this month&apos;s wrap</LinkButton> : undefined}
      />
      <div className="p-8">
        {!wraps || wraps.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No wraps uploaded yet"
            description={canUpload ? "Upload the first monthly wrap to get started." : "Check back once this month's wrap is up."}
          />
        ) : (
          <MonthlyWrapsGrid wraps={wraps} canUpload={canUpload} />
        )}
      </div>
    </div>
  );
}
