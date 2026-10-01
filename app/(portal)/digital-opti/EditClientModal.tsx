"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import {
  CADENCE_OPTIONS,
  CHANNEL_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  channelLabel,
  type ClientCardData,
  type TierInfo,
} from "@/lib/digitalOpti";
import { saveDigitalClient } from "./actions";
import { ModalShell } from "./AddClientForms";

export type PersonOption = { id: string; label: string };

const labelClass = "mb-1 block text-xs font-semibold text-charcoal";

// Everything about a live client in one popup — anyone on the Digital tab
// can use it and the save applies straight away (see saveDigitalClient).
export function EditClientModal({
  client,
  tiers,
  people,
  onClose,
}: {
  client: ClientCardData;
  tiers: TierInfo[];
  people: PersonOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const isTactical = client.parentId != null;
  const [name, setName] = useState(client.name);
  const [tierId, setTierId] = useState<number | null>(client.tier?.id ?? null);
  const [cadence, setCadence] = useState(client.cadence);
  const [status, setStatus] = useState(client.status);
  const [retainer, setRetainer] = useState(client.retainer != null ? String(client.retainer) : "");
  const [included, setIncluded] = useState(client.includedInParentRetainer);
  const [wipUrl, setWipUrl] = useState(client.wipDocUrl ?? "");
  const [endDate, setEndDate] = useState(client.endDate ?? "");
  // channel value -> owner profile ids, for every channel currently ticked on.
  const [channels, setChannels] = useState<Map<string, string[]>>(
    () => new Map(client.channels.map((ch) => [ch.channel, ch.owners.map((o) => o.profileId)])),
  );
  const [owners, setOwners] = useState(
    client.owners.map((o) => ({ profileId: o.profileId, splitPct: String(o.splitPct) })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const personLabel = (id: string) => people.find((p) => p.id === id)?.label ?? "Unknown";

  function toggleChannel(value: string) {
    setChannels((prev) => {
      const next = new Map(prev);
      if (next.has(value)) next.delete(value);
      else next.set(value, []);
      return next;
    });
  }

  function setChannelOwners(value: string, ids: string[]) {
    setChannels((prev) => new Map(prev).set(value, ids));
  }

  function save() {
    setError(null);
    const retainerNum = retainer.trim() === "" ? null : Number(retainer);
    if (retainerNum != null && Number.isNaN(retainerNum)) {
      setError("Retainer must be a number.");
      return;
    }
    if (owners.some((o) => !o.profileId)) {
      setError("Choose a person for every row in the retainer split, or remove the empty row.");
      return;
    }
    startTransition(async () => {
      const result = await saveDigitalClient(client.id, {
        name,
        tierId,
        cadence,
        status,
        retainer: retainerNum,
        includedInParentRetainer: included,
        wipDocUrl: wipUrl.trim() || null,
        endDate: endDate || null,
        // Keep the board's channel order rather than click order.
        channels: CHANNEL_OPTIONS.filter((c) => channels.has(c.value)).map((c) => ({
          channel: c.value,
          ownerIds: channels.get(c.value) ?? [],
        })),
        owners: owners.map((o) => ({ profileId: o.profileId, splitPct: Number(o.splitPct) || 0 })),
      });
      if (result?.error) setError(result.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <ModalShell title={`Edit ${client.name}`} onClose={onClose}>
      <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div>
          <label className={labelClass}>{isTactical ? "Tactical name" : "Client name"}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Status</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {CLIENT_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className={labelClass}>Tier</label>
            <Select value={tierId ?? ""} onChange={(e) => setTierId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">No tier</option>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className={labelClass}>Cadence</label>
            <Select value={cadence} onChange={(e) => setCadence(e.target.value)}>
              {CADENCE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Retainer</label>
            {isTactical && (
              <label className="mb-1.5 flex items-center gap-2 text-xs text-ink">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={(e) => setIncluded(e.target.checked)}
                  className="accent-gold"
                />
                Included in parent&apos;s retainer
              </label>
            )}
            {!(isTactical && included) && (
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="$"
                value={retainer}
                onChange={(e) => setRetainer(e.target.value)}
              />
            )}
          </div>
          <div>
            <label className={labelClass}>End date (optional)</label>
            <div className="flex items-center gap-2">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {endDate && (
                <button
                  type="button"
                  onClick={() => setEndDate("")}
                  className="text-xs text-charcoal hover:text-ink"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-charcoal">
              For a tactical&apos;s end or offboarding. Archived automatically after this date.
            </p>
          </div>
        </div>

        <div>
          <label className={labelClass}>WIP link</label>
          <Input placeholder="https://…" value={wipUrl} onChange={(e) => setWipUrl(e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Retainer split (lead / second)</label>
          <div className="space-y-1.5">
            {owners.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={o.profileId}
                  onChange={(e) =>
                    setOwners((prev) => prev.map((p, j) => (j === i ? { ...p, profileId: e.target.value } : p)))
                  }
                >
                  <option value="">Choose person</option>
                  {people
                    .filter((p) => p.id === o.profileId || !owners.some((x) => x.profileId === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                </Select>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  className="w-20"
                  value={o.splitPct}
                  onChange={(e) =>
                    setOwners((prev) => prev.map((p, j) => (j === i ? { ...p, splitPct: e.target.value } : p)))
                  }
                />
                <span className="text-xs text-charcoal">%</span>
                <button
                  type="button"
                  onClick={() => setOwners((prev) => prev.filter((_, j) => j !== i))}
                  className="text-charcoal hover:text-red-600"
                  aria-label="Remove from split"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOwners((prev) => [...prev, { profileId: "", splitPct: "" }])}
              className="text-xs font-semibold text-charcoal hover:text-gold"
            >
              + Add person
            </button>
            {isTactical && owners.length === 0 && (
              <p className="text-[11px] text-charcoal">No split set — uses the parent client&apos;s.</p>
            )}
          </div>
        </div>

        <div>
          <label className={labelClass}>Channels</label>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map((c) => (
              <label
                key={c.value}
                className="flex items-center gap-1.5 rounded-full border border-border-c px-3 py-1.5 text-xs font-medium text-charcoal has-[:checked]:border-gold has-[:checked]:bg-gold has-[:checked]:text-ink"
              >
                <input
                  type="checkbox"
                  checked={channels.has(c.value)}
                  onChange={() => toggleChannel(c.value)}
                  className="accent-gold"
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        {channels.size > 0 && (
          <div>
            <label className={labelClass}>Channel owners</label>
            <div className="space-y-1.5">
              {CHANNEL_OPTIONS.filter((c) => channels.has(c.value)).map((c) => {
                const ids = channels.get(c.value) ?? [];
                return (
                  <div key={c.value} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-20 text-xs font-semibold text-ink">{channelLabel(c.value)}</span>
                    {ids.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-charcoal"
                      >
                        {personLabel(id)}
                        <button
                          type="button"
                          onClick={() => setChannelOwners(c.value, ids.filter((x) => x !== id))}
                          className="text-charcoal hover:text-red-600"
                          aria-label={`Remove ${personLabel(id)}`}
                        >
                          <X className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </span>
                    ))}
                    <Select
                      value=""
                      onChange={(e) => e.target.value && setChannelOwners(c.value, [...ids, e.target.value])}
                      className="h-7 w-36 py-0 text-xs"
                    >
                      <option value="">+ Add owner</option>
                      {people
                        .filter((p) => !ids.includes(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <button type="button" onClick={onClose} className="text-sm text-charcoal hover:text-ink">
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
