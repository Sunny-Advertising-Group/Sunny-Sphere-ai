import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { LifeBuoy } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { TicketForm } from "./TicketForm";

const FAQS = [
  { q: "How do I get access to a restricted section?", a: "Ask an admin — they can grant it from the Admin page." },
  { q: "Where do I find AI tools?", a: "Head to the Tools tab — search or filter by category." },
  { q: "How do I request a new AI tool?", a: "Use \"Could this be AI'd?\" to submit an idea to the AI Champs." },
];

export default async function SupportPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("support_tickets")
    .select("id, body, status, created_at")
    .eq("raised_by", visibility.profile.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title="Support" description="FAQs, plus a place to raise anything that's blocking you." />
      <div className="space-y-10 p-8">
        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">FAQs</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {FAQS.map((f) => (
              <Card key={f.q}>
                <div className="text-sm font-semibold text-ink">{f.q}</div>
                <p className="mt-1 text-sm text-charcoal">{f.a}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-bold text-ink">Raise a ticket</h2>
            <TicketForm />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold text-ink">Your tickets</h2>
            {!mine || mine.length === 0 ? (
              <EmptyState icon={LifeBuoy} title="No tickets yet" />
            ) : (
              <div className="space-y-3">
                {mine.map((t) => (
                  <Card key={t.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-ink">{t.body}</p>
                      <Pill tone={t.status === "open" ? "gold" : "muted"}>{t.status}</Pill>
                    </div>
                    <div className="mt-2 text-xs text-charcoal">{new Date(t.created_at).toLocaleDateString()}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
