import { notFound, redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";

function formatMonth(wrapMonth: string) {
  return new Date(`${wrapMonth}T00:00:00Z`).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function MonthlyWrapPage({ params }: { params: Promise<{ id: string }> }) {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();
  const { data: wrap } = await supabase
    .from("monthly_wraps")
    .select("id, wrap_month, title")
    .eq("id", id)
    .single();
  if (!wrap) notFound();

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title={wrap.title || `${formatMonth(wrap.wrap_month)} Wrap`}
        backHref="/agency/monthly-wraps"
        backLabel="All wraps"
      />
      <iframe
        src={`/agency/monthly-wraps/${wrap.id}/raw`}
        title={wrap.title || `${formatMonth(wrap.wrap_month)} Wrap`}
        sandbox="allow-scripts allow-same-origin allow-popups"
        referrerPolicy="no-referrer"
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
