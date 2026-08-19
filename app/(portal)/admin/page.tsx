import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { AccordionGroup, AccordionItem } from "@/components/Accordion";
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
import { DigitalClientsManager, type LeadOption } from "./DigitalClientsManager";
import { DigitalOptiLogViewer, type OptiLogRow } from "./DigitalOptiLogViewer";

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
    { data: digitalClients },
    { data: digitalChannels },
    { data: rawOptiLogs },
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
    supabase.from("atl_links").select("id, client_id, kind, title, url, version_label, cadence").order("sort_order"),
    supabase
      .from("digital_clients")
      .select("id, name, colour, lead_id, retainer, wip_doc_url, status")
      .order("name"),
    supabase
      .from("digital_client_channels")
      .select("id, client_id, channel, cadence, is_active"),
    supabase
      .from("digital_opti_logs")
      .select(
        "id, completed_at, voided_at, completed_by:profiles!digital_opti_logs_completed_by_fkey(full_name, email), voided_by:profiles!digital_opti_logs_voided_by_fkey(full_name, email), channel:digital_client_channels(channel, client:digital_clients(name))",
      )
      .order("completed_at", { ascending: false })
      .limit(200),
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

  const leadOptions: LeadOption[] = (profiles ?? []).map((p) => ({
    id: p.id,
    label: p.full_name || p.email,
  }));

  const optiLogs: OptiLogRow[] = (rawOptiLogs ?? [])
    .filter((l) => l.channel)
    .map((l) => {
      const channel = l.channel as unknown as { channel: string; client: { name: string } | null };
      const completedBy = l.completed_by as unknown as { full_name: string | null; email: string } | null;
      const voidedBy = l.voided_by as unknown as { full_name: string | null; email: string } | null;
      return {
        id: l.id,
        clientName: channel.client?.name ?? "Unknown",
        channel: channel.channel,
        completedByName: completedBy?.full_name || completedBy?.email || "Unknown",
        completedAt: l.completed_at,
        voidedAt: l.voided_at,
        voidedByName: voidedBy?.full_name || voidedBy?.email || null,
      };
    });

  return (
    <div>
      <PageHeader title="Admin" description="Everything content-related lives here — invites, review queues, and full add/edit/delete for every section." />
      <div className="p-8">
        <AccordionGroup>
          <AccordionItem id="invite" title="Invite someone">
            <InviteForm />
          </AccordionItem>

          <AccordionItem id="tools-pending" title={`Tools pending review (${pendingTools?.length ?? 0})`}>
            <ToolQueue tools={pendingTools ?? []} />
          </AccordionItem>

          <AccordionItem id="tools-published" title="Published tools">
            <PublishedToolsList tools={publishedTools ?? []} />
          </AccordionItem>

          <AccordionItem id="tips-pending" title={`Tips & prompts pending review (${pendingTips?.length ?? 0})`}>
            <TipQueue tips={pendingTips ?? []} />
          </AccordionItem>

          <AccordionItem id="tips-published" title="Published tips & prompts">
            <PublishedTipsList tips={publishedTips ?? []} />
          </AccordionItem>

          <AccordionItem id="ai-requests" title="Could this be AI'd? inbox">
            <RequestsInbox requests={aiRequests ?? []} />
          </AccordionItem>

          <AccordionItem id="tickets" title="Support tickets">
            <TicketsInbox tickets={tickets ?? []} />
          </AccordionItem>

          <AccordionItem id="agency-policies" title="Agency — policies & resources">
            <div className="mb-4">
              <AddResourceForm section="policy" label="+ Add policy / resource" />
            </div>
            <ResourceList items={policies ?? []} />
          </AccordionItem>

          <AccordionItem id="agency-faqs" title="Agency — FAQs">
            <div className="mb-4">
              <AddResourceForm section="faq" label="+ Add FAQ" showBody />
            </div>
            <ResourceList items={faqs ?? []} showBody />
          </AccordionItem>

          <AccordionItem id="learning-paths" title="Learning — paths">
            <div className="mb-4">
              <AddResourceForm section="learning_path" label="+ Add path" showDuration />
            </div>
            <ResourceList items={learningPaths ?? []} showDuration />
          </AccordionItem>

          <AccordionItem id="learning-videos" title="Learning — training videos">
            <div className="mb-4">
              <AddResourceForm section="loom" label="+ Add video" showDuration />
            </div>
            <ResourceList items={loomVideos ?? []} showDuration />
          </AccordionItem>

          <AccordionItem id="atl-manager" title="ATL — clients & links">
            <AtlManager clients={clients ?? []} links={atlLinks ?? []} />
          </AccordionItem>

          <AccordionItem id="digital-clients" title="Digital — clients & channels">
            <DigitalClientsManager
              clients={digitalClients ?? []}
              channels={digitalChannels ?? []}
              leads={leadOptions}
            />
          </AccordionItem>

          <AccordionItem id="digital-opti-log" title="Digital — optimisation log">
            <DigitalOptiLogViewer logs={optiLogs} />
          </AccordionItem>

          <AccordionItem id="people" title="People & access">
            <PeopleTable people={people} />
          </AccordionItem>
        </AccordionGroup>
      </div>
    </div>
  );
}
