import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import type { CategoryRow, ChecklistItem, ClientLite, PersonLite, TaskRow } from "@/lib/tasks";
import { TaskBoard } from "./TaskBoard";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const supabase = await createClient();
  const { profile } = visibility;
  const { board: requestedBoard } = await searchParams;

  // `categories` only ever returns rows RLS lets this user see — their own
  // board, any board they've been granted (task_board_access), or every
  // board if they're admin — so its distinct owner_ids double as "which
  // boards can I view", no separate query needed.
  const [{ data: profiles }, { data: categories }, { data: myGrants }, { data: clients }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase
      .from("task_categories")
      .select("id, owner_id, title, color, position, is_system, created_at")
      .order("position"),
    supabase.from("task_board_access").select("viewer_id").eq("owner_id", profile.id),
    // Clients an admin/ATL/Digital-permissioned user can see — used to tag a
    // task with a client and colour it. Empty for anyone without that
    // section access; the client field just won't offer any options.
    supabase.from("clients").select("id, name, colour").eq("is_active", true).order("name"),
  ]);

  const people: PersonLite[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? "",
    email: p.email,
  }));

  const viewableOwnerIds = new Set((categories ?? []).map((c) => c.owner_id));
  viewableOwnerIds.add(profile.id);
  const viewablePeople = people.filter((p) => viewableOwnerIds.has(p.id));

  const grantedViewerIds = new Set((myGrants ?? []).map((g) => g.viewer_id));
  const grantedPeople = people.filter((p) => grantedViewerIds.has(p.id));

  const boardOwnerId = requestedBoard && viewableOwnerIds.has(requestedBoard) ? requestedBoard : profile.id;

  const boardCategories = (categories ?? []).filter((c) => c.owner_id === boardOwnerId) as CategoryRow[];
  const categoryIds = boardCategories.map((c) => c.id);

  // Tasks native to this board's own columns, plus anything tagged to this
  // board's owner from someone else's column (shown under Tagged Tasks —
  // see groupTasksByCategory).
  const { data: tasks } =
    categoryIds.length === 0
      ? { data: [] as TaskRow[] }
      : await supabase
          .from("tasks")
          .select(
            "id, category_id, title, description, due_date, links, client_id, created_by, assigned_to, assigned_by, position, completed_at, created_at",
          )
          .or(`category_id.in.(${categoryIds.join(",")}),assigned_to.eq.${boardOwnerId}`)
          .order("created_at");

  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: checklistItems } =
    taskIds.length === 0
      ? { data: [] as ChecklistItem[] }
      : await supabase
          .from("task_checklist_items")
          .select("id, task_id, title, due_date, completed, position, created_at")
          .in("task_id", taskIds)
          .order("position");

  return (
    <div>
      <PageHeader
        title="Task Management"
        description="Your board is private by default — share it with whoever should see it, and tag a teammate to drop a task straight onto their Tagged Tasks line."
      />
      <TaskBoard
        allPeople={people}
        viewablePeople={viewablePeople}
        grantedPeople={grantedPeople}
        clients={(clients ?? []) as ClientLite[]}
        myProfileId={profile.id}
        boardOwnerId={boardOwnerId}
        categories={boardCategories}
        tasks={(tasks ?? []) as TaskRow[]}
        checklistItems={(checklistItems ?? []) as ChecklistItem[]}
      />
    </div>
  );
}
