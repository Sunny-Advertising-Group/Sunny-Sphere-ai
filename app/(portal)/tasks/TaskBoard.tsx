"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  AlignLeft,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Link2,
  List as ListIcon,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { initials } from "@/lib/digitalOpti";
import {
  CATEGORY_COLORS,
  categoryColorMeta,
  DEFAULT_CATEGORY_COLOR,
  formatDueDate,
  groupTasksByCategory,
  isOverdue,
  personLabel,
  type CategoryColorKey,
  type CategoryRow,
  type PersonLite,
  type TaskLink,
  type TaskRow,
} from "@/lib/tasks";
import {
  completeTask,
  createCategory,
  createTask,
  deleteCategory,
  deleteTask,
  moveCategory,
  recolorCategory,
  renameCategory,
  uncompleteTask,
  updateTask,
} from "./actions";

type View = "card" | "list";

export function TaskBoard({
  people,
  myProfileId,
  boardOwnerId,
  categories: initialCategories,
  tasks: initialTasks,
}: {
  people: PersonLite[];
  myProfileId: string;
  boardOwnerId: string;
  categories: CategoryRow[];
  tasks: TaskRow[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<View>("card");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isOwnBoard = boardOwnerId === myProfileId;
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const boardOwner = peopleById.get(boardOwnerId);

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
  }) {
    const tempId = -Date.now();
    const targetCategoryId =
      assigneeId && assigneeId !== myProfileId
        ? categories.find((c) => c.owner_id === assigneeId && c.is_system)?.id ?? categoryId
        : categoryId;
    const optimistic: TaskRow = {
      id: tempId,
      category_id: targetCategoryId,
      title: input.title,
      description: input.description || null,
      due_date: input.dueDate,
      links: input.links,
      created_by: myProfileId,
      assigned_by: assigneeId && assigneeId !== myProfileId ? myProfileId : null,
      position: 0,
      completed_at: null,
      created_at: new Date().toISOString(),
    };
    if (targetCategoryId === categoryId || isOwnBoard) {
      setTasks((prev) => [...prev, optimistic]);
    }
    startTransition(async () => {
      const result = await createTask({
        categoryId,
        assigneeId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        links: input.links,
      });
      if (result?.error) {
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        report(result);
      } else if (result?.task) {
        setTasks((prev) => {
          const withoutTemp = prev.filter((t) => t.id !== tempId);
          return targetCategoryId === categoryId || isOwnBoard ? [...withoutTemp, result.task as TaskRow] : withoutTemp;
        });
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

  function saveTask(id: number, fields: { title: string; description: string; dueDate: string | null; links: TaskLink[] }) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, title: fields.title, description: fields.description || null, due_date: fields.dueDate, links: fields.links } : t,
      ),
    );
    startTransition(async () =>
      report(
        await updateTask(id, {
          title: fields.title,
          description: fields.description,
          dueDate: fields.dueDate,
          links: fields.links,
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {people.map((p) => (
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

      {view === "card" ? (
        <CardView
          categories={active}
          isOwnBoard={isOwnBoard}
          myProfileId={myProfileId}
          people={people}
          onAddCategory={addCategory}
          onRenameCategory={renameCategoryLocal}
          onRecolorCategory={recolorCategoryLocal}
          onDeleteCategory={deleteCategoryLocal}
          onMoveCategory={moveCategoryLocal}
          onAddTask={addTask}
          onToggleComplete={toggleComplete}
          onDeleteTask={deleteTaskLocal}
          onSaveTask={saveTask}
        />
      ) : (
        <ListView
          categories={active}
          isOwnBoard={isOwnBoard}
          myProfileId={myProfileId}
          people={people}
          onAddCategory={addCategory}
          onAddTask={addTask}
          onToggleComplete={toggleComplete}
          onDeleteTask={deleteTaskLocal}
          onSaveTask={saveTask}
        />
      )}

      {completed.length > 0 && (
        <details className="rounded-2xl border border-border-c bg-white">
          <summary className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide text-charcoal">
            Completed ({completed.length}) — kept for 14 days, then removed automatically
          </summary>
          <div className="divide-y divide-border-c border-t border-border-c">
            {completed.map((task) => {
              const category = categories.find((c) => c.id === task.category_id);
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
                  {(task.created_by === myProfileId || category?.owner_id === myProfileId) && (
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
  people,
  onAddCategory,
  onRenameCategory,
  onRecolorCategory,
  onDeleteCategory,
  onMoveCategory,
  onAddTask,
  onToggleComplete,
  onDeleteTask,
  onSaveTask,
}: {
  categories: (CategoryRow & { tasks: TaskRow[] })[];
  isOwnBoard: boolean;
  myProfileId: string;
  people: PersonLite[];
  onAddCategory: (title: string, color: CategoryColorKey) => void;
  onRenameCategory: (id: number, title: string) => void;
  onRecolorCategory: (id: number, color: CategoryColorKey) => void;
  onDeleteCategory: (id: number) => void;
  onMoveCategory: (id: number, direction: "left" | "right") => void;
  onAddTask: (categoryId: number, assigneeId: string | null, input: { title: string; dueDate: string | null; description: string; links: TaskLink[] }) => void;
  onToggleComplete: (task: TaskRow) => void;
  onDeleteTask: (id: number) => void;
  onSaveTask: (id: number, fields: { title: string; description: string; dueDate: string | null; links: TaskLink[] }) => void;
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
                  canManage={isOwnBoard || task.created_by === myProfileId}
                  onToggleComplete={() => onToggleComplete(task)}
                  onDelete={() => onDeleteTask(task.id)}
                  onSave={(fields) => onSaveTask(task.id, fields)}
                />
              ))}
              {(isOwnBoard || category.is_system) && (
                <TaskComposer
                  categoryId={category.id}
                  people={people}
                  myProfileId={myProfileId}
                  showAssignee={isOwnBoard}
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
  people,
  onAddCategory,
  onAddTask,
  onToggleComplete,
  onDeleteTask,
  onSaveTask,
}: {
  categories: (CategoryRow & { tasks: TaskRow[] })[];
  isOwnBoard: boolean;
  myProfileId: string;
  people: PersonLite[];
  onAddCategory: (title: string, color: CategoryColorKey) => void;
  onAddTask: (categoryId: number, assigneeId: string | null, input: { title: string; dueDate: string | null; description: string; links: TaskLink[] }) => void;
  onToggleComplete: (task: TaskRow) => void;
  onDeleteTask: (id: number) => void;
  onSaveTask: (id: number, fields: { title: string; description: string; dueDate: string | null; links: TaskLink[] }) => void;
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
                  canManage={isOwnBoard || task.created_by === myProfileId}
                  onToggleComplete={() => onToggleComplete(task)}
                  onDelete={() => onDeleteTask(task.id)}
                  onSave={(fields) => onSaveTask(task.id, fields)}
                />
              ))}
            </div>
            {(isOwnBoard || category.is_system) && (
              <div className="p-2">
                <TaskComposer
                  categoryId={category.id}
                  people={people}
                  myProfileId={myProfileId}
                  showAssignee={isOwnBoard}
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
            <button onClick={() => setPickingColor((v) => !v)} aria-label="Change colour">
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
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
  people,
  myProfileId,
  showAssignee,
  onAdd,
}: {
  categoryId: number;
  people: PersonLite[];
  myProfileId: string;
  showAssignee: boolean;
  onAdd: (categoryId: number, assigneeId: string | null, input: { title: string; dueDate: string | null; description: string; links: TaskLink[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState(myProfileId);
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [showMore, setShowMore] = useState(false);

  function reset() {
    setTitle("");
    setDueDate("");
    setAssigneeId(myProfileId);
    setDescription("");
    setLinks([]);
    setShowMore(false);
    setOpen(false);
  }

  function submit() {
    if (!title.trim()) return;
    onAdd(categoryId, showAssignee ? assigneeId : null, {
      title: title.trim(),
      dueDate: dueDate || null,
      description,
      links: links.filter((l) => l.url.trim()),
    });
    reset();
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
        {showAssignee && (
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-40">
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === myProfileId ? "Myself" : personLabel(p)}
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
  canManage,
  onToggleComplete,
  onDelete,
  onSave,
}: {
  task: TaskRow;
  variant: "card" | "list";
  canManage: boolean;
  onToggleComplete: () => void;
  onDelete: () => void;
  onSave: (fields: { title: string; description: string; dueDate: string | null; links: TaskLink[] }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [links, setLinks] = useState<TaskLink[]>(task.links);
  const overdue = isOverdue(task);

  function save() {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description, dueDate: dueDate || null, links: links.filter((l) => l.url.trim()) });
    setExpanded(false);
  }

  const container =
    variant === "card"
      ? "rounded-lg border border-border-c bg-white p-2.5"
      : "px-4 py-2.5";

  if (expanded && canManage) {
    return (
      <div className={container}>
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-36" />
          <LinkListEditor links={links} onChange={setLinks} />
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
    <div className={`${container} flex items-start gap-2`}>
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
          {task.assigned_by && (
            <span className="rounded-full bg-black/5 px-1.5 py-0.5 font-semibold uppercase tracking-wide">Tagged</span>
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
