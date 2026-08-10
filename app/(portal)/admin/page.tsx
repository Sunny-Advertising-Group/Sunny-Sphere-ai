import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { InviteForm } from "./InviteForm";
import { ToolQueue } from "./ToolQueue";
import { RequestsInbox } from "./RequestsInbox";
import { TicketsInbox } from "./TicketsInbox";
import { PeopleTable, type Person } from "./PeopleTable";

export default async function AdminPage() {
  const visibility = await getVisibility();
  if (!visibility || !visibility.isAdmin) redirect("/");

  const supabase = await createClient();

  const [{ data: pendingTools }, { data: aiRequests }, { data: tickets }, { data: profiles }, { data: grants }] =
    await Promise.all([
      supabase
        .from("tools")
        .select("id, name, category, tool_type, description, status")
        .eq("status", "pending")
        .order("created_at"),
      supabase
        .from("ai_requests")
        .select("id, task, frequency, hours_estimate, status")
        .neq("status", "shipped")
        .neq("status", "parked")
        .order("created_at", { ascending: false }),
      supabase
        .from("support_tickets")
        .select("id, body, category, urgency, status")
        .neq("status", "resolved")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, full_name, team, role").order("email"),
      supabase.from("section_access").select("user_id, section"),
    ]);

  const grantsByUser = new Map<string, string[]>();
  for (const g of grants ?? []) {
    const list = grantsByUser.get(g.user_id) ?? [];
    list.push(g.section);
    grantsByUser.set(g.user_id, list);
  }

  const people: Person[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    team: p.team,
    role: p.role,
    grantedSections: grantsByUser.get(p.id) ?? [],
  }));

  return (
    <div>
      <PageHeader title="Admin" description="Invite people, review submissions, and manage access." />
      <div className="space-y-10 p-8">
        <section>
          <h2 className="mb-3 text-sm font-bold text-ink">Invite someone</h2>
          <InviteForm />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-ink">Tools pending review ({pendingTools?.length ?? 0})</h2>
          <ToolQueue tools={pendingTools ?? []} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-ink">Could this be AI&rsquo;d? inbox</h2>
          <RequestsInbox requests={aiRequests ?? []} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-ink">Support tickets</h2>
          <TicketsInbox tickets={tickets ?? []} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-ink">People & access</h2>
          <PeopleTable people={people} />
        </section>
      </div>
    </div>
  );
}
