import {
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  Link2,
  Sparkles,
  Tag,
  UserPlus,
  Users,
  Video,
  Wrench,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import { SectionCardGrid, type SectionCardDef } from "@/components/SectionCardGrid";
import type { PersonOption } from "@/components/AssigneePicker";
import { AddResourceForm } from "@/components/AddResourceForm";
import { InviteForm } from "./InviteForm";
import { ToolQueue } from "./ToolQueue";
import { ToolCategoriesManager } from "./ToolCategoriesManager";
import { TipQueue } from "./TipQueue";
import { PublishedToolsList } from "./PublishedToolsList";
import { RequestsInbox } from "./RequestsInbox";
import { PeopleTable, type Person } from "./PeopleTable";
import { TwoFactorSetup } from "./TwoFactorSetup";
import { ResourceList } from "./ResourceList";
import { ClientsManager } from "./ClientsManager";
import { DigitalOptiLogViewer, type OptiLogRow } from "./DigitalOptiLogViewer";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const visibility = await getVisibility();
  if (!visibility || !visibility.isAdmin) redirect("/");
  const { section } = await searchParams;

  const supabase = await createClient();

  const [
    { data: pendingTools },
    { data: publishedTools },
    { data: pendingTips },
    { data: aiRequests },
    { data: profiles },
    { data: grants },
    { data: policies },
    { data: keyResources },
    { data: faqs },
    { data: acronyms },
    { data: dashboardDocs },
    { data: dashboardNotifications },
    { data: dashboardLinks },
    { data: learningPaths },
    { data: loomVideos },
    { data: clients },
    { data: atlLinks },
    { data: atlAssignees },
    { data: pendingAssignments },
    { data: digitalChannels },
    { data: digitalAssignees },
    { data: channelOwners },
    { data: clientOwners },
    { data: rawOptiLogs },
    { data: tiers },
    { data: toolCategories },
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
      .from("ai_requests")
      .select("id, task, frequency, hours_estimate, status")
      .neq("status", "shipped")
      .neq("status", "parked")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, email, full_name, team, role").order("email"),
    supabase.from("section_access").select("user_id, section"),
    supabase.from("resources").select("*").eq("section", "policy").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "key_resource").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "faq").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "acronym").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "dashboard_doc").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "dashboard_notification").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "dashboard_link").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "learning_path").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "loom").order("sort_order"),
    supabase
      .from("clients")
      .select(
        "id, name, colour, team, is_active, on_atl, on_digital, wip_doc_url, retainer, digital_status, digital_cadence, digital_tier_id, account_lead_id",
      )
      .order("name"),
    supabase.from("atl_links").select("id, client_id, kind, title, url, version_label, cadence").order("sort_order"),
    supabase.from("atl_client_assignees").select("client_id, profile_id"),
    supabase.from("pending_client_assignments").select("id, email, client_id, kind, channel, split_pct").order("created_at"),
    supabase.from("digital_client_channels").select("id, client_id, channel, is_active"),
    supabase.from("digital_client_assignees").select("client_id, profile_id"),
    supabase.from("digital_channel_owners").select("id, client_channel_id, profile_id"),
    supabase.from("digital_client_owners").select("id, client_id, profile_id, split_pct"),
    supabase
      .from("digital_opti_logs")
      .select(
        "id, completed_at, voided_at, completed_by:profiles!digital_opti_logs_completed_by_fkey(full_name, email), voided_by:profiles!digital_opti_logs_voided_by_fkey(full_name, email), channel:digital_client_channels(channel, client:clients(name))",
      )
      .order("completed_at", { ascending: false })
      .limit(200),
    supabase.from("client_tiers").select("id, name, colour").order("sort_order"),
    supabase.from("tool_categories").select("id, name").order("name"),
  ]);

  const grantsByUser = new Map<string, string[]>();
  for (const g of grants ?? []) {
    const list = grantsByUser.get(g.user_id) ?? [];
    list.push(g.section);
    grantsByUser.set(g.user_id, list);
  }

  const { data: mfaData } = await supabase.auth.mfa.listFactors();
  const hasTotp = (mfaData?.totp ?? []).some((f) => f.status === "verified");

  const admin = createAdminClient();
  const { data: authUsersData } = await admin.auth.admin.listUsers({ perPage: 200 });
  const lastSignInById = new Map(
    (authUsersData?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
  );

  const people: Person[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    team: p.team,
    role: p.role,
    grantedSections: grantsByUser.get(p.id) ?? [],
    lastSignInAt: lastSignInById.get(p.id) ?? null,
  }));

  const personOptions: PersonOption[] = (profiles ?? []).map((p) => ({
    id: p.id,
    label: p.full_name || p.email,
  }));

  function groupAssignees(rows: { client_id: number; profile_id: string }[] | null): Record<number, string[]> {
    const map: Record<number, string[]> = {};
    for (const row of rows ?? []) {
      map[row.client_id] = [...(map[row.client_id] ?? []), row.profile_id];
    }
    return map;
  }
  const atlAssigneesByClient = groupAssignees(atlAssignees);
  const digitalAssigneesByClient = groupAssignees(digitalAssignees);

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

  const sections: SectionCardDef[] = [
    {
      id: "invite",
      title: "Invite someone",
      icon: <UserPlus className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: <InviteForm />,
    },
    {
      id: "tools-pending",
      title: "Tools pending review",
      icon: <Wrench className="h-5 w-5" strokeWidth={2} aria-hidden />,
      badge: pendingTools?.length ?? 0,
      content: <ToolQueue tools={pendingTools ?? []} />,
    },
    {
      id: "tools-published",
      title: "Published tools",
      icon: <CheckCircle2 className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: <PublishedToolsList tools={publishedTools ?? []} />,
    },
    {
      id: "tool-categories",
      title: "Tool categories",
      icon: <Tag className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: <ToolCategoriesManager categories={toolCategories ?? []} />,
    },
    {
      id: "tips-pending",
      title: "Tips & prompts pending review",
      icon: <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />,
      badge: pendingTips?.length ?? 0,
      content: <TipQueue tips={pendingTips ?? []} />,
    },
    {
      id: "ai-requests",
      title: "Could this be AI'd? inbox",
      icon: <Lightbulb className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: <RequestsInbox requests={aiRequests ?? []} />,
    },
    {
      id: "agency-policies",
      title: "Agency — policies & resources",
      icon: <FileText className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <>
          <div className="mb-4">
            <AddResourceForm section="policy" label="+ Add policy / resource" />
          </div>
          <ResourceList items={policies ?? []} />
        </>
      ),
    },
    {
      id: "agency-key-resources",
      title: "Agency — key resources",
      icon: <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <>
          <div className="mb-4">
            <AddResourceForm section="key_resource" label="+ Add key resource" />
          </div>
          <ResourceList items={keyResources ?? []} />
        </>
      ),
    },
    {
      id: "agency-faqs",
      title: "Agency — FAQs",
      icon: <HelpCircle className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <>
          <div className="mb-4">
            <AddResourceForm section="faq" label="+ Add FAQ" showBody />
          </div>
          <ResourceList items={faqs ?? []} showBody />
        </>
      ),
    },
    {
      id: "agency-acronyms",
      title: "Agency — acronym library",
      icon: <BookOpen className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <>
          <div className="mb-4">
            <AddResourceForm section="acronym" label="+ Add acronym" showBody />
          </div>
          <ResourceList items={acronyms ?? []} showBody />
        </>
      ),
    },
    {
      id: "dashboard-docs",
      title: "Dashboard — important docs",
      icon: <FileText className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <>
          <div className="mb-4">
            <AddResourceForm section="dashboard_doc" label="+ Add doc" />
          </div>
          <ResourceList items={dashboardDocs ?? []} />
        </>
      ),
    },
    {
      id: "dashboard-notifications",
      title: "Dashboard — notifications",
      icon: <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <>
          <div className="mb-4">
            <AddResourceForm section="dashboard_notification" label="+ Add notification" showBody />
          </div>
          <ResourceList items={dashboardNotifications ?? []} showBody />
        </>
      ),
    },
    {
      id: "dashboard-links",
      title: "Dashboard — quick links",
      icon: <Link2 className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <>
          <div className="mb-4">
            {(dashboardLinks?.length ?? 0) < 5 ? (
              <AddResourceForm section="dashboard_link" label="+ Add link" />
            ) : (
              <p className="text-xs text-charcoal">Quick links are capped at 5 — delete one below to add another.</p>
            )}
          </div>
          <ResourceList items={dashboardLinks ?? []} />
        </>
      ),
    },
    {
      id: "learning-paths",
      title: "Learning — paths",
      icon: <GraduationCap className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <>
          <div className="mb-4">
            <AddResourceForm section="learning_path" label="+ Add path" showDuration />
          </div>
          <ResourceList items={learningPaths ?? []} showDuration />
        </>
      ),
    },
    {
      id: "learning-videos",
      title: "Learning — training videos",
      icon: <Video className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <>
          <div className="mb-4">
            <AddResourceForm section="loom" label="+ Add video" showDuration />
          </div>
          <ResourceList items={loomVideos ?? []} showDuration />
        </>
      ),
    },
    {
      id: "clients",
      title: "Clients — ATL & Digital",
      icon: <Building2 className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <ClientsManager
          clients={clients ?? []}
          links={atlLinks ?? []}
          channels={digitalChannels ?? []}
          atlAssigneesByClient={atlAssigneesByClient}
          digitalAssigneesByClient={digitalAssigneesByClient}
          pendingAssignments={pendingAssignments ?? []}
          channelOwners={channelOwners ?? []}
          clientOwners={clientOwners ?? []}
          people={personOptions}
          tiers={tiers ?? []}
        />
      ),
    },
    {
      id: "digital-opti-log",
      title: "Digital — optimisation log",
      icon: <ClipboardList className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: <DigitalOptiLogViewer logs={optiLogs} />,
    },
    {
      id: "people",
      title: "People & access",
      icon: <Users className="h-5 w-5" strokeWidth={2} aria-hidden />,
      content: (
        <>
          <TwoFactorSetup hasTotp={hasTotp} />
          <PeopleTable people={people} currentUserId={visibility.profile.id} />
        </>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Admin" description="Everything content-related lives here — invites, review queues, and full add/edit/delete for every section." />
      <div className="p-8">
        <SectionCardGrid sections={sections} initialSectionId={section ?? null} />
      </div>
    </div>
  );
}
