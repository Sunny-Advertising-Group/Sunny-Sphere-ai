// The fixed personalisation palette for a task category (Lily's requested set,
// with "sunflower" tied to the brand gold). Stored on task_categories.color —
// the DB check constraint mirrors this key list.
export const CATEGORY_COLORS = [
  { key: "yellow", label: "Yellow", bg: "#FFE066", text: "#4A3600" },
  { key: "sunflower", label: "Sunflower", bg: "#FDB600", text: "#3F2D00" },
  { key: "pastel_pink", label: "Pastel Pink", bg: "#FADCE6", text: "#7A2648" },
  { key: "light_blue", label: "Light Blue", bg: "#CBEBFF", text: "#0B3B57" },
  { key: "dark_blue", label: "Dark Blue", bg: "#1E3A66", text: "#FFFFFF" },
  { key: "pale_green", label: "Pale Green", bg: "#D6F2DD", text: "#1F4D2E" },
] as const;

export type CategoryColorKey = (typeof CATEGORY_COLORS)[number]["key"];

const COLOR_BY_KEY = new Map(CATEGORY_COLORS.map((c) => [c.key as string, c]));

export function categoryColorMeta(key: string) {
  return COLOR_BY_KEY.get(key) ?? CATEGORY_COLORS[0];
}

export const DEFAULT_CATEGORY_COLOR: CategoryColorKey = "yellow";

export const TAGGED_TASKS_TITLE = "Tagged Tasks";

export type TaskLink = { label: string; url: string };

export type TaskRow = {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  links: TaskLink[];
  created_by: string | null;
  assigned_by: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
};

export type CategoryRow = {
  id: number;
  owner_id: string;
  title: string;
  color: string;
  position: number;
  is_system: boolean;
  created_at: string;
};

export type PersonLite = { id: string; name: string; email: string };

export type CategoryWithTasks = CategoryRow & { tasks: TaskRow[] };

// Group a flat task list under its category, active tasks first (by due date,
// soonest/undated-last), and split off anything completed within the last 14
// days as history (older completed rows are purged by the cleanup cron, so
// nothing here needs a lower bound).
export function groupTasksByCategory(
  categories: CategoryRow[],
  tasks: TaskRow[],
): { active: CategoryWithTasks[]; completed: TaskRow[] } {
  const byCategory = new Map<number, TaskRow[]>();
  const completed: TaskRow[] = [];

  for (const task of tasks) {
    if (task.completed_at) {
      completed.push(task);
      continue;
    }
    const arr = byCategory.get(task.category_id) ?? [];
    arr.push(task);
    byCategory.set(task.category_id, arr);
  }

  const dueRank = (t: TaskRow) => (t.due_date ? new Date(t.due_date).getTime() : Infinity);

  const active = categories
    .slice()
    .sort((a, b) => (a.is_system === b.is_system ? a.position - b.position : a.is_system ? -1 : 1))
    .map((category) => ({
      ...category,
      tasks: (byCategory.get(category.id) ?? []).sort((a, b) => dueRank(a) - dueRank(b) || a.position - b.position),
    }));

  completed.sort((a, b) => (b.completed_at as string).localeCompare(a.completed_at as string));

  return { active, completed };
}

export function personLabel(person: PersonLite | null | undefined): string {
  if (!person) return "Unknown";
  return person.name || person.email;
}

export function isOverdue(task: TaskRow): boolean {
  if (!task.due_date || task.completed_at) return false;
  const today = new Date().toISOString().slice(0, 10);
  return task.due_date < today;
}

export function formatDueDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
