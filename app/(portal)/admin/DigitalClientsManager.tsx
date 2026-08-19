"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  addClientChannel,
  addDigitalClient,
  deleteClientChannel,
  deleteDigitalClient,
  updateClientChannel,
  updateDigitalClient,
} from "../digital-opti/actions";
import { Button, Card, EmptyState, Input, Select } from "@/components/ui";
import { CADENCE_OPTIONS, CHANNEL_OPTIONS, cadenceLabel, channelLabel } from "@/lib/digitalOpti";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "set_up", label: "Set up" },
  { value: "archived", label: "Archived" },
];

export type DigitalClientRow = {
  id: number;
  name: string;
  colour: string | null;
  lead_id: string | null;
  retainer: number | null;
  wip_doc_url: string | null;
  status: string;
};

export type DigitalChannelRow = {
  id: number;
  client_id: number;
  channel: string;
  cadence: string;
  is_active: boolean;
};

export type LeadOption = { id: string; label: string };

export function DigitalClientsManager({
  clients,
  channels,
  leads,
}: {
  clients: DigitalClientRow[];
  channels: DigitalChannelRow[];
  leads: LeadOption[];
}) {
  const [clientRows, setClientRows] = useState(clients);
  const [channelRows, setChannelRows] = useState(channels);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function removeClient(id: number) {
    if (!confirm("Delete this client and all its channels? This can't be undone.")) return;
    setClientRows((prev) => prev.filter((c) => c.id !== id));
    setChannelRows((prev) => prev.filter((ch) => ch.client_id !== id));
    startTransition(async () => {
      await deleteDigitalClient(id);
    });
  }

  function removeChannel(id: number) {
    setChannelRows((prev) => prev.filter((ch) => ch.id !== id));
    startTransition(async () => {
      await deleteClientChannel(id);
    });
  }

  return (
    <div className="space-y-6">
      <AddClientForm leads={leads} onAdded={(c) => setClientRows((prev) => [...prev, c])} />

      {clientRows.length === 0 ? (
        <EmptyState title="No Digital clients yet" />
      ) : (
        clientRows.map((client) =>
          editingClientId === client.id ? (
            <EditClientForm
              key={client.id}
              client={client}
              leads={leads}
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
                    {STATUSES.find((s) => s.value === client.status)?.label ?? client.status}
                  </span>
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
                {channelRows
                  .filter((ch) => ch.client_id === client.id)
                  .map((channel) => (
                    <ChannelRowItem key={channel.id} channel={channel} onDelete={() => removeChannel(channel.id)} />
                  ))}
                <AddChannelInline clientId={client.id} onAdded={(ch) => setChannelRows((prev) => [...prev, ch])} />
              </div>
            </Card>
          ),
        )
      )}
    </div>
  );
}

function LeadSelect({
  leads,
  name,
  defaultValue,
  onChange,
}: {
  leads: LeadOption[];
  name: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <Select name={name} defaultValue={defaultValue ?? ""} className="w-40" onChange={(e) => onChange?.(e.target.value)}>
      <option value="">Unassigned</option>
      {leads.map((l) => (
        <option key={l.id} value={l.id}>
          {l.label}
        </option>
      ))}
    </Select>
  );
}

function AddClientForm({ leads, onAdded }: { leads: LeadOption[]; onAdded: (c: DigitalClientRow) => void }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addDigitalClient, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        + Add Digital client
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        const name = String(fd.get("name") ?? "");
        const colour = String(fd.get("colour") ?? "");
        const leadId = String(fd.get("lead_id") ?? "");
        const retainer = String(fd.get("retainer") ?? "");
        const wipDocUrl = String(fd.get("wip_doc_url") ?? "");
        const status = String(fd.get("status") ?? "active");
        const result = await formAction(fd);
        if ((result as { success?: boolean } | undefined)?.success) {
          onAdded({
            id: Date.now(),
            name,
            colour: colour || null,
            lead_id: leadId || null,
            retainer: retainer ? Number(retainer) : null,
            wip_doc_url: wipDocUrl || null,
            status,
          });
          formRef.current?.reset();
          setOpen(false);
        }
      }}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-border-c bg-white p-4"
    >
      <Input name="name" placeholder="Client name" required className="w-44" />
      <LeadSelect leads={leads} name="lead_id" />
      <Input name="retainer" type="number" step="0.01" placeholder="Retainer $" className="w-32" />
      <Input name="wip_doc_url" placeholder="WIP link" className="w-48" />
      <Select name="status" defaultValue="active" className="w-32">
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      <Input name="colour" placeholder="#RRGGBB (optional)" className="w-36" />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-charcoal hover:text-ink">
        Cancel
      </button>
      {state?.error && <p className="w-full text-xs font-medium text-red-600">{state.error}</p>}
    </form>
  );
}

function EditClientForm({
  client,
  leads,
  onSaved,
  onCancel,
}: {
  client: DigitalClientRow;
  leads: LeadOption[];
  onSaved: (updated: Partial<DigitalClientRow>) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateDigitalClient, undefined);
  const [values, setValues] = useState(client);

  return (
    <Card>
      <form
        action={async (fd) => {
          const result = await formAction(fd);
          if ((result as { success?: boolean } | undefined)?.success) onSaved(values);
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="id" value={client.id} />
        <Input
          name="name"
          defaultValue={values.name}
          required
          className="w-44"
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        />
        <LeadSelect
          leads={leads}
          name="lead_id"
          defaultValue={values.lead_id ?? ""}
          onChange={(value) => setValues((v) => ({ ...v, lead_id: value || null }))}
        />
        <Input
          name="retainer"
          type="number"
          step="0.01"
          defaultValue={values.retainer ?? ""}
          className="w-32"
          onChange={(e) => setValues((v) => ({ ...v, retainer: e.target.value ? Number(e.target.value) : null }))}
        />
        <Input
          name="wip_doc_url"
          defaultValue={values.wip_doc_url ?? ""}
          className="w-48"
          onChange={(e) => setValues((v) => ({ ...v, wip_doc_url: e.target.value || null }))}
        />
        <Select
          name="status"
          defaultValue={values.status}
          className="w-32"
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Input
          name="colour"
          defaultValue={values.colour ?? ""}
          className="w-36"
          onChange={(e) => setValues((v) => ({ ...v, colour: e.target.value }))}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <button type="button" onClick={onCancel} className="text-xs text-charcoal hover:text-ink">
          Cancel
        </button>
        {state?.error && <p className="w-full text-xs font-medium text-red-600">{state.error}</p>}
      </form>
    </Card>
  );
}

function ChannelRowItem({ channel, onDelete }: { channel: DigitalChannelRow; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateClientChannel, undefined);
  const [values, setValues] = useState(channel);

  if (editing) {
    return (
      <form
        action={async (fd) => {
          const result = await formAction(fd);
          if ((result as { success?: boolean } | undefined)?.success) setEditing(false);
        }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-gold/40 bg-bg p-2"
      >
        <input type="hidden" name="id" value={channel.id} />
        <span className="w-28 text-sm font-medium text-ink">{channelLabel(channel.channel)}</span>
        <Select
          name="cadence"
          defaultValue={values.cadence}
          className="w-36"
          onChange={(e) => setValues((v) => ({ ...v, cadence: e.target.value }))}
        >
          {CADENCE_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <input type="hidden" name="is_active" value={values.is_active ? "true" : "false"} />
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
          {pending ? "…" : "Save"}
        </Button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-charcoal hover:text-ink">
          Cancel
        </button>
        {state?.error && <p className="w-full text-xs font-medium text-red-600">{state.error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-2 text-sm">
      <div>
        <span className="font-medium text-ink">{channelLabel(channel.channel)}</span>
        <span className="ml-2 text-xs text-charcoal">
          {cadenceLabel(channel.cadence)}
          {!channel.is_active && " · inactive"}
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

function AddChannelInline({
  clientId,
  onAdded,
}: {
  clientId: number;
  onAdded: (ch: DigitalChannelRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addClientChannel, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold text-gold hover:underline">
        + Add channel
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        const result = await formAction(fd);
        if ((result as { success?: boolean } | undefined)?.success) {
          onAdded({
            id: Date.now(),
            client_id: clientId,
            channel: String(fd.get("channel")),
            cadence: String(fd.get("cadence")),
            is_active: true,
          });
          formRef.current?.reset();
          setOpen(false);
        }
      }}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border-c bg-bg p-2"
    >
      <input type="hidden" name="client_id" value={clientId} />
      <Select name="channel" required className="w-32">
        {CHANNEL_OPTIONS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
      <Select name="cadence" required defaultValue="" className="w-36">
        <option value="" disabled>
          Cadence…
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
      {state?.error && <p className="w-full text-xs font-medium text-red-600">{state.error}</p>}
    </form>
  );
}
