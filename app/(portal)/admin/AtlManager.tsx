"use client";

import { useRef, useState, useTransition } from "react";
import {
  addAtlLink,
  addClient,
  deleteAtlLink,
  deleteClient,
  updateAtlLink,
  updateClient,
} from "../atl/actions";
import { Button, Card, EmptyState, Input, Select } from "@/components/ui";
import { CADENCE_OPTIONS, cadenceLabel, KIND_OPTIONS as KINDS } from "@/lib/atl";

const TEAMS = ["ATL", "Digital", "Comms"];

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
};

export function AtlManager({ clients, links }: { clients: ClientRow[]; links: LinkRow[] }) {
  const [clientRows, setClientRows] = useState(clients);
  const [linkRows, setLinkRows] = useState(links);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function removeClient(id: number) {
    if (!confirm("Delete this client and all its links? This can't be undone.")) return;
    setClientRows((prev) => prev.filter((c) => c.id !== id));
    setLinkRows((prev) => prev.filter((l) => l.client_id !== id));
    startTransition(async () => {
      await deleteClient(id);
    });
  }

  function removeLink(id: number) {
    setLinkRows((prev) => prev.filter((l) => l.id !== id));
    startTransition(async () => {
      await deleteAtlLink(id);
    });
  }

  return (
    <div className="space-y-6">
      <AddClientForm onAdded={(c) => setClientRows((prev) => [...prev, c])} />

      {clientRows.length === 0 ? (
        <EmptyState title="No clients yet" />
      ) : (
        clientRows.map((client) =>
          editingClientId === client.id ? (
            <EditClientForm
              key={client.id}
              client={client}
              onSaved={(updated) => {
                setClientRows((prev) => prev.map((c) => (c.id === client.id ? { ...c, ...updated } : c)));
                setEditingClientId(null);
              }}
              onCancel={() => setEditingClientId(null)}
            />
          ) : (
            <Card key={client.id}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 flex-none rounded-full" style={{ background: client.colour || "#FDB600" }} />
                  <span className="font-semibold text-ink">{client.name}</span>
                  <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                    {client.team}
                  </span>
                  {!client.is_active && <span className="text-xs text-charcoal">(inactive)</span>}
                </div>
                <div className="flex flex-none gap-2">
                  <button
                    onClick={() => setEditingClientId(client.id)}
                    className="rounded-lg border border-border-c px-3 py-1.5 text-xs font-semibold text-charcoal hover:border-gold/50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeClient(client.id)}
                    className="rounded-lg border border-border-c px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-border-c pt-4">
                {linkRows
                  .filter((l) => l.client_id === client.id)
                  .map((link) => (
                    <LinkRowItem
                      key={link.id}
                      link={link}
                      onDelete={() => removeLink(link.id)}
                      onUpdated={(updated) =>
                        setLinkRows((prev) => prev.map((l) => (l.id === link.id ? { ...l, ...updated } : l)))
                      }
                    />
                  ))}
                <AddLinkInline
                  clientId={client.id}
                  onAdded={(l) => setLinkRows((prev) => [...prev, l])}
                />
              </div>
            </Card>
          ),
        )
      )}
    </div>
  );
}

function AddClientForm({ onAdded }: { onAdded: (c: ClientRow) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addClient(undefined, formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onAdded(result.client);
      formRef.current?.reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        + Add client
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-border-c bg-white p-4"
    >
      <Input name="name" placeholder="Client name" required className="w-48" />
      <Select name="team" defaultValue="ATL" className="w-32">
        {TEAMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Input name="colour" placeholder="#RRGGBB (optional)" className="w-40" />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-charcoal hover:text-ink">
        Cancel
      </button>
      {error && <p className="w-full text-xs font-medium text-red-600">{error}</p>}
    </form>
  );
}

function EditClientForm({
  client,
  onSaved,
  onCancel,
}: {
  client: ClientRow;
  onSaved: (updated: Partial<ClientRow>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(client);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateClient(undefined, formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSaved(values);
    });
  }

  return (
    <Card>
      <form action={submit} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={client.id} />
        <input type="hidden" name="is_active" value={values.is_active ? "true" : "false"} />
        <Input
          name="name"
          defaultValue={values.name}
          required
          className="w-48"
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        />
        <Select
          name="team"
          defaultValue={values.team}
          className="w-32"
          onChange={(e) => setValues((v) => ({ ...v, team: e.target.value }))}
        >
          {TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input
          name="colour"
          defaultValue={values.colour ?? ""}
          className="w-40"
          onChange={(e) => setValues((v) => ({ ...v, colour: e.target.value }))}
        />
        <label className="flex items-center gap-2 text-xs text-charcoal">
          <input
            type="checkbox"
            checked={values.is_active}
            onChange={(e) => setValues((v) => ({ ...v, is_active: e.target.checked }))}
            className="h-4 w-4 accent-gold"
          />
          Active
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <button type="button" onClick={onCancel} className="text-xs text-charcoal hover:text-ink">
          Cancel
        </button>
        {error && <p className="w-full text-xs font-medium text-red-600">{error}</p>}
      </form>
    </Card>
  );
}

function LinkRowItem({
  link,
  onDelete,
  onUpdated,
}: {
  link: LinkRow;
  onDelete: () => void;
  onUpdated: (updated: LinkRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(link);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateAtlLink(undefined, formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onUpdated(values);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <form action={submit} className="flex flex-wrap items-end gap-2 rounded-lg border border-gold/40 bg-bg p-2">
        <input type="hidden" name="id" value={link.id} />
        <Select
          name="kind"
          defaultValue={values.kind}
          className="w-32"
          onChange={(e) => setValues((v) => ({ ...v, kind: e.target.value }))}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
        <Input
          name="title"
          defaultValue={values.title}
          required
          className="w-36"
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
        />
        <Input
          name="url"
          defaultValue={values.url}
          required
          className="w-56"
          onChange={(e) => setValues((v) => ({ ...v, url: e.target.value }))}
        />
        <Input
          name="version_label"
          defaultValue={values.version_label ?? ""}
          className="w-28"
          onChange={(e) => setValues((v) => ({ ...v, version_label: e.target.value }))}
        />
        <Select
          name="cadence"
          defaultValue={values.cadence ?? ""}
          required
          className="w-40"
          onChange={(e) => setValues((v) => ({ ...v, cadence: e.target.value }))}
        >
          <option value="" disabled>
            Reporting cadence…
          </option>
          {CADENCE_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "Save"}
        </Button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-charcoal hover:text-ink">
          Cancel
        </button>
        {error && <p className="w-full text-xs font-medium text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-2 text-sm">
      <div>
        <span className="font-medium text-ink">{link.title}</span>
        <span className="ml-2 text-xs text-charcoal">
          {KINDS.find((k) => k.value === link.kind)?.label ?? link.kind}
          {link.version_label && ` · ${link.version_label}`}
          {` · ${cadenceLabel(link.cadence)}`}
        </span>
      </div>
      <div className="flex flex-none gap-2">
        <button onClick={() => setEditing(true)} className="text-xs font-semibold text-charcoal hover:text-gold">
          Edit
        </button>
        <button onClick={onDelete} className="text-xs font-semibold text-red-600 hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}

function AddLinkInline({ clientId, onAdded }: { clientId: number; onAdded: (l: LinkRow) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addAtlLink(undefined, formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onAdded(result.link);
      formRef.current?.reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold text-gold hover:underline">
        + Add link
      </button>
    );
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-wrap items-end gap-2 rounded-lg border border-border-c bg-bg p-2">
      <input type="hidden" name="client_id" value={clientId} />
      <Select name="kind" required className="w-32">
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </Select>
      <Input name="title" placeholder="Title" required className="w-36" />
      <Input name="url" placeholder="Drive link" required className="w-56" />
      <Input name="version_label" placeholder="v4 · 22 Jul" className="w-28" />
      <Select name="cadence" required defaultValue="" className="w-40">
        <option value="" disabled>
          Reporting cadence…
        </option>
        {CADENCE_OPTIONS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Add"}
      </Button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-charcoal hover:text-ink">
        Cancel
      </button>
      {error && <p className="w-full text-xs font-medium text-red-600">{error}</p>}
    </form>
  );
}
