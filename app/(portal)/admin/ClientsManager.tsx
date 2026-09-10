"use client";

import { useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import { BarChart3, Download, Radio, Upload } from "lucide-react";
import {
  addAtlClientOwner,
  addAtlLink,
  addClient,
  addClientAssignee,
  addPendingAssignee,
  bulkUpdateFinancials,
  deleteAtlLink,
  deleteClient,
  removeAtlClientOwner,
  removeClientAssignee,
  removePendingAssignee,
  updateAtlClientOwnerSplit,
  updateAtlLink,
  updateClient,
} from "../atl/actions";
import {
  addChannelOwner,
  addClientChannel,
  addClientOwner,
  addDigitalClientAssignee,
  removeChannelOwner,
  removeClientOwner,
  removeDigitalClientAssignee,
  setClientChannelActive,
  setClientDigitalStatus,
  updateClientOwnerSplit,
} from "../digital-opti/actions";
import { Button, Card, EmptyState, Input, Select } from "@/components/ui";
import { AssigneePicker, type PersonOption } from "@/components/AssigneePicker";
import { CADENCE_OPTIONS as ATL_CADENCE_OPTIONS, cadenceLabel as atlCadenceLabel, KIND_OPTIONS as KINDS } from "@/lib/atl";
import { CADENCE_OPTIONS, CHANNEL_OPTIONS, cadenceLabel, channelLabel } from "@/lib/digitalOpti";

// Kept outside the component (rather than calling Date.now() inline in a
// closure defined during render) so it isn't flagged as an impure call by
// the React Compiler eslint rules.
function nextTempId(): number {
  return -Date.now();
}

// --- Retainer/ATL revenue bulk update via CSV (see BulkFinancialsCard) —
// downloaded, edited in Excel/Sheets, re-uploaded. Client ID is the match
// key; everything else in the sheet is reference-only and ignored on
// import, so a stale re-upload can't clobber anything but these two figures.

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildFinancialsCsv(rows: ClientRow[]): string {
  const header = ["Client ID", "Client Name", "Team", "On ATL", "On Digital", "Retainer ($)", "ATL Revenue ($)"];
  const lines = [header.map(csvCell).join(",")];
  for (const c of rows) {
    lines.push(
      [
        String(c.id),
        c.name,
        c.team,
        c.on_atl ? "Yes" : "No",
        c.on_digital ? "Yes" : "No",
        c.retainer != null ? String(c.retainer) : "",
        c.atl_revenue != null ? String(c.atl_revenue) : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Minimal RFC4180-ish parser (quoted fields, doubled-quote escaping) — the
// client names being matched against can contain commas, so a naive split(",")
// isn't safe.
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

type FinancialsUpdate = { id: number; retainer: number | null; atl_revenue: number | null };

function parseFinancialsCsv(text: string): { updates: FinancialsUpdate[]; errors: string[] } {
  const rows = parseCsvText(text);
  if (rows.length === 0) return { updates: [], errors: ["File is empty."] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idIdx = header.findIndex((h) => h.includes("client id") || h === "id");
  const retainerIdx = header.findIndex((h) => h.includes("retainer"));
  const atlRevenueIdx = header.findIndex((h) => h.includes("atl revenue"));
  if (idIdx === -1) {
    return { updates: [], errors: ['Couldn\'t find a "Client ID" column — don\'t remove or rename it.'] };
  }

  const updates: FinancialsUpdate[] = [];
  const errors: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const idRaw = cells[idIdx]?.trim();
    const id = Number(idRaw);
    if (!idRaw || !Number.isFinite(id)) {
      errors.push(`Row ${i + 1}: missing or invalid Client ID.`);
      continue;
    }

    const parseMoney = (raw: string | undefined, label: string): number | null | undefined => {
      const trimmed = (raw ?? "").trim().replace(/[$,]/g, "");
      if (trimmed === "") return null;
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        errors.push(`Row ${i + 1}: "${label}" isn't a number ("${raw}").`);
        return undefined;
      }
      return n;
    };

    const retainer = retainerIdx === -1 ? null : parseMoney(cells[retainerIdx], "Retainer");
    const atlRevenue = atlRevenueIdx === -1 ? null : parseMoney(cells[atlRevenueIdx], "ATL Revenue");
    if (retainer === undefined || atlRevenue === undefined) continue;

    updates.push({ id, retainer, atl_revenue: atlRevenue });
  }
  return { updates, errors };
}

const TEAMS = ["ATL", "Digital", "Comms"];
const DIGITAL_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "set_up", label: "Set up" },
  { value: "archived", label: "Archived" },
];
// Only non-"active" digital statuses get a card badge — "Active" is the
// unremarkable default and would just be noise next to the plain Digital
// pill every other client already has.
const DIGITAL_STATUS_BADGE_CLASSNAMES: Record<string, string> = {
  paused: "bg-amber-100 text-amber-800",
  set_up: "bg-blue-100 text-blue-800",
  archived: "bg-black/10 text-charcoal",
};
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
  atl_revenue: number | null;
  digital_status: string | null;
  digital_cadence: string | null;
  digital_tier_id: number | null;
  account_lead_id: string | null;
};

export type TierOption = { id: number; name: string; colour: string };

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

export type ChannelOwnerRow = { id: number; client_channel_id: number; profile_id: string };

export type ClientOwnerRow = { id: number; client_id: number; profile_id: string; split_pct: number };
export type AtlOwnerRow = { id: number; client_id: number; profile_id: string; split_pct: number };

// A client-person assignment pre-staged for someone by email before they
// have an account — applied automatically into the matching assignment
// table the moment a profile with that email is created (see
// handle_new_user() and the pending_client_assignments migration).
export type PendingRow = {
  id: number;
  email: string;
  client_id: number;
  kind: "atl_assignee" | "digital_assignee" | "digital_owner" | "digital_channel_owner" | "atl_owner";
  channel: string | null;
  split_pct: number | null;
};

export function ClientsManager({
  clients,
  links,
  channels,
  atlAssigneesByClient,
  digitalAssigneesByClient,
  pendingAssignments,
  channelOwners,
  clientOwners,
  atlClientOwners,
  people,
  tiers,
}: {
  clients: ClientRow[];
  links: LinkRow[];
  channels: ChannelRow[];
  atlAssigneesByClient: Record<number, string[]>;
  digitalAssigneesByClient: Record<number, string[]>;
  pendingAssignments: PendingRow[];
  channelOwners: ChannelOwnerRow[];
  clientOwners: ClientOwnerRow[];
  atlClientOwners: AtlOwnerRow[];
  people: PersonOption[];
  tiers: TierOption[];
}) {
  const [clientRows, setClientRows] = useState(clients);
  const [linkRows, setLinkRows] = useState(links);
  const [channelRows, setChannelRows] = useState(channels);
  const [ownerRows, setOwnerRows] = useState(channelOwners);
  const [clientOwnerRows, setClientOwnerRows] = useState(clientOwners);
  const [atlClientOwnerRows, setAtlClientOwnerRows] = useState(atlClientOwners);
  const [atlAssignments, setAtlAssignments] = useState(atlAssigneesByClient);
  const [digitalAssignments, setDigitalAssignments] = useState(digitalAssigneesByClient);
  const [pendingRows, setPendingRows] = useState(pendingAssignments);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState(""); // "" = all, "none" = no tier, else a tier id
  const [teamFilter, setTeamFilter] = useState<Set<string>>(new Set()); // empty = all teams
  const [, startTransition] = useTransition();

  function toggleTeamFilter(team: string) {
    setTeamFilter((prev) => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });
  }

  const visibleClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clientRows.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (teamFilter.size > 0 && !teamFilter.has(c.team)) return false;
      if (tierFilter === "none" && c.digital_tier_id != null) return false;
      if (tierFilter && tierFilter !== "none" && String(c.digital_tier_id ?? "") !== tierFilter) return false;
      return true;
    });
  }, [clientRows, search, tierFilter, teamFilter]);

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

  function addPending(
    clientId: number,
    email: string,
    kind: PendingRow["kind"],
    extra?: { channel?: string; splitPct?: number },
  ) {
    const tempId = nextTempId();
    setPendingRows((prev) => [
      ...prev,
      { id: tempId, email, client_id: clientId, kind, channel: extra?.channel ?? null, split_pct: extra?.splitPct ?? null },
    ]);
    startTransition(async () => {
      const result = await addPendingAssignee(clientId, email, kind, extra);
      const created = (result as { pending?: PendingRow } | undefined)?.pending;
      if (created) setPendingRows((prev) => prev.map((p) => (p.id === tempId ? created : p)));
      else setPendingRows((prev) => prev.filter((p) => p.id !== tempId));
    });
  }

  function removePending(id: number) {
    setPendingRows((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      await removePendingAssignee(id);
    });
  }

  function addOwner(clientChannelId: number, profileId: string) {
    const tempId = nextTempId();
    setOwnerRows((prev) => [...prev, { id: tempId, client_channel_id: clientChannelId, profile_id: profileId }]);
    startTransition(async () => {
      const result = await addChannelOwner(clientChannelId, profileId);
      const created = (result as { owner?: ChannelOwnerRow } | undefined)?.owner;
      if (created) setOwnerRows((prev) => prev.map((o) => (o.id === tempId ? created : o)));
      else setOwnerRows((prev) => prev.filter((o) => o.id !== tempId));
    });
  }

  function removeOwner(ownerId: number) {
    setOwnerRows((prev) => prev.filter((o) => o.id !== ownerId));
    startTransition(async () => {
      await removeChannelOwner(ownerId);
    });
  }

  function addClientOwnerSplit(clientId: number, profileId: string, splitPct: number) {
    const tempId = nextTempId();
    setClientOwnerRows((prev) => [...prev, { id: tempId, client_id: clientId, profile_id: profileId, split_pct: splitPct }]);
    startTransition(async () => {
      const result = await addClientOwner(clientId, profileId, splitPct);
      const created = (result as { owner?: ClientOwnerRow } | undefined)?.owner;
      if (created) setClientOwnerRows((prev) => prev.map((o) => (o.id === tempId ? created : o)));
      else setClientOwnerRows((prev) => prev.filter((o) => o.id !== tempId));
    });
  }

  function updateClientOwnerSplitPct(ownerId: number, splitPct: number) {
    setClientOwnerRows((prev) => prev.map((o) => (o.id === ownerId ? { ...o, split_pct: splitPct } : o)));
    startTransition(async () => {
      await updateClientOwnerSplit(ownerId, splitPct);
    });
  }

  function removeClientOwnerSplit(ownerId: number) {
    setClientOwnerRows((prev) => prev.filter((o) => o.id !== ownerId));
    startTransition(async () => {
      await removeClientOwner(ownerId);
    });
  }

  function addAtlClientOwnerSplit(clientId: number, profileId: string, splitPct: number) {
    const tempId = nextTempId();
    setAtlClientOwnerRows((prev) => [...prev, { id: tempId, client_id: clientId, profile_id: profileId, split_pct: splitPct }]);
    startTransition(async () => {
      const result = await addAtlClientOwner(clientId, profileId, splitPct);
      const created = (result as { owner?: AtlOwnerRow } | undefined)?.owner;
      if (created) setAtlClientOwnerRows((prev) => prev.map((o) => (o.id === tempId ? created : o)));
      else setAtlClientOwnerRows((prev) => prev.filter((o) => o.id !== tempId));
    });
  }

  function updateAtlClientOwnerSplitPct(ownerId: number, splitPct: number) {
    setAtlClientOwnerRows((prev) => prev.map((o) => (o.id === ownerId ? { ...o, split_pct: splitPct } : o)));
    startTransition(async () => {
      await updateAtlClientOwnerSplit(ownerId, splitPct);
    });
  }

  function removeAtlClientOwnerSplit(ownerId: number) {
    setAtlClientOwnerRows((prev) => prev.filter((o) => o.id !== ownerId));
    startTransition(async () => {
      await removeAtlClientOwner(ownerId);
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

  function toggleDigitalPaused(clientId: number, currentStatus: string | null) {
    const nextStatus = currentStatus === "paused" ? "active" : "paused";
    setClientRows((prev) => prev.map((c) => (c.id === clientId ? { ...c, digital_status: nextStatus } : c)));
    startTransition(async () => {
      await setClientDigitalStatus(clientId, nextStatus);
    });
  }

  async function applyFinancialsUpdates(updates: FinancialsUpdate[]) {
    const result = await bulkUpdateFinancials(updates);
    if (!(result as { error?: string })?.error) {
      const byId = new Map(updates.map((u) => [u.id, u]));
      setClientRows((prev) =>
        prev.map((c) => (byId.has(c.id) ? { ...c, retainer: byId.get(c.id)!.retainer, atl_revenue: byId.get(c.id)!.atl_revenue } : c)),
      );
    }
    return result;
  }

  return (
    <div className="space-y-6">
      <AddClientForm tiers={tiers} onAdded={(c) => setClientRows((prev) => [...prev, c])} />

      <BulkFinancialsCard clientRows={clientRows} onApply={applyFinancialsUpdates} />

      {clientRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="max-w-xs"
          />
          <Select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="w-40">
            <option value="">All tiers</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="none">No tier</option>
          </Select>
          <div className="flex items-center gap-1.5">
            {TEAMS.map((team) => (
              <button
                key={team}
                type="button"
                onClick={() => toggleTeamFilter(team)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  teamFilter.has(team)
                    ? "border-gold bg-gold text-ink"
                    : "border-border-c text-charcoal hover:border-gold/50"
                }`}
              >
                {team}
              </button>
            ))}
          </div>
        </div>
      )}

      {clientRows.length === 0 ? (
        <EmptyState title="No clients yet" />
      ) : visibleClients.length === 0 ? (
        <EmptyState title="No clients match your search" />
      ) : (
        visibleClients.map((client) =>
          editingClientId === client.id ? (
            <EditClientForm
              key={client.id}
              client={client}
              tiers={tiers}
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
                  {client.on_digital && client.digital_status && client.digital_status !== "active" && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        DIGITAL_STATUS_BADGE_CLASSNAMES[client.digital_status] ?? "bg-black/10 text-charcoal"
                      }`}
                    >
                      {DIGITAL_STATUSES.find((s) => s.value === client.digital_status)?.label ?? client.digital_status}
                    </span>
                  )}
                  {client.digital_tier_id && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ background: tiers.find((t) => t.id === client.digital_tier_id)?.colour ?? "#999" }}
                    >
                      {tiers.find((t) => t.id === client.digital_tier_id)?.name ?? "Tier"}
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
                <div className="mt-4 rounded-lg border-t-4 border-charcoal bg-black/5 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-charcoal text-white">
                      <Radio className="h-3 w-3" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="text-[13px] font-bold uppercase tracking-wide text-ink">ATL</span>
                    <span className="text-[11px] text-charcoal">
                      Above-the-line — assignment, revenue split & flight plans
                    </span>
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
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
                    <PendingEmailPicker
                      pending={pendingRows.filter((p) => p.client_id === client.id && p.kind === "atl_assignee")}
                      onAdd={(email) => addPending(client.id, email, "atl_assignee")}
                      onRemove={removePending}
                    />
                    {client.atl_revenue != null && (
                      <span className="text-xs text-charcoal">${client.atl_revenue.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="mb-3">
                    <RevenueSplitEditor
                      label="ATL revenue split"
                      owners={atlClientOwnerRows.filter((o) => o.client_id === client.id)}
                      pending={pendingRows.filter((p) => p.client_id === client.id && p.kind === "atl_owner")}
                      people={people}
                      onAdd={(profileId, splitPct) => addAtlClientOwnerSplit(client.id, profileId, splitPct)}
                      onUpdateSplit={updateAtlClientOwnerSplitPct}
                      onRemove={removeAtlClientOwnerSplit}
                      onAddPending={(email, splitPct) => addPending(client.id, email, "atl_owner", { splitPct })}
                      onRemovePending={removePending}
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
                <div className="mt-4 rounded-lg border-t-4 border-gold bg-gold/10 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-gold text-ink">
                      <BarChart3 className="h-3 w-3" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="text-[13px] font-bold uppercase tracking-wide text-ink">Digital</span>
                    <span className="text-[11px] text-charcoal">
                      Programmatic & channel retainer, split & ownership
                    </span>
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-xs text-charcoal">
                      {DIGITAL_STATUSES.find((s) => s.value === client.digital_status)?.label ?? "Active"}
                      {client.retainer != null && ` · $${client.retainer.toLocaleString()}`}
                      {` · ${cadenceLabel(client.digital_cadence ?? "weekly")}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleDigitalPaused(client.id, client.digital_status)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        client.digital_status === "paused"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400"
                          : "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400"
                      }`}
                    >
                      {client.digital_status === "paused" ? "Resume" : "Pause"}
                    </button>
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
                    <PendingEmailPicker
                      pending={pendingRows.filter((p) => p.client_id === client.id && p.kind === "digital_assignee")}
                      onAdd={(email) => addPending(client.id, email, "digital_assignee")}
                      onRemove={removePending}
                    />
                  </div>
                  <div className="mb-3">
                    <RevenueSplitEditor
                      label="Retainer split"
                      owners={clientOwnerRows.filter((o) => o.client_id === client.id)}
                      pending={pendingRows.filter((p) => p.client_id === client.id && p.kind === "digital_owner")}
                      people={people}
                      onAdd={(profileId, splitPct) => addClientOwnerSplit(client.id, profileId, splitPct)}
                      onUpdateSplit={updateClientOwnerSplitPct}
                      onRemove={removeClientOwnerSplit}
                      onAddPending={(email, splitPct) => addPending(client.id, email, "digital_owner", { splitPct })}
                      onRemovePending={removePending}
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
                  {channelRows.some((ch) => ch.client_id === client.id && ch.is_active) && (
                    <div className="mt-3 space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-charcoal">
                        Channel owners (who works it — no % here)
                      </span>
                      {channelRows
                        .filter((ch) => ch.client_id === client.id && ch.is_active)
                        .map((ch) => (
                          <ChannelOwnersEditor
                            key={ch.id}
                            channel={ch}
                            owners={ownerRows.filter((o) => o.client_channel_id === ch.id)}
                            pending={pendingRows.filter(
                              (p) => p.client_id === client.id && p.kind === "digital_channel_owner" && p.channel === ch.channel,
                            )}
                            people={people}
                            onAdd={(profileId) => addOwner(ch.id, profileId)}
                            onRemove={removeOwner}
                            onAddPending={(email) =>
                              addPending(client.id, email, "digital_channel_owner", { channel: ch.channel })
                            }
                            onRemovePending={removePending}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ),
        )
      )}
    </div>
  );
}

// Chips of clients pre-assigned to someone by email, before they've signed
// up — a "+ Pre-assign" control lets you stage the assignment now, and it's
// applied automatically the moment a matching account is created.
function PendingEmailPicker({
  pending,
  onAdd,
  onRemove,
}: {
  pending: PendingRow[];
  onAdd: (email: string) => void;
  onRemove: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  function submit() {
    const trimmed = email.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setEmail("");
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pending.map((p) => (
        <span
          key={p.id}
          title="Waiting for this person to create an account with this email"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gold/50 bg-gold/10 px-2.5 py-1 text-xs font-medium text-charcoal"
        >
          {p.email} <span className="text-[10px] uppercase tracking-wide text-gold">pending</span>
          <button
            type="button"
            onClick={() => onRemove(p.id)}
            className="text-charcoal hover:text-red-600"
            aria-label={`Remove ${p.email}`}
          >
            ×
          </button>
        </span>
      ))}
      {open ? (
        <input
          autoFocus
          type="email"
          placeholder="email@sunnyadvertising.com.au"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          onBlur={submit}
          className="w-52 rounded-lg border border-border-c bg-white px-2.5 py-1 text-xs text-ink outline-none focus:border-gold"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-dashed border-border-c px-2.5 py-1 text-xs font-semibold text-charcoal hover:border-gold/50 hover:text-gold"
        >
          + Pre-assign by email
        </button>
      )}
    </div>
  );
}

// Who's tagged as working this channel — no percentage. See
// ClientRetainerSplitEditor for the client-level split that actually drives
// the derived lead/second and Team split Retainer column.
function ChannelOwnersEditor({
  channel,
  owners,
  pending,
  people,
  onAdd,
  onRemove,
  onAddPending,
  onRemovePending,
}: {
  channel: ChannelRow;
  owners: ChannelOwnerRow[];
  pending: PendingRow[];
  people: PersonOption[];
  onAdd: (profileId: string) => void;
  onRemove: (ownerId: number) => void;
  onAddPending: (email: string) => void;
  onRemovePending: (id: number) => void;
}) {
  const availablePeople = people.filter((p) => !owners.some((o) => o.profile_id === p.id));
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-bg px-3 py-2 text-xs">
      <span className="font-semibold uppercase tracking-wide text-charcoal">{channelLabel(channel.channel)}</span>
      {owners.map((o) => (
        <span key={o.id} className="flex items-center gap-1 rounded-full border border-border-c bg-white px-2 py-1">
          {people.find((p) => p.id === o.profile_id)?.label ?? "Unknown"}
          <button type="button" onClick={() => onRemove(o.id)} className="text-red-600 hover:underline">
            ×
          </button>
        </span>
      ))}
      {pending.map((p) => (
        <span
          key={p.id}
          title="Waiting for this person to create an account with this email"
          className="flex items-center gap-1 rounded-full border border-dashed border-gold/50 bg-gold/10 px-2 py-1 text-charcoal"
        >
          {p.email} <span className="text-[10px] uppercase tracking-wide text-gold">pending</span>
          <button type="button" onClick={() => onRemovePending(p.id)} className="text-red-600 hover:underline">
            ×
          </button>
        </span>
      ))}
      {availablePeople.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && onAdd(e.target.value)}
          className="rounded border border-border-c px-1.5 py-1"
        >
          <option value="">+ assign…</option>
          {availablePeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      )}
      {pendingOpen ? (
        <input
          autoFocus
          type="email"
          placeholder="email@sunnyadvertising.com.au"
          value={pendingEmail}
          onChange={(e) => setPendingEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !pendingEmail.trim()) return;
            onAddPending(pendingEmail.trim());
            setPendingEmail("");
            setPendingOpen(false);
          }}
          onBlur={() => {
            if (pendingEmail.trim()) onAddPending(pendingEmail.trim());
            setPendingEmail("");
            setPendingOpen(false);
          }}
          className="w-44 rounded border border-border-c px-1.5 py-1"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPendingOpen(true)}
          className="rounded border border-dashed border-border-c px-1.5 py-1 text-charcoal hover:border-gold/50"
        >
          + pre-assign by email…
        </button>
      )}
    </div>
  );
}

// The client-level revenue split — who's credited for this client's
// revenue, and what share. Shared by both Digital (retainer, driving the
// board's lead/second and the Team split Retainer column) and ATL (its own
// atl_revenue) — the two are separate dollar figures with separate owner
// tables (digital_client_owners / atl_client_owners), but the same editor.
function RevenueSplitEditor({
  label,
  owners,
  pending,
  people,
  onAdd,
  onUpdateSplit,
  onRemove,
  onAddPending,
  onRemovePending,
}: {
  label: string;
  owners: { id: number; profile_id: string; split_pct: number }[];
  pending: PendingRow[];
  people: PersonOption[];
  onAdd: (profileId: string, splitPct: number) => void;
  onUpdateSplit: (ownerId: number, splitPct: number) => void;
  onRemove: (ownerId: number) => void;
  onAddPending: (email: string, splitPct: number) => void;
  onRemovePending: (id: number) => void;
}) {
  const [newPersonId, setNewPersonId] = useState("");
  const [newSplit, setNewSplit] = useState(100);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingSplit, setPendingSplit] = useState(100);
  const availablePeople = people.filter((p) => !owners.some((o) => o.profile_id === p.id));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs">
      <span className="font-semibold uppercase tracking-wide text-charcoal">{label}</span>
      {owners.map((o) => (
        <span key={o.id} className="flex items-center gap-1 rounded-full border border-border-c bg-white px-2 py-1">
          {people.find((p) => p.id === o.profile_id)?.label ?? "Unknown"}
          <input
            type="number"
            min={1}
            max={100}
            defaultValue={o.split_pct}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v > 0 && v <= 100) onUpdateSplit(o.id, v);
            }}
            className="w-12 rounded border border-border-c px-1 text-right"
          />
          %
          <button type="button" onClick={() => onRemove(o.id)} className="text-red-600 hover:underline">
            ×
          </button>
        </span>
      ))}
      {pending.map((p) => (
        <span
          key={p.id}
          title="Waiting for this person to create an account with this email"
          className="flex items-center gap-1 rounded-full border border-dashed border-gold/50 bg-white px-2 py-1 text-charcoal"
        >
          {p.email} ({p.split_pct}%) <span className="text-[10px] uppercase tracking-wide text-gold">pending</span>
          <button type="button" onClick={() => onRemovePending(p.id)} className="text-red-600 hover:underline">
            ×
          </button>
        </span>
      ))}
      {availablePeople.length > 0 && (
        <>
          <select
            value={newPersonId}
            onChange={(e) => setNewPersonId(e.target.value)}
            className="rounded border border-border-c px-1.5 py-1"
          >
            <option value="">+ assign…</option>
            {availablePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={100}
            value={newSplit}
            onChange={(e) => setNewSplit(Number(e.target.value))}
            className="w-12 rounded border border-border-c px-1 text-right"
          />
          <button
            type="button"
            disabled={!newPersonId}
            onClick={() => {
              onAdd(newPersonId, newSplit);
              setNewPersonId("");
              setNewSplit(100);
            }}
            className="rounded border border-border-c px-2 py-1 font-semibold text-charcoal hover:border-gold/50 disabled:opacity-40"
          >
            Add
          </button>
        </>
      )}
      <input
        type="email"
        placeholder="pre-assign by email…"
        value={pendingEmail}
        onChange={(e) => setPendingEmail(e.target.value)}
        className="w-40 rounded border border-dashed border-border-c px-1.5 py-1"
      />
      <input
        type="number"
        min={1}
        max={100}
        value={pendingSplit}
        onChange={(e) => setPendingSplit(Number(e.target.value))}
        className="w-12 rounded border border-border-c px-1 text-right"
      />
      <button
        type="button"
        disabled={!pendingEmail.trim()}
        onClick={() => {
          onAddPending(pendingEmail.trim(), pendingSplit);
          setPendingEmail("");
          setPendingSplit(100);
        }}
        className="rounded border border-dashed border-border-c px-2 py-1 font-semibold text-charcoal hover:border-gold/50 disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}

function ClientFieldset({
  tiers,
  values,
  onChange,
  originalRetainer,
  originalAtlRevenue,
}: {
  tiers: TierOption[];
  values: ClientRow;
  onChange: (updater: (v: ClientRow) => ClientRow) => void;
  // The retainer/ATL revenue as they were before this edit — shown alongside
  // their inputs so an admin can see what they're changing from, not just
  // what they're typing. Omitted (undefined) when adding a brand-new client.
  originalRetainer?: number | null;
  originalAtlRevenue?: number | null;
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
      {/* Same deal for On ATL — keeps atl_revenue if the checkbox gets toggled off and back on. */}
      <input type="hidden" name="atl_revenue" value={values.atl_revenue ?? ""} />

      {/* Tier applies to a client overall (ATL or Digital) — the weekly
          Digital Opti rotation it also drives is separately gated on
          on_digital, so assigning a tier to an ATL-only client is inert
          there, just a label/filter here in Admin. */}
      <input type="hidden" name="digital_tier_id" value={values.digital_tier_id ?? ""} />
      <Select
        defaultValue={values.digital_tier_id ?? ""}
        className="w-32"
        onChange={(e) => onChange((v) => ({ ...v, digital_tier_id: e.target.value ? Number(e.target.value) : null }))}
      >
        <option value="">Tier: none</option>
        {tiers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>

      {values.on_atl && (
        <div className="flex flex-col gap-0.5">
          {originalAtlRevenue !== undefined && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-charcoal">
              Currently {originalAtlRevenue != null ? `$${originalAtlRevenue.toLocaleString()}` : "none"}
            </span>
          )}
          <Input
            type="number"
            step="0.01"
            defaultValue={values.atl_revenue ?? ""}
            placeholder="ATL revenue $"
            className="w-32"
            onChange={(e) => onChange((v) => ({ ...v, atl_revenue: e.target.value ? Number(e.target.value) : null }))}
          />
        </div>
      )}

      {values.on_digital && (
        <>
          <div className="flex flex-col gap-0.5">
            {originalRetainer !== undefined && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-charcoal">
                Currently {originalRetainer != null ? `$${originalRetainer.toLocaleString()}` : "none"}
              </span>
            )}
            <Input
              type="number"
              step="0.01"
              defaultValue={values.retainer ?? ""}
              placeholder="Retainer $"
              className="w-32"
              onChange={(e) => onChange((v) => ({ ...v, retainer: e.target.value ? Number(e.target.value) : null }))}
            />
          </div>
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
        </>
      )}
    </>
  );
}

// Monthly/quarterly retainer & ATL revenue round-trip: download the current
// figures as a CSV, edit them in Excel/Sheets, re-upload — only those two
// columns ever change, matched by Client ID.
function BulkFinancialsCard({
  clientRows,
  onApply,
}: {
  clientRows: ClientRow[];
  onApply: (updates: FinancialsUpdate[]) => Promise<{ error?: string; updated?: number } | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ updates: FinancialsUpdate[]; errors: string[] } | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ error?: string; updated?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function download() {
    downloadTextFile(`retainer-atl-revenue-${new Date().toISOString().slice(0, 10)}.csv`, buildFinancialsCsv(clientRows));
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setParsed(parseFinancialsCsv(String(reader.result ?? "")));
    reader.readAsText(file);
  }

  async function apply() {
    if (!parsed || parsed.updates.length === 0) return;
    setPending(true);
    const res = await onApply(parsed.updates);
    setPending(false);
    setResult(res ?? { error: "Something went wrong." });
    if (!res?.error) {
      setParsed(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        + Bulk update retainer & ATL revenue
      </Button>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-ink">Bulk update retainer & ATL revenue</div>
          <p className="mt-0.5 text-xs text-charcoal">
            Download the sheet, change the figures for the month/quarter, then upload it back — everything else in
            the file is reference only and won&rsquo;t be touched.
          </p>
        </div>
        <button onClick={() => setOpen(false)} className="text-xs font-semibold text-charcoal hover:text-ink">
          Close
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={download} className="gap-1.5">
          <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Download CSV
        </Button>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-c px-4 py-2.5 text-sm font-semibold text-ink hover:border-gold/50">
          <Upload className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {fileName ?? "Upload CSV"}
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        </label>
        {parsed && parsed.updates.length > 0 && (
          <Button onClick={apply} disabled={pending}>
            {pending ? "Applying…" : `Apply ${parsed.updates.length} row${parsed.updates.length === 1 ? "" : "s"}`}
          </Button>
        )}
      </div>

      {parsed && parsed.errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {parsed.errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}
      {result?.error && <p className="text-xs font-medium text-red-600">{result.error}</p>}
      {result?.updated !== undefined && !result.error && (
        <p className="text-xs font-medium text-emerald-700">Updated {result.updated} client(s).</p>
      )}
    </Card>
  );
}

function AddClientForm({ tiers, onAdded }: { tiers: TierOption[]; onAdded: (c: ClientRow) => void }) {
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
    atl_revenue: null,
    digital_status: "active",
    digital_cadence: "weekly",
    digital_tier_id: null,
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
      <ClientFieldset tiers={tiers} values={values} onChange={(updater) => setValues(updater)} />
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
  tiers,
  onSaved,
  onCancel,
}: {
  client: ClientRow;
  tiers: TierOption[];
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
        <ClientFieldset
          tiers={tiers}
          values={values}
          onChange={(updater) => setValues(updater)}
          originalRetainer={client.retainer}
          originalAtlRevenue={client.atl_revenue}
        />
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
