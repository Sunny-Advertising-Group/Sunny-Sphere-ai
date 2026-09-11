"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { BarChart3, Check, ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { Button, Card, EmptyState, Input, Select, Textarea } from "@/components/ui";
import {
  buildAtlChecklistData,
  buildServiceTaskData,
  cadenceLabel,
  categoryKind,
  groupChecklistByClient,
  groupServiceTasksByClient,
  kindLabel,
  CADENCE_OPTIONS,
  KIND_ORDER,
  SERVICE_TASK_STATUS_META,
  type ChecklistLogInput,
  type ServiceTaskInput,
  type ServiceTaskItem,
  type ServiceTaskLogInput,
} from "@/lib/atl";
import {
  addServiceTask,
  bulkAddServiceTaskToAllClients,
  deleteServiceTask,
  logAtlChecklist,
  logServiceTask,
  unlogAtlChecklist,
  unlogServiceTask,
  updateServiceTask,
} from "./actions";
import { LoaLinks, type LoaLink } from "./LoaLinks";

export type PersonRow = { id: string; name: string };

const TEAM_ORDER = ["ATL", "Digital", "Comms"];

export type ClientRow = {
  id: number;
  name: string;
  colour: string | null;
  team: string;
  is_active: boolean;
};

export type LinkRow = {
  id: number;
  client_id: number;
  kind: string;
  title: string;
  url: string;
  version_label: string | null;
  cadence: string | null;
  client_name: string;
  client_colour: string | null;
};

export function AtlHub({
  clients,
  links,
  checklistLogs,
  serviceTasks,
  serviceTaskLogs,
  loaLinks,
  assigneesByClient,
  people,
  isAdmin,
  currentUserId,
}: {
  clients: ClientRow[];
  links: LinkRow[];
  checklistLogs: ChecklistLogInput[];
  serviceTasks: ServiceTaskInput[];
  serviceTaskLogs: ServiceTaskLogInput[];
  loaLinks: LoaLink[];
  assigneesByClient: Record<number, PersonRow[]>;
  people: PersonRow[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [view, setView] = useState<"checklist" | "client" | "category">("checklist");
  const [openKinds, setOpenKinds] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState(checklistLogs);
  const [tasks, setTasks] = useState(serviceTasks);
  const [taskLogs, setTaskLogs] = useState(serviceTaskLogs);
  const [completeModalItem, setCompleteModalItem] = useState<ServiceTaskItem | null>(null);
  const [, startTransition] = useTransition();
  const peopleByIdMap = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);

  function toggleKind(kind: string) {
    setOpenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const checklist = useMemo(
    () =>
      buildAtlChecklistData(
        links.map((l) => ({
          id: l.id,
          clientId: l.client_id,
          clientName: l.client_name,
          clientColour: l.client_colour,
          kind: l.kind,
          title: l.title,
          cadence: l.cadence,
        })),
        logs,
      ),
    [links, logs],
  );

  function tick(atlLinkId: number) {
    const optimisticStamp = new Date().toISOString();
    setLogs((prev) => [...prev, { atl_link_id: atlLinkId, completed_at: optimisticStamp, voided_at: null }]);
    startTransition(async () => {
      const result = await logAtlChecklist(atlLinkId);
      if ((result as { error?: string })?.error) {
        setLogs((prev) => prev.filter((l) => !(l.atl_link_id === atlLinkId && l.completed_at === optimisticStamp)));
      }
    });
  }

  function untick(atlLinkId: number) {
    const voidedAt = new Date().toISOString();
    let reverted: ChecklistLogInput[] = logs;
    setLogs((prev) => {
      reverted = prev;
      return prev.map((l) => (l.atl_link_id === atlLinkId && !l.voided_at ? { ...l, voided_at: voidedAt } : l));
    });
    startTransition(async () => {
      const result = await unlogAtlChecklist(atlLinkId);
      if ((result as { error?: string })?.error) setLogs(reverted);
    });
  }

  const serviceTaskData = useMemo(
    () =>
      buildServiceTaskData(
        clients.map((c) => ({ id: c.id, name: c.name, colour: c.colour })),
        tasks,
        taskLogs,
      ),
    [clients, tasks, taskLogs],
  );

  function completeTask(taskId: number, completedBy: string, note: string) {
    const optimisticStamp = new Date().toISOString();
    setTaskLogs((prev) => [
      ...prev,
      { task_id: taskId, completed_by: completedBy, completed_at: optimisticStamp, voided_at: null, note: note || null },
    ]);
    startTransition(async () => {
      const result = await logServiceTask(taskId, completedBy, note);
      if ((result as { error?: string })?.error) {
        setTaskLogs((prev) => prev.filter((l) => !(l.task_id === taskId && l.completed_at === optimisticStamp)));
      }
    });
  }

  function untickTask(taskId: number) {
    const voidedAt = new Date().toISOString();
    let reverted: ServiceTaskLogInput[] = taskLogs;
    setTaskLogs((prev) => {
      reverted = prev;
      return prev.map((l) => (l.task_id === taskId && !l.voided_at ? { ...l, voided_at: voidedAt } : l));
    });
    startTransition(async () => {
      const result = await unlogServiceTask(taskId);
      if ((result as { error?: string })?.error) setTaskLogs(reverted);
    });
  }

  function addTask(clientId: number, title: string, cadence: string, assignedTo: string | null) {
    startTransition(async () => {
      const result = await addServiceTask(clientId, title, cadence, assignedTo);
      const task = (result as { task?: ServiceTaskInput })?.task;
      if (task) setTasks((prev) => [...prev, task]);
    });
  }

  function editTask(taskId: number, fields: { cadence?: string; assignedTo?: string | null }) {
    const reverted = tasks;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...(fields.cadence ? { cadence: fields.cadence } : {}), ...(fields.assignedTo !== undefined ? { assigned_to: fields.assignedTo } : {}) } : t)));
    startTransition(async () => {
      const result = await updateServiceTask(taskId, fields);
      if ((result as { error?: string })?.error) setTasks(reverted);
    });
  }

  function removeTask(taskId: number) {
    const reverted = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    startTransition(async () => {
      const result = await deleteServiceTask(taskId);
      if ((result as { error?: string })?.error) setTasks(reverted);
    });
  }

  function bulkAddTask(title: string, cadence: string) {
    startTransition(async () => {
      const result = await bulkAddServiceTaskToAllClients(title, cadence);
      const newTasks = (result as { tasks?: ServiceTaskInput[] })?.tasks;
      if (newTasks) setTasks((prev) => [...prev, ...newTasks]);
    });
  }

  const byTeam = useMemo(
    () =>
      TEAM_ORDER.map((team) => ({ team, clients: clients.filter((c) => c.team === team) })).filter(
        (g) => g.clients.length > 0,
      ),
    [clients],
  );

  const byCategory = useMemo(() => {
    const kinds = Array.from(new Set(links.map((l) => categoryKind(l.kind))));
    const ordered = [
      ...KIND_ORDER.filter((k) => kinds.includes(k)),
      ...kinds.filter((k) => !KIND_ORDER.includes(k)).sort(),
    ];
    return ordered.map((kind) => ({
      kind,
      links: links
        .filter((l) => categoryKind(l.kind) === kind)
        .sort((a, b) => a.client_name.localeCompare(b.client_name)),
    }));
  }, [links]);

  if (clients.length === 0) {
    return (
      <div className="p-8">
        <EmptyState icon={BarChart3} title="No clients yet" description="Add a client to start linking their ATL material." />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 border-b border-border-c bg-white px-8 py-4">
        {(["checklist", "client", "category"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              view === v ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
            }`}
          >
            {v === "checklist" ? "Checklist" : v === "client" ? "By client" : "By category"}
          </button>
        ))}
      </div>

      <div className="space-y-10 p-8">
        {view === "checklist" ? (
          <div className="space-y-8">
            <LoaLinks items={loaLinks} isAdmin={isAdmin} />
            <div>
              <h2 className="mb-3 text-sm font-bold text-ink">Service level</h2>
              <ServiceTaskBoard
                items={serviceTaskData.items}
                completionPct={serviceTaskData.completionPct}
                totalDone={serviceTaskData.totalDone}
                totalActive={serviceTaskData.totalActive}
                clients={clients}
                assigneesByClient={assigneesByClient}
                peopleById={peopleByIdMap}
                isAdmin={isAdmin}
                onTick={(item) => setCompleteModalItem(item)}
                onUntick={(item) => untickTask(item.taskId)}
                onAddTask={addTask}
                onEditTask={editTask}
                onRemoveTask={removeTask}
                onBulkAddTask={bulkAddTask}
              />
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold text-ink">Links checklist</h2>
              <ChecklistBoard cards={checklist.cards} completionPct={checklist.completionPct} totalDone={checklist.totalDone} totalActive={checklist.totalActive} onTick={tick} onUntick={untick} />
            </div>
          </div>
        ) : view === "client" ? (
          byTeam.map((group) => (
            <div key={group.team}>
              <h2 className="mb-3 text-sm font-bold text-ink">{group.team}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.clients.map((client) => (
                  <Link key={client.id} href={`/atl/${encodeURIComponent(client.name)}`}>
                    <Card className="flex items-center gap-3 transition-colors hover:border-gold/50">
                      <span
                        className="h-3 w-3 flex-none rounded-full"
                        style={{ background: client.colour || "#FDB600" }}
                      />
                      <div>
                        <div className="font-semibold text-ink">{client.name}</div>
                        {!client.is_active && <div className="text-xs text-charcoal">Inactive</div>}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))
        ) : byCategory.length === 0 ? (
          <EmptyState icon={BarChart3} title="No links yet" description="Add links to clients to see them grouped by category here." />
        ) : (
          byCategory.map((group) => {
            const isOpen = openKinds.has(group.kind);
            return (
              <div key={group.kind}>
                <button
                  onClick={() => toggleKind(group.kind)}
                  className="mb-3 flex w-full items-center gap-2 text-left"
                >
                  {isOpen ? (
                    <ChevronDown size={18} className="flex-none text-charcoal" />
                  ) : (
                    <ChevronRight size={18} className="flex-none text-charcoal" />
                  )}
                  <h2 className="text-sm font-bold text-ink">{kindLabel(group.kind)}</h2>
                  <span className="text-xs font-medium text-charcoal">({group.links.length})</span>
                </button>
                {isOpen && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.links.map((link) => (
                      <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="block">
                        <Card className="h-full transition-colors hover:border-gold/50">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 flex-none rounded-full"
                              style={{ background: link.client_colour || "#FDB600" }}
                            />
                            <div
                              className="text-sm font-bold uppercase tracking-wide"
                              style={{ color: link.client_colour || "#FDB600" }}
                            >
                              {link.client_name}
                            </div>
                          </div>
                          <div className="mt-1 font-semibold text-ink">{link.title}</div>
                          {link.version_label && (
                            <div className="mt-1 text-xs text-charcoal">{link.version_label}</div>
                          )}
                        </Card>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {completeModalItem && (
        <ServiceTaskCompleteModal
          item={completeModalItem}
          people={assigneesByClient[completeModalItem.clientId]?.length ? assigneesByClient[completeModalItem.clientId] : people}
          currentUserId={currentUserId}
          onSubmit={(completedBy, note) => {
            completeTask(completeModalItem.taskId, completedBy, note);
            setCompleteModalItem(null);
          }}
          onClose={() => setCompleteModalItem(null)}
        />
      )}
    </div>
  );
}

function ChecklistBoard({
  cards,
  completionPct,
  totalDone,
  totalActive,
  onTick,
  onUntick,
}: {
  cards: ReturnType<typeof buildAtlChecklistData>["cards"];
  completionPct: number;
  totalDone: number;
  totalActive: number;
  onTick: (id: number) => void;
  onUntick: (id: number) => void;
}) {
  if (cards.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No cadenced links yet"
        description="Give a link a reporting cadence (not 'Doesn't need to be updated') from Admin to have it show up here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal">
          Checklist completion this period
        </div>
        <div className="mt-0.5 text-lg font-extrabold text-ink">{completionPct}%</div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-gold" style={{ width: `${completionPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-charcoal">
          {totalDone} of {totalActive} updated this period
        </div>
      </Card>

      <div className="flex flex-col gap-1.5">
        {groupChecklistByClient(cards).map((group) => (
          <div
            key={group.clientId}
            className={`flex flex-wrap items-center gap-2 rounded-xl border p-1.5 transition-colors ${
              group.allDone ? "border-emerald-300 bg-emerald-50" : "border-border-c bg-white"
            }`}
          >
            <div className="flex min-w-[180px] flex-none items-center gap-2 rounded-lg bg-ink px-2.5 py-1.5 text-white">
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: group.clientColour || "#FDB600" }} />
              <div>
                <div className="text-sm font-bold">{group.clientName}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                  {group.cadences.map(cadenceLabel).join(" · ")}
                </div>
              </div>
            </div>
            <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-1.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.done ? onUntick(item.id) : onTick(item.id))}
                  title={item.done ? "Click to undo this period's tick" : "Mark updated for this period"}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    item.done
                      ? "border-emerald-300 bg-emerald-100 text-emerald-800 hover:border-emerald-400"
                      : "border-border-c bg-white text-ink hover:border-gold/50"
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded border ${
                      item.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border-c bg-white"
                    }`}
                  >
                    {item.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </span>
                  {kindLabel(item.kind)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceTaskBoard({
  items,
  completionPct,
  totalDone,
  totalActive,
  clients,
  assigneesByClient,
  peopleById,
  isAdmin,
  onTick,
  onUntick,
  onAddTask,
  onEditTask,
  onRemoveTask,
  onBulkAddTask,
}: {
  items: ServiceTaskItem[];
  completionPct: number;
  totalDone: number;
  totalActive: number;
  clients: ClientRow[];
  assigneesByClient: Record<number, PersonRow[]>;
  peopleById: Map<string, string>;
  isAdmin: boolean;
  onTick: (item: ServiceTaskItem) => void;
  onUntick: (item: ServiceTaskItem) => void;
  onAddTask: (clientId: number, title: string, cadence: string, assignedTo: string | null) => void;
  onEditTask: (taskId: number, fields: { cadence?: string; assignedTo?: string | null }) => void;
  onRemoveTask: (taskId: number) => void;
  onBulkAddTask: (title: string, cadence: string) => void;
}) {
  const [addingForClient, setAddingForClient] = useState<number | null>(null);
  const [bulkAdding, setBulkAdding] = useState(false);

  if (clients.length === 0) {
    return <EmptyState icon={BarChart3} title="No ATL clients yet" />;
  }

  const groups = groupServiceTasksByClient(items);
  const groupsByClientId = new Map(groups.map((g) => [g.clientId, g]));

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal">
          Service level completion this period
        </div>
        <div className="mt-0.5 text-lg font-extrabold text-ink">{completionPct}%</div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-gold" style={{ width: `${completionPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-charcoal">{totalDone} of {totalActive} tasks up to date this period</div>
      </Card>

      {isAdmin && (
        <div>
          {bulkAdding ? (
            <AddServiceTaskForm
              people={[]}
              hideAssignee
              onSubmit={(title, cadence) => {
                onBulkAddTask(title, cadence);
                setBulkAdding(false);
              }}
              onCancel={() => setBulkAdding(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setBulkAdding(true)}
              className="flex items-center gap-1 rounded-full border border-border-c px-3 py-1.5 text-xs font-semibold text-charcoal hover:border-gold hover:text-ink"
            >
              <Plus size={12} /> Add task to every ATL client
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {clients.map((client) => {
          const group = groupsByClientId.get(client.id);
          const clientPeople = assigneesByClient[client.id] ?? [];
          return (
            <Card key={client.id} className="p-0">
              <div className="flex items-center justify-between gap-2 rounded-t-xl bg-ink px-3 py-2 text-white">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: client.colour || "#FDB600" }} />
                  <div className="text-sm font-bold">{client.name}</div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setAddingForClient(addingForClient === client.id ? null : client.id)}
                    className="flex items-center gap-1 rounded-full border border-white/30 px-2 py-0.5 text-[11px] font-semibold text-white hover:border-gold"
                  >
                    <Plus size={12} /> Task
                  </button>
                )}
              </div>

              {addingForClient === client.id && (
                <AddServiceTaskForm
                  people={clientPeople}
                  onSubmit={(title, cadence, assignedTo) => {
                    onAddTask(client.id, title, cadence, assignedTo);
                    setAddingForClient(null);
                  }}
                  onCancel={() => setAddingForClient(null)}
                />
              )}

              {!group || group.items.length === 0 ? (
                <div className="p-3 text-xs text-charcoal">No tasks set up for this client yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border-c text-left uppercase text-charcoal">
                        <th className="px-3 py-2">Task</th>
                        <th className="px-3 py-2">Assigned to</th>
                        <th className="px-3 py-2">Cadence</th>
                        <th className="px-3 py-2">Complete</th>
                        <th className="px-3 py-2">Last completed</th>
                        <th className="px-3 py-2">Completed by</th>
                        <th className="px-3 py-2">Next due</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Notes</th>
                        {isAdmin && <th className="px-3 py-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => {
                        const statusMeta = SERVICE_TASK_STATUS_META[item.status];
                        return (
                          <tr key={item.taskId} className="border-b border-border-c align-top last:border-0">
                            <td className="px-3 py-2 font-medium text-ink">{item.title}</td>
                            <td className="px-3 py-2">
                              {isAdmin ? (
                                <Select
                                  value={item.assignedTo ?? ""}
                                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                    onEditTask(item.taskId, { assignedTo: e.target.value || null })
                                  }
                                  className="!py-1 text-xs"
                                >
                                  <option value="">Unassigned</option>
                                  {clientPeople.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </Select>
                              ) : (
                                <span className="text-charcoal">
                                  {(item.assignedTo && peopleById.get(item.assignedTo)) || "Unassigned"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isAdmin ? (
                                <Select
                                  value={item.cadence}
                                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                    onEditTask(item.taskId, { cadence: e.target.value })
                                  }
                                  className="!py-1 text-xs"
                                >
                                  {CADENCE_OPTIONS.filter((c) => c.value !== "none").map((c) => (
                                    <option key={c.value} value={c.value}>
                                      {c.label}
                                    </option>
                                  ))}
                                </Select>
                              ) : (
                                <span className="text-charcoal">{cadenceLabel(item.cadence)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => (item.done ? onUntick(item) : onTick(item))}
                                title={
                                  item.done
                                    ? item.lastNote || "Click to undo this period's tick"
                                    : "Mark done for this period"
                                }
                                className={`flex h-5 w-5 items-center justify-center rounded border ${
                                  item.done
                                    ? "border-emerald-500 bg-emerald-500 text-white"
                                    : "border-border-c bg-white hover:border-gold"
                                }`}
                              >
                                {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-charcoal">
                              {item.lastCompletedAt ? new Date(item.lastCompletedAt).toLocaleDateString("en-AU") : "—"}
                            </td>
                            <td className="px-3 py-2 text-charcoal">
                              {(item.lastCompletedBy && peopleById.get(item.lastCompletedBy)) || "—"}
                            </td>
                            <td className="px-3 py-2 text-charcoal">
                              {item.nextDue ? item.nextDue.toLocaleDateString("en-AU") : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}>
                                {statusMeta.label}
                              </span>
                            </td>
                            <td className="max-w-[200px] whitespace-normal px-3 py-2 text-charcoal">
                              {item.lastNote ?? "—"}
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => onRemoveTask(item.taskId)}
                                  aria-label="Delete task"
                                  className="text-charcoal hover:text-red-600"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AddServiceTaskForm({
  people,
  hideAssignee,
  onSubmit,
  onCancel,
}: {
  people: PersonRow[];
  hideAssignee?: boolean;
  onSubmit: (title: string, cadence: string, assignedTo: string | null) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState("monthly");
  const [assignedTo, setAssignedTo] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-c bg-black/5 p-3">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title (e.g. Client phone call)"
        className="min-w-[180px] flex-1 !py-1 text-xs"
      />
      <Select value={cadence} onChange={(e) => setCadence(e.target.value)} className="!py-1 text-xs">
        {CADENCE_OPTIONS.filter((c) => c.value !== "none").map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
      {!hideAssignee && (
        <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="!py-1 text-xs">
          <option value="">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      )}
      <Button
        type="button"
        onClick={() => {
          if (!title.trim()) return;
          onSubmit(title, cadence, assignedTo || null);
        }}
      >
        Add
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function ServiceTaskCompleteModal({
  item,
  people,
  currentUserId,
  onSubmit,
  onClose,
}: {
  item: ServiceTaskItem;
  people: PersonRow[];
  currentUserId: string;
  onSubmit: (completedBy: string, note: string) => void;
  onClose: () => void;
}) {
  const [completedBy, setCompletedBy] = useState(
    people.some((p) => p.id === currentUserId) ? currentUserId : people[0]?.id ?? "",
  );
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-ink">{item.title}</h2>
            <p className="text-xs text-charcoal">{item.clientName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-charcoal hover:text-ink">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-charcoal">
          Completed by
        </label>
        <Select value={completedBy} onChange={(e) => setCompletedBy(e.target.value)} className="mb-3 w-full">
          {people.length === 0 && <option value="">No one assigned</option>}
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notes (optional)"
          className="mb-4"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!completedBy} onClick={() => onSubmit(completedBy, note)}>
            Log it
          </Button>
        </div>
      </div>
    </div>
  );
}
