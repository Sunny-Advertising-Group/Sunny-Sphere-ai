"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { deleteResource, updateResource } from "@/lib/actions/resources";
import { Button, Card, EmptyState, Input, Select, Textarea } from "@/components/ui";

const RESOURCE_TYPES = ["PDF", "Doc", "Folder", "Tool", "Video"];

export type ResourceRow = {
  id: number;
  group_name: string | null;
  title: string;
  description: string | null;
  resource_type: string | null;
  url: string | null;
  duration: string | null;
  module_count: number | null;
  body: string | null;
};

export function ResourceList({
  items,
  showBody = false,
  showDuration = false,
}: {
  items: ResourceRow[];
  showBody?: boolean;
  showDuration?: boolean;
}) {
  const [rows, setRows] = useState(items);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function remove(id: number) {
    if (!confirm("Delete this item? This can't be undone.")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await deleteResource(id);
    });
  }

  if (rows.length === 0) return <EmptyState title="Nothing here yet" />;

  return (
    <div className="space-y-3">
      {rows.map((item) =>
        editingId === item.id ? (
          <EditResourceForm
            key={item.id}
            item={item}
            showBody={showBody}
            showDuration={showDuration}
            onSaved={(updated) => {
              setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, ...updated } : r)));
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <Card key={item.id} className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-ink">{item.title}</div>
              {item.group_name && <div className="text-xs text-charcoal">{item.group_name}</div>}
              {item.description && <p className="mt-1 text-sm text-charcoal">{item.description}</p>}
              {item.body && <p className="mt-1 text-sm text-charcoal">{item.body}</p>}
              {item.url && <div className="mt-1 truncate text-xs text-charcoal">{item.url}</div>}
            </div>
            <div className="flex flex-none gap-2">
              <button
                onClick={() => setEditingId(item.id)}
                className="rounded-lg border border-border-c px-3 py-1.5 text-xs font-semibold text-charcoal hover:border-gold/50"
              >
                Edit
              </button>
              <button
                onClick={() => remove(item.id)}
                className="rounded-lg border border-border-c px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </Card>
        ),
      )}
    </div>
  );
}

function EditResourceForm({
  item,
  showBody,
  showDuration,
  onSaved,
  onCancel,
}: {
  item: ResourceRow;
  showBody: boolean;
  showDuration: boolean;
  onSaved: (updated: Partial<ResourceRow>) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateResource, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(item);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        const result = await formAction(fd);
        if ((result as { success?: boolean } | undefined)?.success) onSaved(values);
      }}
      className="space-y-3 rounded-xl border border-gold/40 bg-white p-4"
    >
      <input type="hidden" name="id" value={item.id} />
      <div className="grid grid-cols-2 gap-3">
        <Input
          name="group_name"
          placeholder="Group"
          defaultValue={values.group_name ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, group_name: e.target.value }))}
        />
        <Input
          name="title"
          placeholder="Title"
          required
          defaultValue={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
        />
      </div>
      {showBody ? (
        <Textarea
          name="body"
          placeholder="Body"
          defaultValue={values.body ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, body: e.target.value }))}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Input
            name="url"
            placeholder="Link"
            defaultValue={values.url ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, url: e.target.value }))}
          />
          <Select
            name="resource_type"
            defaultValue={values.resource_type ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, resource_type: e.target.value }))}
          >
            <option value="">Type</option>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Textarea
        name="description"
        placeholder="Description (optional)"
        defaultValue={values.description ?? ""}
        onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
      />
      {showDuration && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            name="duration"
            placeholder="Duration"
            defaultValue={values.duration ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, duration: e.target.value }))}
          />
          <Input
            name="module_count"
            type="number"
            placeholder="Module count"
            defaultValue={values.module_count ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, module_count: Number(e.target.value) }))}
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <button type="button" onClick={onCancel} className="text-xs text-charcoal hover:text-ink">
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-xs font-medium text-red-600">{state.error}</p>}
    </form>
  );
}
