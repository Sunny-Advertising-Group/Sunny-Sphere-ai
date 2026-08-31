import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import type { CategoryRow, PersonLite, TaskRow } from "@/lib/tasks";
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

  const [{ data: profiles }, { data: categories }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase
      .from("task_categories")
      .select("id, owner_id, title, color, position, is_system, created_at")
      .order("position"),
  ]);

  const people: PersonLite[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? "",
    email: p.email,
  }));

  const boardOwnerId =
    requestedBoard && people.some((p) => p.id === requestedBoard) ? requestedBoard : profile.id;

  const boardCategories = (categories ?? []).filter((c) => c.owner_id === boardOwnerId) as CategoryRow[];
  const categoryIds = boardCategories.map((c) => c.id);

  const { data: tasks } =
    categoryIds.length === 0
      ? { data: [] as TaskRow[] }
      : await supabase
          .from("tasks")
          .select(
            "id, category_id, title, description, due_date, links, created_by, assigned_by, position, completed_at, created_at",
          )
          .in("category_id", categoryIds)
          .order("created_at");

  return (
    <div>
      <PageHeader
        title="Task Management"
        description="Your board, your categories, your colours — tag a teammate to drop a task straight onto their Tagged Tasks line."
      />
      <TaskBoard
        people={people}
        myProfileId={profile.id}
        boardOwnerId={boardOwnerId}
        categories={boardCategories}
        tasks={(tasks ?? []) as TaskRow[]}
      />
    </div>
  );
}
