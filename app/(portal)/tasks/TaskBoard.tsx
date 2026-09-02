"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  AlignLeft,
  Calendar,
  CalendarCheck,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Link2,
  List as ListIcon,
  Palette,
  Plus,
  Share2,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { AssigneePicker } from "@/components/AssigneePicker";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { initials } from "@/lib/digitalOpti";
import {
  CATEGORY_COLORS,
  categoryColorMeta,
  checklistProgress,
  DEFAULT_CATEGORY_COLOR,
  formatDueDate,
  groupTasksByCategory,
  isOverdue,
  personLabel,
  type CategoryColorKey,
  type CategoryRow,
  type ChecklistItem,
  type ClientLite,
  type PersonLite,
  type TaskLink,
  type TaskRow,
} from "@/lib/tasks";
import {
  addChecklistItem,
  completeTask,
  createCategory,
  createTask,
  deleteCategory,
  deleteChecklistItem,
  deleteTask,
  disconnectGoogleCalendar,
  grantBoardAccess,
  moveCategory,
  recolorCategory,
  renameCategory,
  revokeBoardAccess,
  toggleChecklistItem,
  uncompleteTask,
  updateChecklistItem,
  updateTask,
} from "./actions";

type View = "card" | "list";

export function TaskBoard({
  allPeople,
  viewablePeople,
  grantedPeople: initialGrantedPeople,
  clients,
  myProfileId,
  boardOwnerId,
  categories: initialCategories,
  tasks: initialTasks,
  checklistItems: initialChecklistItems,
  googleCalendarConfigured,
  googleCalendarConnected: initialGoogleConnected,
  googleStatus,
}: {
  allPeople: PersonLite[];
  viewablePeople: PersonLite[];
  grantedPeople: PersonLite[];
  clients: ClientLite[];
  myProfileId: string;
  boardOwnerId: string;
  categories: CategoryRow[];
  tasks: TaskRow[];
  checklistItems: ChecklistItem[];
  googleCalendarConfigured: boolean;
  googleCalendarConnected: boolean;
  googleStatus: string | null;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [tasks, setTasks] = useState(initialTasks);
  const [checklistItems, setChecklistItems] = useState(initialChecklistItems);
  const [grantedPeople, setGrantedPeople] = useState(initialGrantedPeople);
  const [view, setView] = useState<View>("card");
  const [shareOpen, setShareOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(initialGoogleConnected);
  const [googleNotice, setGoogleNotice] = useState(
    googleStatus === "connected"
      ? "Google Calendar connected — due dates will sync from now on."
      : googleStatus === "error"
        ? "Couldn't connect Google Calendar. Please try again."
        : googleStatus === "not_configured"
          ? "Google Calendar isn't set up for Sunny Sphere yet — ask an admin."
          : null,
  );
  const [, startTransition] = useTransition();

  const isOwnBoard = boardOwnerId === myProfileId;
  const peopleById = useMemo(() => new Map(allPeople.map((p) => [p.id, p])), [allPeople]);
  const boardOwner = peopleById.get(boardOwnerId);

  function disconnectGoogle() {
    setGoogleConnected(false);
    startTransition(async () => report(await disconnectGoogleCalendar()));
  }

  const checklistByTask = useMemo(() => {
    const map = new Map<number, ChecklistItem[]>();
    for (const item of checklistItems) {
      const arr = map.get(item.task_id) ?? [];
      arr.push(item);
      map.set(item.task_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [checklistItems]);

  function addChecklistItemLocal(taskId: number, title: string, dueDate: string | null) {
    const tempId = -Date.now();
    const optimistic: ChecklistItem = {
      id: tempId,
      task_id: taskId,
      title,
      due_date: dueDate,
      completed: false,
      position: (checklistByTask.get(taskId)?.length ?? 0),
      created_at: new Date().toISOString(),
    };
    setChecklistItems((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const result = await addChecklistItem(taskId, title, dueDate);
      if (result?.error) {
        setChecklistItems((prev) => prev.filter((i) => i.id !== tempId));
        report(result);
      } else if (result?.item) {
        setChecklistItems((prev) => prev.map((i) => (i.id === tempId ? (result.item as ChecklistItem) : i)));
      }
    });
  }

  function toggleChecklistItemLocal(id: number, completed: boolean) {
    setChecklistItems((prev) => prev.map((i) => (i.id === id ? { ...i, completed } : i)));
    startTransition(async () => report(await toggleChecklistItem(id, completed)));
  }

  function updateChecklistItemLocal(id: number, fields: { title?: string; dueDate?: string | null }) {
    setChecklistItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, ...(fields.title !== undefined ? { title: fields.title } : {}), ...(fields.dueDate !== undefined ? { due_date: fields.dueDate } : {}) }
          : i,
      ),
    );
    startTransition(async () => report(await updateChecklistItem(id, fields)));
  }

  function deleteChecklistItemLocal(id: number) {
    setChecklistItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => report(await deleteChecklistItem(id)));
  }

  function addGrant(viewerId: string) {
    const person = allPeople.find((p) => p.id === viewerId);
    if (!person) return;
    setGrantedPeople((prev) => [...prev, person]);
    startTransition(async () => report(await grantBoardAccess(viewerId)));
  }

  function removeGrant(viewerId: string) {
    setGrantedPeople((prev) => prev.filter((p) => p.id !== viewerId));
    startTransition(async () => report(await revokeBoardAccess(viewerId)));
  }

  const { active, completed } = useMemo(() => groupTasksByCategory(categories, tasks), [categories, tasks]);

  function report(result: { error?: string } | undefined) {
    if (result?.error) setError(result.error);
  }

  // --- Category mutations ---

  function addCategory(title: string, color: CategoryColorKey) {
    const tempId = -Date.now();
    const optimistic: CategoryRow = {
      id: tempId,
      owner_id: myProfileId,
      title,
      color,
      position: categories.length,
      is_system: false,
      created_at: new Date().toISOString(),
    };
    setCategories((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const result = await createCategory(title, color);
      if (result?.error) {
        setCategories((prev) => prev.filter((c) => c.id !== tempId));
        report(result);
      } else if (result?.category) {
        setCategories((prev) => prev.map((c) => (c.id === tempId ? (result.category as CategoryRow) : c)));
      }
    });
  }

  function renameCategoryLocal(id: number, title: string) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    startTransition(async () => report(await renameCategory(id, title)));
  }

  function recolorCategoryLocal(id: number, color: CategoryColorKey) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
    startTransition(async () => report(await recolorCategory(id, color)));
  }

  function deleteCategoryLocal(id: number) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setTasks((prev) => prev.filter((t) => t.category_id !== id));
    startTransition(async () => report(await deleteCategory(id)));
  }

  function moveCategoryLocal(id: number, direction: "left" | "right") {
    const ordered = categories.filter((c) => !c.is_system).sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((c) => c.id === id);
    const swapWith = direction === "left" ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= ordered.length) return;
    const a = ordered[index];
    const b = ordered[swapWith];
    setCategories((prev) =>
      prev.map((c) => (c.id === a.id ? { ...c, position: b.position } : c.id === b.id ? { ...c, position: a.position } : c)),
    );
    startTransition(async () => report(await moveCategory(id, direction)));
  }

  // --- Task mutations ---

  function addTask(categoryId: number, assigneeId: string | null, input: {
    title: string;
    dueDate: string | null;
    description: string;
    links: TaskLink[];
    clientId: number | null;
  }) {
    const tempId = -Date.now();
    const tagged = !!assigneeId && assigneeId !== myProfileId;
    const optimistic: TaskRow = {
      id: tempId,
      category_id: categoryId,
      title: input.title,
      description: input.description || null,
      due_date: input.dueDate,
      links: input.links,
      client_id: input.clientId,
      created_by: myProfileId,
      assigned_to: tagged ? assigneeId : null,
      assigned_by: tagged ? myProfileId : null,
      position: 0,
      completed_at: null,
      created_at: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const result = await createTask({
        categoryId,
        assigneeId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        links: input.links,
        clientId: input.clientId,
      });
      if (result?.error) {
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        report(result);
      } else if (result?.task) {
        setTasks((prev) => prev.map((t) => (t.id === tempId ? (result.task as TaskRow) : t)));
      }
    });
  }

  function toggleComplete(task: TaskRow) {
    const willComplete = !task.completed_at;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed_at: willComplete ? new Date().toISOString() : null } : t)),
    );
    startTransition(async () => report(await (willComplete ? completeTask(task.id) : uncompleteTask(task.id))));
  }

  function deleteTaskLocal(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => report(await deleteTask(id)));
  }

  function saveTask(
    id: number,
    fields: {
      title: string;
      description: string;
      dueDate: string | null;
      links: TaskLink[];
      clientId: number | null;
      assigneeId: string | null;
    },
  ) {
    const tagged = !!fields.assigneeId && fields.assigneeId !== myProfileId;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              title: fields.title,
              description: fields.description || null,
              due_date: fields.dueDate,
              links: fields.links,
              client_id: fields.clientId,
              assigned_to: tagged ? fields.assigneeId : null,
              assigned_by: tagged ? myProfileId : null,
            }
          : t,
      ),
    );
    startTransition(async () =>
      report(
        await updateTask(id, {
          title: fields.title,
          description: fields.description,
          dueDate: fields.dueDate,
          links: fields.links,
          clientId: fields.clientId,
          assigneeId: fields.assigneeId,
        }),
      ),
    );
  }

  return (
    <div className="space-y-4 p-8">
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      )}
      {googleNotice && (
        <div className="flex items-center justify-between rounded-lg border border-border-c bg-bg px-4 py-2 text-sm text-ink">
          {googleNotice}
          <button onClick={() => setGoogleNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {viewablePeople.map((p) => (
            <Link
              key={p.id}
              href={p.id === myProfileId ? "/tasks" : `/tasks?board=${p.id}`}
              title={personLabel(p)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-opacity ${
                p.id === boardOwnerId ? "bg-ink text-white" : "bg-black/5 text-charcoal hover:opacity-80"
              }`}
            >
              {initials(personLabel(p))}
            </Link>
          ))}
          <span className="ml-2 text-sm font-semibold text-ink">
            {isOwnBoard ? "My board" : `${personLabel(boardOwner)}'s board`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isOwnBoard && googleCalendarConfigured && (
            googleConnected ? (
              <button
                onClick={disconnectGoogle}
                title="Disconnect Google Calendar"
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
              >
                <CalendarCheck className="h-3.5 w-3.5" strokeWidth={2} /> Google Calendar connected
              </button>
            ) : (
              <a
                href="/api/google/connect"
                className="flex items-center gap-1.5 rounded-lg border border-border-c px-3 py-1.5 text-xs font-semibold text-charcoal hover:border-gold/50"
              >
                <CalendarCheck className="h-3.5 w-3.5" strokeWidth={2} /> Connect Google Calendar
              </a>
            )
          )}
          {isOwnBoard && (
            <button
              onClick={() => setShareOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                shareOpen ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
              }`}
            >
              <Share2 className="h-3.5 w-3.5" strokeWidth={2} /> Share ({grantedPeople.length})
            </button>
          )}
          <div className="flex overflow-hidden rounded-lg border border-border-c">
            <button
              onClick={() => setView("card")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${view === "card" ? "bg-gold text-ink" : "bg-white text-charcoal"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} /> Card
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${view === "list" ? "bg-gold text-ink" : "bg-white text-charcoal"}`}
            >
              <ListIcon className="h-3.5 w-3.5" strokeWidth={2} /> List
            </button>
          </div>
        </div>
      </div>

      {isOwnBoard && shareOpen && (
        <Card>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal">
            Who can see this board
          </div>
          <p className="mb-3 text-xs text-charcoal">
            Private by default. Add people below to let them view your board — tagging someone still works either
            way.
          </p>
          <AssigneePicker
            assigned={grantedPeople.map((p) => ({ id: p.id, label: personLabel(p) }))}
            options={allPeople.filter((p) => p.id !== myProfileId).map((p) => ({ id: p.id, label: personLabel(p) }))}
            onAdd={addGrant}
            onRemove={removeGrant}
          />
        </Card>
      )}

      {view === "card" ? (
        <CardView
          categories={active}
          isOwnBoard={isOwnBoard}
          myProfileId={myProfileId}
          boardOwnerId={boardOwnerId}
          people={allPeople}
          peopleById={peopleById}
          clients={clients}
          checklistByTask={checklistByTask}
          onAddCategory={addCategory}
          onRenameCategory={renameCategoryLocal}
          onRecolorCategory={recolorCategoryLocal}
          onDeleteCategory={deleteCategoryLocal}
          onMoveCategory={moveCategoryLocal}
          onAddTask={addTask}
          onToggleComplete={toggleComplete}
          onDeleteTask={deleteTaskLocal}
          onSaveTask={saveTask}
          onAddChecklistItem={addChecklistItemLocal}
          onToggleChecklistItem={toggleChecklistItemLocal}
          onUpdateChecklistItem={updateChecklistItemLocal}
          onDeleteChecklistItem={deleteChecklistItemLocal}
        />
      ) : (
        <ListView
          categories={active}
          isOwnBoard={isOwnBoard}
          myProfileId={myProfileId}
          boardOwnerId={boardOwnerId}
          people={allPeople}
          peopleById={peopleById}
          clients={clients}
          checklistByTask={checklistByTask}
          onAddCategory={addCategory}
          onAddTask={addTask}
          onToggleComplete={toggleComplete}
          onDeleteTask={deleteTaskLocal}
          onSaveTask={saveTask}
          onAddChecklistItem={addChecklistItemLocal}
          onToggleChecklistItem={toggleChecklistItemLocal}
          onUpdateChecklistItem={updateChecklistItemLocal}
          onDeleteChecklistItem={deleteChecklistItemLocal}
        />
      )}

      {completed.length > 0 && (
        <details className="rounded-2xl border border-border-c bg-white">
          <summary className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide text-charcoal">
            Completed ({completed.length}) — kept for 14 days, then removed automatically
          </summary>
          <div className="divide-y divide-border-c border-t border-border-c">
            {completed.map((task) => {
              const category =
                categories.find((c) => c.id === task.category_id) ??
                (task.assigned_to === boardOwnerId ? categories.find((c) => c.is_system) : undefined);
              const canRestore =
                task.created_by === myProfileId || task.assigned_to === myProfileId || category?.owner_id === myProfileId;
              return (
                <div key={task.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <div className="flex items-center gap-2 text-charcoal">
                    {category && (
                      <span
                        className="h-2 w-2 flex-none rounded-full"
                        style={{ background: categoryColorMeta(category.color).bg }}
                      />
                    )}
                    <span className="line-through">{task.title}</span>
                  </div>
                  {canRestore && (
                    <button
                      onClick={() => toggleComplete(task)}
                      className="text-xs font-semibold text-charcoal hover:text-gold"
                    >
                      Restore
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

// --- Card (Trello-style) view ---

function CardView({
  categories,
  isOwnBoard,
  myProfileId,
  boardOwnerId,
  people,
  peopleById,
  clients,
  checklistByTask,
  onAddCategory,
  onRenameCategory,
  onRecolorCategory,
  onDeleteCategory,
  onMoveCategory,
  onAddTask,
  onToggleComplete,
  onDeleteTask,
  onSaveTask,
  onAddChecklistItem,
  onToggleChecklistItem,
  onUpdateChecklistItem,
  onDeleteChecklistItem,
}: {
  categories: (CategoryRow & { tasks: TaskRow[] })[];
  isOwnBoard: boolean;
  myProfileId: string;
  boardOwnerId: string;
  people: PersonLite[];
  peopleById: Map<string, PersonLite>;
  clients: ClientLite[];
  checklistByTask: Map<number, ChecklistItem[]>;
  onAddCategory: (title: string, color: CategoryColorKey) => void;
  onRenameCategory: (id: number, title: string) => void;
  onRecolorCategory: (id: number, color: CategoryColorKey) => void;
  onDeleteCategory: (id: number) => void;
  onMoveCategory: (id: number, direction: "left" | "right") => void;
  onAddTask: (categoryId: number, assigneeId: string | null, input: { title: string; dueDate: string | null; description: string; links: TaskLink[]; clientId: number | null }) => void;
  onToggleComplete: (task: TaskRow) => void;
  onDeleteTask: (id: number) => void;
  onSaveTask: (id: number, fields: { title: string; description: string; dueDate: string | null; links: TaskLink[]; clientId: number | null; assigneeId: string | null }) => void;
  onAddChecklistItem: (taskId: number, title: string, dueDate: string | null) => void;
  onToggleChecklistItem: (id: number, completed: boolean) => void;
  onUpdateChecklistItem: (id: number, fields: { title?: string; dueDate?: string | null }) => void;
  onDeleteChecklistItem: (id: number) => void;
}) {
  const nonSystem = categories.filter((c) => !c.is_system);

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-4">
      {categories.map((category) => {
        const meta = categoryColorMeta(category.color);
        const canManageCategory = isOwnBoard && !category.is_system;
        const posInNonSystem = nonSystem.findIndex((c) => c.id === category.id);
        return (
          <div key={category.id} className="w-72 flex-none rounded-xl border border-border-c bg-white">
            <CategoryHeader
              category={category}
              meta={meta}
              canManage={canManageCategory}
              canReorderLeft={canManageCategory && posInNonSystem > 0}
              canReorderRight={canManageCategory && posInNonSystem < nonSystem.length - 1}
              onRename={(title) => onRenameCategory(category.id, title)}
              onRecolor={(color) => onRecolorCategory(category.id, color)}
              onDelete={() => onDeleteCategory(category.id)}
              onMove={(dir) => onMoveCategory(category.id, dir)}
            />
            <div className="space-y-2 p-2">
              {category.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  variant="card"
                  boardOwnerId={boardOwnerId}
                  peopleById={peopleById}
                  people={people}
                  clients={clients}
                  checklist={checklistByTask.get(task.id) ?? []}
                  canManage={isOwnBoard || task.created_by === myProfileId || task.assigned_to === myProfileId}
                  onToggleComplete={() => onToggleComplete(task)}
                  onDelete={() => onDeleteTask(task.id)}
                  onSave={(fields) => onSaveTask(task.id, fields)}
                  onAddChecklistItem={(title, dueDate) => onAddChecklistItem(task.id, title, dueDate)}
                  onToggleChecklistItem={onToggleChecklistItem}
                  onUpdateChecklistItem={onUpdateChecklistItem}
                  onDeleteChecklistItem={onDeleteChecklistItem}
                />
              ))}
              {isOwnBoard && (
                <TaskComposer
                  categoryId={category.id}
                  pending={category.id < 0}
                  people={people}
                  clients={clients}
                  myProfileId={myProfileId}
                  onAdd={onAddTask}
                />
              )}
            </div>
          </div>
        );
      })}
      {isOwnBoard && <AddCategoryColumn onAdd={onAddCategory} />}
    </div>
  );
}

// --- List (Asana-style) view ---

function ListView({
  categories,
  isOwnBoard,
  myProfileId,
  boardOwnerId,
  people,
  peopleById,
  clients,
  checklistByTask,
  onAddCategory,
  onAddTask,
  onToggleComplete,
  onDeleteTask,
  onSaveTask,
  onAddChecklistItem,
  onToggleChecklistItem,
  onUpdateChecklistItem,
  onDeleteChecklistItem,
}: {
  categories: (CategoryRow & { tasks: TaskRow[] })[];
  isOwnBoard: boolean;
  myProfileId: string;
  boardOwnerId: string;
  people: PersonLite[];
  peopleById: Map<string, PersonLite>;
  clients: ClientLite[];
  checklistByTask: Map<number, ChecklistItem[]>;
  onAddCategory: (title: string, color: CategoryColorKey) => void;
  onAddTask: (categoryId: number, assigneeId: string | null, input: { title: string; dueDate: string | null; description: string; links: TaskLink[]; clientId: number | null }) => void;
  onToggleComplete: (task: TaskRow) => void;
  onDeleteTask: (id: number) => void;
  onSaveTask: (id: number, fields: { title: string; description: string; dueDate: string | null; links: TaskLink[]; clientId: number | null; assigneeId: string | null }) => void;
  onAddChecklistItem: (taskId: number, title: string, dueDate: string | null) => void;
  onToggleChecklistItem: (id: number, completed: boolean) => void;
  onUpdateChecklistItem: (id: number, fields: { title?: string; dueDate?: string | null }) => void;
  onDeleteChecklistItem: (id: number) => void;
}) {
  const [addingCategory, setAddingCategory] = useState(false);

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const meta = categoryColorMeta(category.color);
        return (
          <Card key={category.id} className="p-0">
            <div
              className="flex items-center gap-2 rounded-t-2xl px-4 py-2"
              style={{ background: meta.bg, color: meta.text }}
            >
              <span className="text-sm font-bold">{category.title}</span>
              <span className="text-xs opacity-70">{category.tasks.length}</span>
            </div>
            <div className="divide-y divide-border-c">
              {category.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  variant="list"
                  boardOwnerId={boardOwnerId}
                  peopleById={peopleById}
                  people={people}
                  clients={clients}
                  checklist={checklistByTask.get(task.id) ?? []}
                  canManage={isOwnBoard || task.created_by === myProfileId || task.assigned_to === myProfileId}
                  onToggleComplete={() => onToggleComplete(task)}
                  onDelete={() => onDeleteTask(task.id)}
                  onSave={(fields) => onSaveTask(task.id, fields)}
                  onAddChecklistItem={(title, dueDate) => onAddChecklistItem(task.id, title, dueDate)}
                  onToggleChecklistItem={onToggleChecklistItem}
                  onUpdateChecklistItem={onUpdateChecklistItem}
                  onDeleteChecklistItem={onDeleteChecklistItem}
                />
              ))}
            </div>
            {isOwnBoard && (
              <div className="p-2">
                <TaskComposer
                  categoryId={category.id}
                  pending={category.id < 0}
                  people={people}
                  clients={clients}
                  myProfileId={myProfileId}
                  onAdd={onAddTask}
                />
              </div>
            )}
          </Card>
        );
      })}

      {isOwnBoard && (
        <Card>
          {addingCategory ? (
            <AddCategoryInline
              onSave={(title, color) => {
                onAddCategory(title, color);
                setAddingCategory(false);
              }}
              onCancel={() => setAddingCategory(false)}
            />
          ) : (
            <button
              onClick={() => setAddingCategory(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-charcoal hover:text-gold"
            >
              <Plus className="h-4 w-4" strokeWidth={2} /> Add category
            </button>
          )}
        </Card>
      )}
    </div>
  );
}

// --- Shared pieces ---

function CategoryHeader({
  category,
  meta,
  canManage,
  canReorderLeft,
  canReorderRight,
  onRename,
  onRecolor,
  onDelete,
  onMove,
}: {
  category: CategoryRow;
  meta: (typeof CATEGORY_COLORS)[number];
  canManage: boolean;
  canReorderLeft: boolean;
  canReorderRight: boolean;
  onRename: (title: string) => void;
  onRecolor: (color: CategoryColorKey) => void;
  onDelete: () => void;
  onMove: (dir: "left" | "right") => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [pickingColor, setPickingColor] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="rounded-t-xl px-3 py-2" style={{ background: meta.bg, color: meta.text }}>
      <div className="flex items-center gap-1.5">
        {category.is_system && <Tag className="h-3.5 w-3.5 flex-none" strokeWidth={2} />}
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={category.title}
            onBlur={(e) => {
              setEditingTitle(false);
              if (e.target.value.trim() && e.target.value !== category.title) onRename(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            className="w-full rounded border-none bg-white/70 px-1.5 py-0.5 text-sm font-bold text-ink outline-none"
          />
        ) : (
          <button
            disabled={!canManage}
            onClick={() => canManage && setEditingTitle(true)}
            className="flex-1 truncate text-left text-sm font-bold"
          >
            {category.title}
          </button>
        )}
        {canManage && (
          <div className="flex flex-none items-center gap-0.5">
            <button onClick={() => onMove("left")} disabled={!canReorderLeft} className="disabled:opacity-30" aria-label="Move left">
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button onClick={() => onMove("right")} disabled={!canReorderRight} className="disabled:opacity-30" aria-label="Move right">
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button onClick={() => setPickingColor((v) => !v)} title="Change colour" aria-label="Change colour">
              <Palette className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            {!category.is_system && (
              <button onClick={() => setConfirmingDelete(true)} aria-label="Delete category">
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>
      {pickingColor && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => {
                onRecolor(c.key);
                setPickingColor(false);
              }}
              title={c.label}
              className="h-5 w-5 rounded-full border-2"
              style={{ background: c.bg, borderColor: c.key === category.color ? c.text : "transparent" }}
            />
          ))}
        </div>
      )}
      {confirmingDelete && (
        <div className="mt-2 flex items-center gap-2 rounded bg-white/80 px-2 py-1 text-xs text-ink">
          Delete this category and its tasks?
          <button onClick={onDelete} className="font-bold text-red-600">
            Yes
          </button>
          <button onClick={() => setConfirmingDelete(false)} className="font-semibold">
            No
          </button>
        </div>
      )}
    </div>
  );
}

function AddCategoryColumn({ onAdd }: { onAdd: (title: string, color: CategoryColorKey) => void }) {
  const [adding, setAdding] = useState(false);
  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex h-10 w-72 flex-none items-center gap-1.5 rounded-xl border border-dashed border-border-c bg-white px-3 text-sm font-semibold text-charcoal hover:border-gold/50 hover:text-gold"
      >
        <Plus className="h-4 w-4" strokeWidth={2} /> Add category
      </button>
    );
  }
  return (
    <div className="w-72 flex-none rounded-xl border border-border-c bg-white p-3">
      <AddCategoryInline
        onSave={(title, color) => {
          onAdd(title, color);
          setAdding(false);
        }}
        onCancel={() => setAdding(false)}
      />
    </div>
  );
}

function AddCategoryInline({
  onSave,
  onCancel,
}: {
  onSave: (title: string, color: CategoryColorKey) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<CategoryColorKey>(DEFAULT_CATEGORY_COLOR);

  return (
    <div className="space-y-2">
      <Input autoFocus placeholder="Category title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c.key}
            onClick={() => setColor(c.key)}
            title={c.label}
            className="h-6 w-6 rounded-full border-2"
            style={{ background: c.bg, borderColor: c.key === color ? "#0a0a0a" : "transparent" }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => title.trim() && onSave(title.trim(), color)}
          disabled={!title.trim()}
          className="px-3 py-1.5 text-xs"
        >
          Save
        </Button>
        <button onClick={onCancel} className="text-xs text-charcoal hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}

function TaskComposer({
  categoryId,
  pending = false,
  people,
  clients,
  myProfileId,
  onAdd,
}: {
  categoryId: number;
  pending?: boolean;
  people: PersonLite[];
  clients: ClientLite[];
  myProfileId: string;
  onAdd: (categoryId: number, assigneeId: string | null, input: { title: string; dueDate: string | null; description: string; links: TaskLink[]; clientId: number | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState(myProfileId);
  const [clientId, setClientId] = useState("");
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [showMore, setShowMore] = useState(false);

  function reset() {
    setTitle("");
    setDueDate("");
    setAssigneeId(myProfileId);
    setClientId("");
    setDescription("");
    setLinks([]);
    setShowMore(false);
    setOpen(false);
  }

  function submit() {
    if (!title.trim()) return;
    onAdd(categoryId, assigneeId, {
      title: title.trim(),
      dueDate: dueDate || null,
      description,
      links: links.filter((l) => l.url.trim()),
      clientId: clientId ? Number(clientId) : null,
    });
    reset();
  }

  // A brand-new column is shown optimistically with a temporary negative id
  // before the server assigns its real one — adding a task against that temp
  // id would insert a task with a category_id nothing owns, which the tasks
  // table's RLS policy rejects. Block that window instead of letting it fail.
  if (pending) {
    return (
      <div className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold text-charcoal/50">
        <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Saving column…
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-charcoal hover:bg-bg hover:text-gold"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Add a task
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border-c bg-bg p-2.5">
      <Input autoFocus placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-36" />
        <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-36">
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === myProfileId ? "Myself" : personLabel(p)}
            </option>
          ))}
        </Select>
        {clients.length > 0 && (
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-36">
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      {showMore ? (
        <div className="space-y-2">
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <LinkListEditor links={links} onChange={setLinks} />
        </div>
      ) : (
        <button
          onClick={() => setShowMore(true)}
          className="text-xs font-semibold text-charcoal hover:text-gold"
        >
          + Description / links
        </button>
      )}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={!title.trim()} className="px-3 py-1.5 text-xs">
          Add task
        </Button>
        <button onClick={reset} className="text-xs text-charcoal hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}

function LinkListEditor({ links, onChange }: { links: TaskLink[]; onChange: (links: TaskLink[]) => void }) {
  return (
    <div className="space-y-1.5">
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            placeholder="Label"
            value={link.label}
            onChange={(e) => onChange(links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))}
            className="w-24"
          />
          <Input
            placeholder="https://…"
            value={link.url}
            onChange={(e) => onChange(links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))}
          />
          <button onClick={() => onChange(links.filter((_, j) => j !== i))} aria-label="Remove link">
            <X className="h-3.5 w-3.5 text-charcoal" strokeWidth={2} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...links, { label: "", url: "" }])}
        className="flex items-center gap-1 text-xs font-semibold text-charcoal hover:text-gold"
      >
        <Link2 className="h-3.5 w-3.5" strokeWidth={2} /> Add link
      </button>
    </div>
  );
}

function TaskItem({
  task,
  variant,
  boardOwnerId,
  peopleById,
  people,
  clients,
  checklist,
  canManage,
  onToggleComplete,
  onDelete,
  onSave,
  onAddChecklistItem,
  onToggleChecklistItem,
  onUpdateChecklistItem,
  onDeleteChecklistItem,
}: {
  task: TaskRow;
  variant: "card" | "list";
  boardOwnerId: string;
  peopleById: Map<string, PersonLite>;
  people: PersonLite[];
  clients: ClientLite[];
  checklist: ChecklistItem[];
  canManage: boolean;
  onToggleComplete: () => void;
  onDelete: () => void;
  onSave: (fields: { title: string; description: string; dueDate: string | null; links: TaskLink[]; clientId: number | null; assigneeId: string | null }) => void;
  onAddChecklistItem: (title: string, dueDate: string | null) => void;
  onToggleChecklistItem: (id: number, completed: boolean) => void;
  onUpdateChecklistItem: (id: number, fields: { title?: string; dueDate?: string | null }) => void;
  onDeleteChecklistItem: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [links, setLinks] = useState<TaskLink[]>(task.links);
  const [clientId, setClientId] = useState(task.client_id ? String(task.client_id) : "");
  const [assigneeId, setAssigneeId] = useState(task.assigned_to ?? "");
  const overdue = isOverdue(task);
  const client = task.client_id ? clients.find((c) => c.id === task.client_id) : undefined;
  const { done: checklistDone, total: checklistTotal } = checklistProgress(checklist);
  // A task shows here two ways: natively (its own category belongs to this
  // board) or cross-posted under Tagged Tasks (assigned_to === this board's
  // owner). Which one decides whether the chip reads "tagged to" or "tagged by".
  const showingAsTaggedHere = task.assigned_to === boardOwnerId;

  function save() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description,
      dueDate: dueDate || null,
      links: links.filter((l) => l.url.trim()),
      clientId: clientId ? Number(clientId) : null,
      assigneeId: assigneeId || null,
    });
    setExpanded(false);
  }

  const container =
    variant === "card"
      ? "rounded-lg border border-border-c bg-white p-2.5"
      : "px-4 py-2.5";
  const clientAccent = client?.colour ? { borderLeft: `3px solid ${client.colour}` } : undefined;

  if (expanded && canManage) {
    return (
      <div className={container} style={variant === "card" ? clientAccent : undefined}>
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-36" />
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-36">
              <option value="">Not tagged</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {personLabel(p)}
                </option>
              ))}
            </Select>
            {clients.length > 0 && (
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-36">
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <LinkListEditor links={links} onChange={setLinks} />

          <div className="border-t border-border-c pt-2">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-charcoal">
              <CheckSquare className="h-3.5 w-3.5" strokeWidth={2} />
              Checklist{checklistTotal > 0 && ` (${checklistDone}/${checklistTotal})`}
            </div>
            <ChecklistEditor
              items={checklist}
              onAdd={onAddChecklistItem}
              onToggle={onToggleChecklistItem}
              onUpdate={onUpdateChecklistItem}
              onDelete={onDeleteChecklistItem}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={save} className="px-3 py-1.5 text-xs">
              Save
            </Button>
            <button onClick={() => setExpanded(false)} className="text-xs text-charcoal hover:text-ink">
              Cancel
            </button>
            <button onClick={onDelete} className="ml-auto flex items-center gap-1 text-xs font-semibold text-red-600">
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} /> Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${container} flex items-start gap-2`} style={variant === "card" ? clientAccent : undefined}>
      <button
        onClick={onToggleComplete}
        disabled={!canManage}
        aria-label="Mark complete"
        className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border border-border-c bg-white hover:border-gold disabled:opacity-40"
      >
        {task.completed_at && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <button
        onClick={() => canManage && setExpanded(true)}
        className="min-w-0 flex-1 text-left"
        disabled={!canManage}
      >
        <div className="text-sm font-medium text-ink">{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-charcoal">
          {task.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? "font-semibold text-red-600" : ""}`}>
              <Calendar className="h-3 w-3" strokeWidth={2} />
              {formatDueDate(task.due_date)}
            </span>
          )}
          {task.description && (
            <span className="flex items-center gap-1">
              <AlignLeft className="h-3 w-3" strokeWidth={2} />
            </span>
          )}
          {task.links.length > 0 && (
            <span className="flex items-center gap-1">
              <Link2 className="h-3 w-3" strokeWidth={2} />
              {task.links.length}
            </span>
          )}
          {checklistTotal > 0 && (
            <span className={`flex items-center gap-1 ${checklistDone === checklistTotal ? "text-emerald-600" : ""}`}>
              <CheckSquare className="h-3 w-3" strokeWidth={2} />
              {checklistDone}/{checklistTotal}
            </span>
          )}
          {client && (
            <span className="flex items-center gap-1 font-medium">
              <span className="h-2 w-2 rounded-full" style={{ background: client.colour ?? "#999" }} />
              {client.name}
            </span>
          )}
          {task.assigned_to && (
            <span className="rounded-full bg-black/5 px-1.5 py-0.5 font-semibold uppercase tracking-wide">
              {showingAsTaggedHere ? `Tagged by ${personLabel(peopleById.get(task.assigned_by ?? ""))}` : `→ ${personLabel(peopleById.get(task.assigned_to))}`}
            </span>
          )}
        </div>
        {task.links.length > 0 && expanded === false && variant === "list" && (
          <div className="mt-1 flex flex-wrap gap-2">
            {task.links.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-medium text-charcoal underline hover:text-gold"
              >
                {l.label || l.url}
              </a>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}

function ChecklistEditor({
  items,
  onAdd,
  onToggle,
  onUpdate,
  onDelete,
}: {
  items: ChecklistItem[];
  onAdd: (title: string, dueDate: string | null) => void;
  onToggle: (id: number, completed: boolean) => void;
  onUpdate: (id: number, fields: { title?: string; dueDate?: string | null }) => void;
  onDelete: (id: number) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [editingDateFor, setEditingDateFor] = useState<number | null>(null);

  function add() {
    if (!newTitle.trim()) return;
    onAdd(newTitle.trim(), newDueDate || null);
    setNewTitle("");
    setNewDueDate("");
  }

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1.5 text-sm">
          <button
            onClick={() => onToggle(item.id, !item.completed)}
            aria-label="Toggle checklist item"
            className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded border ${
              item.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-border-c bg-white"
            }`}
          >
            {item.completed && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
          </button>
          <span className={`flex-1 ${item.completed ? "text-charcoal line-through" : "text-ink"}`}>{item.title}</span>
          {editingDateFor === item.id ? (
            <input
              type="date"
              autoFocus
              defaultValue={item.due_date ?? ""}
              onBlur={(e) => {
                onUpdate(item.id, { dueDate: e.target.value || null });
                setEditingDateFor(null);
              }}
              className="w-32 rounded border border-border-c px-1 py-0.5 text-xs outline-none focus:border-gold"
            />
          ) : (
            <button
              onClick={() => setEditingDateFor(item.id)}
              className={`flex flex-none items-center gap-1 text-[11px] ${item.due_date ? "text-charcoal" : "text-charcoal/40"}`}
            >
              <Calendar className="h-3 w-3" strokeWidth={2} />
              {item.due_date ? formatDueDate(item.due_date) : "date"}
            </button>
          )}
          <button onClick={() => onDelete(item.id)} aria-label="Delete checklist item">
            <X className="h-3 w-3 text-charcoal" strokeWidth={2} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <Input
          placeholder="Add checklist item…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1 py-1 text-xs"
        />
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          className="w-32 rounded border border-border-c px-1.5 py-1 text-xs outline-none focus:border-gold"
        />
        <button onClick={add} disabled={!newTitle.trim()} className="flex-none text-charcoal hover:text-gold disabled:opacity-40">
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
