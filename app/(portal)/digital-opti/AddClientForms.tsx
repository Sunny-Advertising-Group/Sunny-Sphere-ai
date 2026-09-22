"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { CADENCE_OPTIONS, CHANNEL_OPTIONS, type TierInfo } from "@/lib/digitalOpti";
import { submitDigitalClient, submitDigitalTactical } from "./actions";

function ChannelPicker({ name }: { name: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHANNEL_OPTIONS.map((c) => (
        <label
          key={c.value}
          className="flex items-center gap-1.5 rounded-full border border-border-c px-3 py-1.5 text-xs font-medium text-charcoal has-[:checked]:border-gold has-[:checked]:bg-gold has-[:checked]:text-ink"
        >
          <input type="checkbox" name={name} value={c.value} className="accent-gold" />
          {c.label}
        </label>
      ))}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-charcoal hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function AddClientModal({ tiers, onClose }: { tiers: TierInfo[]; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitDigitalClient, undefined);

  function finish() {
    router.refresh();
    onClose();
  }

  if (state?.success) {
    return (
      <ModalShell title="Client submitted" onClose={finish}>
        <p className="mt-3 text-sm text-charcoal">
          Sent to the admin queue for approval. It&apos;ll appear on the board once it&apos;s approved.
        </p>
        <Button className="mt-4" onClick={finish}>
          Done
        </Button>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Add a client" onClose={onClose}>
      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-charcoal">Client name</label>
          <Input name="name" required autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Retainer (optional)</label>
            <Input name="retainer" type="number" min="0" step="1" placeholder="$" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Cadence</label>
            <Select name="digital_cadence" defaultValue="weekly">
              {CADENCE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {tiers.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Tier (optional)</label>
            <Select name="digital_tier_id" defaultValue="">
              <option value="">No tier</option>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold text-charcoal">Channels</label>
          <ChannelPicker name="channels" />
        </div>

        {state?.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit for approval"}
          </Button>
          <button type="button" onClick={onClose} className="text-sm text-charcoal hover:text-ink">
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function AddTacticalModal({
  parentClientOptions,
  onClose,
}: {
  parentClientOptions: { id: number; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitDigitalTactical, undefined);
  const [retainerType, setRetainerType] = useState<"extra" | "included">("extra");

  function finish() {
    router.refresh();
    onClose();
  }

  if (state?.success) {
    return (
      <ModalShell title="Tactical submitted" onClose={finish}>
        <p className="mt-3 text-sm text-charcoal">
          Sent to the admin queue for approval. It&apos;ll appear nested under its client once it&apos;s approved.
        </p>
        <Button className="mt-4" onClick={finish}>
          Done
        </Button>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Add a tactical" onClose={onClose}>
      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-charcoal">Client</label>
          <Select name="parent_client_id" required defaultValue="">
            <option value="" disabled>
              Select a client
            </option>
            {parentClientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-charcoal">Tactical name</label>
          <Input name="name" required placeholder="e.g. EOFY Sale campaign" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-charcoal">Channels</label>
          <ChannelPicker name="channels" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-charcoal">Retainer</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="retainer_type"
                value="extra"
                checked={retainerType === "extra"}
                onChange={() => setRetainerType("extra")}
                className="accent-gold"
              />
              Extra retainer
              {retainerType === "extra" && (
                <Input name="retainer" type="number" min="0" step="1" placeholder="$" required className="ml-2 w-32" />
              )}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="retainer_type"
                value="included"
                checked={retainerType === "included"}
                onChange={() => setRetainerType("included")}
                className="accent-gold"
              />
              Included in current retainer
            </label>
          </div>
        </div>

        {state?.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit for approval"}
          </Button>
          <button type="button" onClick={onClose} className="text-sm text-charcoal hover:text-ink">
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
