"use client";

import { useRef, useState, useTransition } from "react";
import {
  addAtlLink,
  addClient,
  addClientAssignee,
  deleteAtlLink,
  deleteClient,
  removeClientAssignee,
  updateAtlLink,
  updateClient,
} from "../atl/actions";
import {
  addClientChannel,
  addDigitalClientAssignee,
  removeDigitalClientAssignee,
  setClientChannelActive,
} from "../digital-opti/actions";
import { Button, Card, EmptyState, Input, Select } from "@/components/ui";
import { AssigneePicker, type PersonOption } from "@/components/AssigneePicker";
import { CADENCE_OPTIONS as ATL_CADENCE_OPTIONS, cadenceLabel as atlCadenceLabel, KIND_OPTIONS as KINDS } from "@/lib/atl";
import { CADENCE_OPTIONS, CHANNEL_OPTIONS, cadenceLabel } from "@/lib/digitalOpti";

// Kept outside the component (rather than calling Date.now() inline in a
// closure defined during render) so it isn't flagged as an impure call by
// the React Compiler eslint rules.
function nextTempId(): number {
  return -Date.now();
}

const TEAMS = ["ATL", "Digital", "Comms"];
const DIGITAL_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "set_up", label: "Set up" },
  { value: "archived", label: "Archived" },
];
const MAX_ATL_ASSIGNEES = 4;

// The single shared client roster — a client can be on ATL, Digital, both, or
// (rarely) neither, toggled via on_atl/on_digital. Shared fields (name,
// colour, WIP link) live once; each team's own fields sit alongside.
export type ClientRow = {
  id: number;
  name: string;
  colour: string | null;
  team: string;
  is_active: boolean;
  on_atl: boolean;
  on_digital: boolean;
  wip_doc_url: string | null;
  retainer: number | null;
  digital_status: string | null;
  digital_cadence: string | null;
  account_lead_id: string | null;
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

export type ChannelRow = { id: number; client_id: number; channel: string; is_active: boolean };

export function ClientsManager({
  clients,
  links,
  channels,
  atlAssigneesByClient,
  digitalAssigneesByClient,
  people,
}: {
  clients: ClientRow[];
  links: LinkRow[];
  channels: ChannelRow[];
  atlAssigneesByClient: Record<number, string[]>;
  digitalAssigneesByClient: Record<number, string[]>;
  people: PersonOption[];
}) {
  const [clientRows, setClientRows] = useState(clients);
  const [linkRows, setLinkRows] = useState(links);
  const [channelRows, setChannelRows] = useState(channels);
  const [atlAssignments, setAtlAssignments] = useState(atlAssigneesByClient);
  const [digitalAssignments, setDigitalAssignments] = useState(digitalAssigneesByClient);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function removeClient(id: number) {
    if (!confirm("Delete this client entirely — ATL and Digital alike? This can't be undone.")) return;
    setClientRows((prev) => prev.filter((c) => c.id !== id));
    setLinkRows((prev) => prev.filter((l) => l.client_id !== id));
    setChannelRows((prev) => prev.filter((ch) => ch.client_id !== id));
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

  function assignAtl(clientId: number, profileId: string) {
    setAtlAssignments((prev) => ({ ...prev, [clientId]: [...(prev[clientId] ?? []), profileId] }));
    startTransition(async () => {
      await addClientAssignee(clientId, profileId);
    });
  }
  function unassignAtl(clientId: number, profileId: string) {
    setAtlAssignments((prev) => ({ ...prev, [clientId]: (prev[clientId] ?? []).filter((id) => id !== profileId) }));
    startTransition(async () => {
      await removeClientAssignee(clientId, profileId);
    });
  }
  function assignDigital(clientId: number, profileId: string) {
    setDigitalAssignments((prev) => ({ ...prev, [clientId]: [...(prev[clientId] ?? []), profileId] }));
    startTransition(async () => {
      await addDigitalClientAssignee(clientId, profileId);
    });
  }
  function unassignDigital(clientId: number, profileId: string) {
    setDigitalAssignments((prev) => ({
      ...prev,
      [clientId]: (prev[clientId] ?? []).filter((id) => id !== profileId),
    }));
    startTransition(async () => {
      await removeDigitalClientAssignee(clientId, profileId);
    });
  }

  function toggleChannel(clientId: number, channelValue: string) {
    const existing = channelRows.find((ch) => ch.client_id === clientId && ch.channel === channelValue);
    if (!existing) {
      const tempId = nextTempId();
      setChannelRows((prev) => [...prev, { id: tempId, client_id: clientId, channel: channelValue, is_active: true }]);
      startTransition(async () => {
        const result = await addClientChannel(clientId, channelValue);
        const created = (result as { channel?: ChannelRow } | undefined)?.channel;
        if (created) setChannelRows((prev) => prev.map((ch) => (ch.id === tempId ? created : ch)));
      });
    } else {
      const nextActive = !existing.is_active;
      setChannelRows((prev) => prev.map((ch) => (ch.id === existing.id ? { ...ch, is_active: nextActive } : ch)));
      startTransition(async () => {
        await setClientChannelActive(existing.id, nextActive);
      });
    }
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
              people={people}
              onSaved={(updated) => {
                setClientRows((prev) => prev.map((c) => (c.id === client.id ? { ...c, ...updated } : c)));
                setEditingClientId(null);
              }}
              onCancel={() => setEditingClientId(null)}
            />
          ) : (
            <Card key={client.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 flex-none rounded-full" style={{ background: client.colour || "#FDB600" }} />
                  <span className="font-semibold text-ink">{client.name}</span>
                  <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                    {client.team}
                  </span>
                  {client.on_atl && <span className="rounded-full border border-border-c px-2 py-0.5 text-[11px] font-semibold text-charcoal">ATL</span>}
                  {client.on_digital && (
                    <span className="rounded-full border border-border-c px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                      Digital
                    </span>
                  )}
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

              {client.on_atl && (
                <div className="mt-4 border-t border-border-c pt-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-charcoal">ATL assigned</span>
                    <AssigneePicker
                      assigned={(atlAssignments[client.id] ?? [])
                        .map((id) => people.find((p) => p.id === id))
                        .filter((p): p is PersonOption => !!p)}
                      options={people}
                      max={MAX_ATL_ASSIGNEES}
                      onAdd={(profileId) => assignAtl(client.id, profileId)}
                      onRemove={(profileId) => unassignAtl(client.id, profileId)}
                    />
                  </div>
                  <div className="space-y-2">
                    {linkRows
                      .filter((l) => l.client_id === client.id)
                      .map((link) => (
                        <LinkRowItem key={link.id} link={link} onDelete={() => removeLink(link.id)} />
                      ))}
                    <AddLinkInline clientId={client.id} onAdded={(l) => setLinkRows((prev) => [...prev, l])} />
                  </div>
                </div>
              )}

              {client.on_digital && (
                <div className="mt-4 border-t border-border-c pt-4">
                  <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-xs text-charcoal">
                      {DIGITAL_STATUSES.find((s) => s.value === client.digital_status)?.label ?? "Active"}
                      {client.retainer != null && ` · $${client.retainer.toLocaleString()}`}
                      {` · ${cadenceLabel(client.digital_cadence ?? "weekly")}`}
                    </span>
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-charcoal">
                      Additional assignees
                    </span>
                    <AssigneePicker
                      assigned={(digitalAssignments[client.id] ?? [])
                        .map((id) => people.find((p) => p.id === id))
                        .filter((p): p is PersonOption => !!p)}
                      options={people}
                      onAdd={(profileId) => assignDigital(client.id, profileId)}
                      onRemove={(profileId) => unassignDigital(client.id, profileId)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CHANNEL_OPTIONS.map((c) => {
                      const existing = channelRows.find((ch) => ch.client_id === client.id && ch.channel === c.value);
                      const active = existing?.is_active ?? false;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => toggleChannel(client.id, c.value)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? "border-gold bg-gold text-ink"
                              : "border-border-c text-charcoal hover:border-gold/50"
                          }`}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          ),
        )
      )}
    </div>
  );
}

function ClientFieldset({
  people,
  values,
  onChange,
}: {
  people: PersonOption[];
  values: ClientRow;
  onChange: (updater: (v: ClientRow) => ClientRow) => void;
}) {
  return (
    <>
      <input type="hidden" name="on_atl" value={values.on_atl ? "true" : "false"} />
      <input type="hidden" name="on_digital" value={values.on_digital ? "true" : "false"} />
      <input type="hidden" name="is_active" value={values.is_active ? "true" : "false"} />

      <Input
        name="name"
        defaultValue={values.name}
        required
        className="w-44"
        onChange={(e) => onChange((v) => ({ ...v, name: e.target.value }))}
      />
      <Select
        name="team"
        defaultValue={values.team}
        className="w-28"
        onChange={(e) => onChange((v) => ({ ...v, team: e.target.value }))}
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
        placeholder="#RRGGBB"
        className="w-32"
        onChange={(e) => onChange((v) => ({ ...v, colour: e.target.value }))}
      />
      <Input
        name="wip_doc_url"
        defaultValue={values.wip_doc_url ?? ""}
        placeholder="WIP link"
        className="w-48"
        onChange={(e) => onChange((v) => ({ ...v, wip_doc_url: e.target.value }))}
      />

      <label className="flex items-center gap-2 text-xs text-charcoal">
        <input
          type="checkbox"
          checked={values.on_atl}
          onChange={(e) => onChange((v) => ({ ...v, on_atl: e.target.checked }))}
          className="h-4 w-4 accent-gold"
        />
        On ATL
      </label>
      <label className="flex items-center gap-2 text-xs text-charcoal">
        <input
          type="checkbox"
          checked={values.on_digital}
          onChange={(e) => onChange((v) => ({ ...v, on_digital: e.target.checked }))}
          className="h-4 w-4 accent-gold"
        />
        On Digital
      </label>
      <label className="flex items-center gap-2 text-xs text-charcoal">
        <input
          type="checkbox"
          checked={values.is_active}
          onChange={(e) => onChange((v) => ({ ...v, is_active: e.target.checked }))}
          className="h-4 w-4 accent-gold"
        />
        Active (ATL)
      </label>

      {/* Always submitted (even while On Digital is unchecked) so toggling it
          off and back on doesn't wipe out the retainer/status/cadence/lead
          the admin already set up. */}
      <input type="hidden" name="retainer" value={values.retainer ?? ""} />
      <input type="hidden" name="digital_status" value={values.digital_status ?? "active"} />
      <input type="hidden" name="digital_cadence" value={values.digital_cadence ?? "weekly"} />
      <input type="hidden" name="account_lead_id" value={values.account_lead_id ?? ""} />

      {values.on_digital && (
        <>
          <Input
            type="number"
            step="0.01"
            defaultValue={values.retainer ?? ""}
            placeholder="Retainer $"
            className="w-32"
            onChange={(e) => onChange((v) => ({ ...v, retainer: e.target.value ? Number(e.target.value) : null }))}
          />
          <Select
            defaultValue={values.digital_status ?? "active"}
            className="w-32"
            onChange={(e) => onChange((v) => ({ ...v, digital_status: e.target.value }))}
          >
            {DIGITAL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select
            defaultValue={values.digital_cadence ?? "weekly"}
            className="w-36"
            onChange={(e) => onChange((v) => ({ ...v, digital_cadence: e.target.value }))}
          >
            {CADENCE_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select
            defaultValue={values.account_lead_id ?? ""}
            className="w-40"
            onChange={(e) => onChange((v) => ({ ...v, account_lead_id: e.target.value || null }))}
          >
            <option value="">Digital lead: none</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                Lead: {p.label}
              </option>
            ))}
          </Select>
        </>
      )}
    </>
  );
}

function AddClientForm({ onAdded }: { onAdded: (c: ClientRow) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<ClientRow>({
    id: 0,
    name: "",
    colour: "",
    team: "ATL",
    is_active: true,
    on_atl: true,
    on_digital: false,
    wip_doc_url: "",
    retainer: null,
    digital_status: "active",
    digital_cadence: "weekly",
    account_lead_id: null,
  });

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        + Add client
      </Button>
    );
  }

  function handleSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addClient(undefined, fd);
      if (result?.client) {
        onAdded(result.client);
        formRef.current?.reset();
        setOpen(false);
      } else if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-border-c bg-white p-4"
    >
      <ClientFieldset people={[]} values={values} onChange={(updater) => setValues(updater)} />
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
  people,
  onSaved,
  onCancel,
}: {
  client: ClientRow;
  people: PersonOption[];
  onSaved: (updated: Partial<ClientRow>) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(client);

  function handleSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateClient(undefined, fd);
      if (result?.client) onSaved(result.client);
      else if (result?.error) setError(result.error);
    });
  }

  return (
    <Card>
      <form action={handleSubmit} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={client.id} />
        <ClientFieldset people={people} values={values} onChange={(updater) => setValues(updater)} />
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

function LinkRowItem({ link, onDelete }: { link: LinkRow; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(link);

  function handleSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateAtlLink(undefined, fd);
      if (result?.success) setEditing(false);
      else if (result?.error) setError(result.error);
    });
  }

  if (editing) {
    return (
      <form action={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-gold/40 bg-bg p-2">
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
          {ATL_CADENCE_OPTIONS.map((c) => (
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
          {` · ${atlCadenceLabel(link.cadence)}`}
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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold text-gold hover:underline">
        + Add link
      </button>
    );
  }

  function handleSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addAtlLink(undefined, fd);
      if (result?.link) {
        onAdded(result.link);
        formRef.current?.reset();
        setOpen(false);
      } else if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border-c bg-bg p-2"
    >
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
        {ATL_CADENCE_OPTIONS.map((c) => (
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
