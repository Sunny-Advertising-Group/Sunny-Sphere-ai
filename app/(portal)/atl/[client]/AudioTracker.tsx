"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { FileText, LayoutGrid, Library, Pencil, Play, Plus, Search, Trash2, X } from "lucide-react";
import { Button, Card, EmptyState, Input, Select, Textarea } from "@/components/ui";
import { AUDIO_STAGES, AUDIO_STATUS_OPTIONS, audioStageMeta, formatAudioDate, type AudioItemRow } from "@/lib/audio";
import { addAudioItem, deleteAudioItem, updateAudioItem, updateAudioItemStatus } from "../actions";

type View = "tracker" | "library";

const VIEW_TABS: { key: View; label: string; icon: typeof LayoutGrid; hint: string }[] = [
  {
    key: "tracker",
    label: "Tracker",
    icon: LayoutGrid,
    hint: "Every spot still in progress, grouped by production stage. Filter by estate to see one community's queue. Once a spot goes live it also joins the Library below.",
  },
  {
    key: "library",
    label: "Library",
    icon: Library,
    hint: "Everything that's live or has been live — a running archive, searchable by type, voice, or messaging. A spot auto-expires to Not live once its end date passes, unless you push the end date forward first.",
  },
];

export function AudioTracker({
  clientId,
  items,
  isAdmin,
}: {
  clientId: number;
  items: AudioItemRow[];
  isAdmin: boolean;
}) {
  const [rows, setRows] = useState(items);
  const [view, setView] = useState<View>("tracker");
  const [estateFilter, setEstateFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AudioItemRow | null>(null);
  const [, startTransition] = useTransition();

  const estates = useMemo(() => Array.from(new Set(rows.map((r) => r.estate))).sort(), [rows]);
  const tags = useMemo(
    () => Array.from(new Set(rows.map((r) => r.tag).filter((t): t is string => !!t))).sort(),
    [rows],
  );

  const byEstate = useMemo(
    () => (estateFilter === "all" ? rows : rows.filter((r) => r.estate === estateFilter)),
    [rows, estateFilter],
  );

  // The Library is the running archive of what's live or has been live — a
  // spot only joins it once it reaches that stage; anything still earlier in
  // the pipeline lives in the Tracker only.
  const libraryRows = useMemo(() => {
    let data = byEstate.filter((r) => r.status === "live" || r.status === "notlive");
    if (tagFilter !== "all") data = data.filter((r) => r.tag === tagFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      data = data.filter((r) =>
        [r.title, r.voice, r.tag, r.messaging].some((v) => v?.toLowerCase().includes(q)),
      );
    }
    return data;
  }, [byEstate, tagFilter, search]);

  function handleStatusChange(id: number, status: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    startTransition(async () => {
      await updateAudioItemStatus(id, status);
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this audio item? This can't be undone.")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await deleteAudioItem(id);
    });
  }

  function handleSaved(item: AudioItemRow) {
    setRows((prev) => (prev.some((r) => r.id === item.id) ? prev.map((r) => (r.id === item.id ? item : r)) : [...prev, item]));
    setModalOpen(false);
    setEditingItem(null);
  }

  function openEdit(item: AudioItemRow) {
    setEditingItem(item);
    setModalOpen(true);
  }

  function openAdd() {
    setEditingItem(null);
    setModalOpen(true);
  }

  const activeTab = VIEW_TABS.find((t) => t.key === view)!;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-ink p-1">
            {VIEW_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === key ? "bg-gold text-ink" : "text-white/80 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {label}
              </button>
            ))}
          </div>
          {estates.length > 1 && (
            <Select value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)} className="w-auto">
              <option value="all">All estates</option>
              {estates.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          )}
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden /> New audio
        </Button>
      </div>

      <p className="mb-4 max-w-2xl text-xs text-charcoal">{activeTab.hint}</p>

      {rows.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No audio briefed yet"
          description="Add the first spot with New audio — it'll show up here and move through the pipeline as it progresses."
        />
      ) : view === "tracker" ? (
        <TrackerView rows={byEstate} isAdmin={isAdmin} onStatusChange={handleStatusChange} onEdit={openEdit} onDelete={handleDelete} />
      ) : (
        <LibraryView
          rows={libraryRows}
          tags={tags}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          search={search}
          onSearchChange={setSearch}
          isAdmin={isAdmin}
          onStatusChange={handleStatusChange}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {modalOpen && (
        <AudioItemModal
          clientId={clientId}
          item={editingItem}
          onSaved={handleSaved}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}

function StatusSelect({
  status,
  onChange,
}: {
  status: string;
  onChange: (status: string) => void;
}) {
  const meta = audioStageMeta(status);
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border-0 py-1 pl-2 pr-6 text-[11px] font-semibold uppercase tracking-wide outline-none"
      style={{ background: `${meta.color}22`, color: meta.color === "#FDB600" ? "#8a6300" : meta.color }}
    >
      {AUDIO_STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function LinkIcons({ item }: { item: AudioItemRow }) {
  if (!item.script_url && !item.audio_url) return null;
  return (
    <div className="flex items-center gap-1">
      {item.script_url && (
        <a
          href={item.script_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open script"
          title="Open script"
          className="text-charcoal hover:text-ink"
        >
          <FileText className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      )}
      {item.audio_url && (
        <a
          href={item.audio_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Play audio"
          title="Play audio"
          className="text-charcoal hover:text-ink"
        >
          <Play className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      )}
    </div>
  );
}

function RowActions({
  item,
  isAdmin,
  onEdit,
  onDelete,
}: {
  item: AudioItemRow;
  isAdmin: boolean;
  onEdit: (item: AudioItemRow) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onEdit(item)} aria-label="Edit" className="text-charcoal hover:text-ink">
        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {isAdmin && (
        <button onClick={() => onDelete(item.id)} aria-label="Delete" className="text-charcoal hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function TrackerView({
  rows,
  isAdmin,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  rows: AudioItemRow[];
  isAdmin: boolean;
  onStatusChange: (id: number, status: string) => void;
  onEdit: (item: AudioItemRow) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {AUDIO_STAGES.map((stage) => {
        const stageRows = rows.filter((r) => r.status === stage.key);
        return (
          <div
            key={stage.key}
            className="w-60 flex-none rounded-xl border-t-4 bg-white"
            style={{ borderTopColor: stage.color }}
          >
            <div className="flex items-baseline justify-between px-3 pb-2 pt-3">
              <div className="text-xs font-bold uppercase tracking-wide text-ink">{stage.label}</div>
              <div className="text-xs font-semibold text-charcoal">{stageRows.length}</div>
            </div>
            <div className="flex flex-col gap-2 px-2.5 pb-2.5">
              {stageRows.length === 0 ? (
                <div className="py-3 text-center text-xs text-charcoal/40">Nothing here</div>
              ) : (
                stageRows.map((item) => (
                  <div key={item.id} className="group rounded-lg border border-border-c bg-bg p-2.5">
                    <div className="mb-0.5 flex items-start justify-between gap-1">
                      <div className="text-[10.5px] font-bold uppercase tracking-wide text-charcoal">{item.estate}</div>
                      <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <LinkIcons item={item} />
                        <RowActions item={item} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
                      </div>
                    </div>
                    <div className="mb-1 text-[13px] font-semibold leading-tight text-ink">{item.title}</div>
                    {item.messaging && <div className="mb-1.5 text-[11.5px] leading-snug text-charcoal">{item.messaging}</div>}
                    <div className="flex items-center justify-between text-[11px] text-charcoal">
                      <span>{item.station ?? "—"}</span>
                      <span>
                        {item.live_date ? formatAudioDate(item.live_date) : "TBC"}
                        {" → "}
                        {item.end_date ? formatAudioDate(item.end_date) : "Ongoing"}
                      </span>
                    </div>
                    {item.placement && (
                      <div className="mt-1.5 inline-block rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6300]">
                        {item.placement}
                      </div>
                    )}
                    <div className="mt-2">
                      <StatusSelect status={item.status} onChange={(s) => onStatusChange(item.id, s)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LibraryView({
  rows,
  tags,
  tagFilter,
  onTagFilterChange,
  search,
  onSearchChange,
  isAdmin,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  rows: AudioItemRow[];
  tags: string[];
  tagFilter: string;
  onTagFilterChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  isAdmin: boolean;
  onStatusChange: (id: number, status: string) => void;
  onEdit: (item: AudioItemRow) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/50" strokeWidth={2} aria-hidden />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title, voice, messaging, or keyword…"
            className="pl-9"
          />
        </div>
        {tags.length > 0 && (
          <Select value={tagFilter} onChange={(e) => onTagFilterChange(e.target.value)} className="w-auto">
            <option value="all">All types</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-charcoal/50">
          Nothing&rsquo;s live yet — spots show up here once they&rsquo;re marked Live on the Tracker.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((item) => (
              <Card key={item.id} className="flex flex-col">
                <div className="mb-1 flex items-start justify-between gap-1">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-charcoal">{item.estate}</div>
                  <RowActions item={item} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
                </div>
                <div className="mb-1.5 text-[14.5px] font-bold text-ink">{item.title}</div>
                {item.messaging && <div className="mb-2.5 text-xs leading-snug text-charcoal">{item.messaging}</div>}
                <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                  {item.tag && (
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10.5px] font-semibold text-charcoal">{item.tag}</span>
                  )}
                  <StatusSelect status={item.status} onChange={(s) => onStatusChange(item.id, s)} />
                </div>
                <div className="mb-2.5 flex flex-wrap justify-between gap-1 text-[11.5px] text-charcoal">
                  <span>Voice: {item.voice ?? "TBC"}</span>
                  <span>{item.duration ?? "—"}</span>
                  <span>
                    {item.live_date ? formatAudioDate(item.live_date) : "TBC"} →{" "}
                    {item.end_date ? formatAudioDate(item.end_date) : "Ongoing"}
                  </span>
                </div>
                <div className="mt-auto flex gap-2 border-t border-border-c pt-2.5">
                  {item.audio_url && (
                    <a
                      href={item.audio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border-c bg-bg px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:border-gold/50"
                    >
                      ▶ Audio file
                    </a>
                  )}
                  {item.script_url && (
                    <a
                      href={item.script_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border-c bg-bg px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:border-gold/50"
                    >
                      📄 Script
                    </a>
                  )}
                </div>
              </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AudioItemModal({
  clientId,
  item,
  onSaved,
  onClose,
}: {
  clientId: number;
  item: AudioItemRow | null;
  onSaved: (item: AudioItemRow) => void;
  onClose: () => void;
}) {
  const action = item ? updateAudioItem : addAudioItem;
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-ink">{item ? "Edit audio" : "Add new audio"}</h2>
            <p className="text-xs text-charcoal">Adds a row to the Tracker — and to the Library too once it&rsquo;s Live.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-charcoal hover:text-ink">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <form
          ref={formRef}
          action={async (fd) => {
            const result = await formAction(fd);
            const typed = result as { success?: boolean; item?: AudioItemRow } | undefined;
            if (typed?.success && typed.item) onSaved(typed.item);
          }}
          className="space-y-3"
        >
          <input type="hidden" name="client_id" value={clientId} />
          {item && <input type="hidden" name="id" value={item.id} />}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Estate">
              <Input name="estate" required defaultValue={item?.estate ?? ""} placeholder="e.g. Moama" />
            </Field>
            <Field label="Type / tag">
              <Input name="tag" defaultValue={item?.tag ?? ""} placeholder="e.g. Testimonial, Financial" />
            </Field>
          </div>

          <Field label="Audio title">
            <Input name="title" required defaultValue={item?.title ?? ""} placeholder="e.g. Sylvia Testimonial v2" />
          </Field>

          <Field label="Messaging">
            <Textarea name="messaging" defaultValue={item?.messaging ?? ""} placeholder="The core message or angle this audio needs to land" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Placement / campaign">
              <Input name="placement" defaultValue={item?.placement ?? ""} placeholder="e.g. Sept — Now Selling" />
            </Field>
            <Field label="Station">
              <Input name="station" defaultValue={item?.station ?? ""} placeholder="e.g. ARN" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Voice / talent">
              <Input name="voice" defaultValue={item?.voice ?? ""} placeholder="e.g. Sylvia" />
            </Field>
            <Field label="Duration">
              <Input name="duration" defaultValue={item?.duration ?? ""} placeholder="e.g. 0:30" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Live date">
              <Input type="date" name="live_date" defaultValue={item?.live_date ?? ""} />
            </Field>
            <Field label="End date">
              <Input type="date" name="end_date" defaultValue={item?.end_date ?? ""} />
              <span className="mt-1 block text-[10.5px] text-charcoal/70">Leave blank for ongoing/no fixed end.</span>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Script link">
              <Input name="script_url" defaultValue={item?.script_url ?? ""} placeholder="Drive/Scripts/…" />
            </Field>
            <Field label="Audio file link">
              <Input name="audio_url" defaultValue={item?.audio_url ?? ""} placeholder="Link once produced" />
            </Field>
          </div>

          <Field label="Status">
            <Select name="status" defaultValue={item?.status ?? "briefed"}>
              {AUDIO_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          {state?.error && <p className="text-xs font-medium text-red-600">{state.error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : item ? "Save changes" : "Add audio"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-charcoal">{label}</span>
      {children}
    </label>
  );
}
