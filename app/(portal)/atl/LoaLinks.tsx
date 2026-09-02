"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { FileSignature, Pencil, Plus, Trash2, X } from "lucide-react";
import { addResource, deleteResource, updateResource } from "@/lib/actions/resources";
import { Button, Input } from "@/components/ui";

export type LoaLink = { id: number; title: string; url: string | null };

const MAX_LOA_LINKS = 3;

export function LoaLinks({ items, isAdmin }: { items: LoaLink[]; isAdmin: boolean }) {
  const [rows, setRows] = useState(items);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  if (!isAdmin && rows.length === 0) return null;

  function remove(id: number) {
    if (!confirm("Delete this LOA link? This can't be undone.")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await deleteResource(id);
    });
  }

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {rows.map((item) =>
        editingId === item.id ? (
          <LoaLinkForm
            key={item.id}
            item={item}
            onSaved={(updated) => {
              setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, ...updated } : r)));
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div
            key={item.id}
            className="group flex items-center gap-2 rounded-xl border border-border-c bg-white px-3 py-2"
          >
            <FileSignature className="h-3.5 w-3.5 flex-none text-gold" strokeWidth={2} aria-hidden />
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-ink hover:text-gold"
              >
                {item.title}
              </a>
            ) : (
              <span className="text-sm font-semibold text-ink">{item.title}</span>
            )}
            {isAdmin && (
              <div className="ml-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => setEditingId(item.id)}
                  aria-label="Edit"
                  className="text-charcoal hover:text-ink"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2} />
                </button>
                <button onClick={() => remove(item.id)} aria-label="Delete" className="text-charcoal hover:text-red-600">
                  <Trash2 className="h-3 w-3" strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        ),
      )}

      {isAdmin && rows.length < MAX_LOA_LINKS && (
        adding ? (
          <LoaLinkForm
            onSaved={(created) => {
              setRows((prev) => [...prev, created as LoaLink]);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-border-c px-3 py-2 text-xs font-semibold text-charcoal hover:border-gold/50 hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Add LOA link
          </button>
        )
      )}
    </div>
  );
}

function LoaLinkForm({
  item,
  onSaved,
  onCancel,
}: {
  item?: LoaLink;
  onSaved: (updated: Partial<LoaLink> & { id: number }) => void;
  onCancel: () => void;
}) {
  const action = item ? updateResource : addResource;
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(item?.title ?? "");
  const [url, setUrl] = useState(item?.url ?? "");

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        const result = await formAction(fd);
        const typed = result as { success?: boolean; id?: number } | undefined;
        if (typed?.success) onSaved({ id: item?.id ?? typed.id!, title, url: url || null });
      }}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-white p-2"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="section" value="atl_loa_link" />
      <Input
        name="title"
        placeholder="Label (e.g. Client name LOA)"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-40"
      />
      <Input name="url" placeholder="Link" value={url} onChange={(e) => setUrl(e.target.value)} className="w-48" />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <button type="button" onClick={onCancel} aria-label="Cancel" className="text-charcoal hover:text-ink">
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
      {state?.error && <p className="w-full text-xs font-medium text-red-600">{state.error}</p>}
    </form>
  );
}
