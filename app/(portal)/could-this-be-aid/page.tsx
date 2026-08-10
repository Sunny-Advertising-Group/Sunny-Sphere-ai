import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { Lightbulb } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { AiRequestForm } from "./AiRequestForm";

const STATUS_TONE: Record<string, "gold" | "muted" | "default"> = {
  new: "muted",
  in_review: "default",
  building: "gold",
  shipped: "gold",
  parked: "muted",
};

export default async function CouldThisBeAidPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("ai_requests")
    .select("id, task, status, created_at")
    .eq("submitted_by", visibility.profile.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title="Could this be AI'd?" description="Tell the AI Champs about a task that's crying out for automation." />
      <div className="grid grid-cols-1 gap-8 p-8 lg:grid-cols-2">
        <AiRequestForm />
        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">Your submissions</h2>
          {!mine || mine.length === 0 ? (
            <EmptyState icon={Lightbulb} title="Nothing submitted yet" />
          ) : (
            <div className="space-y-3">
              {mine.map((r) => (
                <Card key={r.id}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-ink">{r.task}</p>
                    <Pill tone={STATUS_TONE[r.status ?? "new"] ?? "default"}>{r.status}</Pill>
                  </div>
                  <div className="mt-2 text-xs text-charcoal">{new Date(r.created_at).toLocaleDateString()}</div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
