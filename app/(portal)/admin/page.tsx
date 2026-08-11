import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { AddResourceForm } from "@/components/AddResourceForm";
import { InviteForm } from "./InviteForm";
import { ToolQueue } from "./ToolQueue";
import { TipQueue } from "./TipQueue";
import { PublishedToolsList } from "./PublishedToolsList";
import { PublishedTipsList } from "./PublishedTipsList";
import { RequestsInbox } from "./RequestsInbox";
import { TicketsInbox } from "./TicketsInbox";
import { PeopleTable, type Person } from "./PeopleTable";
import { ResourceList } from "./ResourceList";
import { AtlManager } from "./AtlManager";

export default async function AdminPage() {
  const visibility = await getVisibility();
  if (!visibility || !visibility.isAdmin) redirect("/");

  const supabase = await createClient();

  const [
    { data: pendingTools },
    { data: publishedTools },
    { data: pendingTips },
    { data: publishedTips },
    { data: aiRequests },
    { data: tickets },
    { data: profiles },
    { data: grants },
    { data: policies },
    { data: faqs },
    { data: learningPaths },
    { data: loomVideos },
    { data: clients },
    { data: atlLinks },
  ] = await Promise.all([
    supabase
      .from("tools")
      .select("id, name, category, tool_type, description, status")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("tools")
      .select("id, name, category, tool_type, use_count")
      .eq("status", "published")
      .order("name"),
    supabase
      .from("tips")
      .select("id, title, body, category, is_prompt")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("tips")
      .select("id, title, body, is_prompt")
      .eq("status", "published")
      .order("created_at", { ascending: false }),
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
    supabase.from("resources").select("*").eq("section", "policy").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "faq").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "learning_path").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "loom").order("sort_order"),
    supabase.from("clients").select("id, name, colour, team, is_active").order("name"),
    supabase.from("atl_links").select("id, client_id, kind, title, url, version_label").order("sort_order"),
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
      <PageHeader title="Admin" description="Everything content-related lives here — invites, review queues, and full add/edit/delete for every section." />
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
          <h2 className="mb-3 text-sm font-bold text-ink">Published tools</h2>
          <PublishedToolsList tools={publishedTools ?? []} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-ink">Tips & prompts pending review ({pendingTips?.length ?? 0})</h2>
          <TipQueue tips={pendingTips ?? []} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-ink">Published tips & prompts</h2>
          <PublishedTipsList tips={publishedTips ?? []} />
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
          <h2 className="mb-4 text-sm font-bold text-ink">Agency — policies & resources</h2>
          <div className="mb-4">
            <AddResourceForm section="policy" label="+ Add policy / resource" />
          </div>
          <ResourceList items={policies ?? []} />
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold text-ink">Agency — FAQs</h2>
          <div className="mb-4">
            <AddResourceForm section="faq" label="+ Add FAQ" showBody />
          </div>
          <ResourceList items={faqs ?? []} showBody />
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold text-ink">Learning — paths</h2>
          <div className="mb-4">
            <AddResourceForm section="learning_path" label="+ Add path" showDuration />
          </div>
          <ResourceList items={learningPaths ?? []} showDuration />
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold text-ink">Learning — training videos</h2>
          <div className="mb-4">
            <AddResourceForm section="loom" label="+ Add video" showDuration />
          </div>
          <ResourceList items={loomVideos ?? []} showDuration />
        </section>

        <section id="atl-manager">
          <h2 className="mb-4 text-sm font-bold text-ink">ATL — clients & links</h2>
          <AtlManager clients={clients ?? []} links={atlLinks ?? []} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-ink">People & access</h2>
          <PeopleTable people={people} />
        </section>
      </div>
    </div>
  );
}
