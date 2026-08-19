"use client";

import { useState } from "react";
import { Select } from "@/components/ui";

export type PersonOption = { id: string; label: string };

// Chips of currently-assigned people plus a "+ Assign" control for adding
// more from `options`. Purely presentational/controlled — the caller owns
// the assigned list and how add/remove are persisted (so it can do the same
// optimistic-update-then-transition pattern used elsewhere in the admin UI).
export function AssigneePicker({
  assigned,
  options,
  max,
  onAdd,
  onRemove,
}: {
  assigned: PersonOption[];
  options: PersonOption[];
  max?: number;
  onAdd: (profileId: string) => void;
  onRemove: (profileId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = options.filter((o) => !assigned.some((a) => a.id === o.id));
  const atMax = max !== undefined && assigned.length >= max;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assigned.map((person) => (
        <span
          key={person.id}
          className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-charcoal"
        >
          {person.label}
          <button
            type="button"
            onClick={() => onRemove(person.id)}
            className="text-charcoal hover:text-red-600"
            aria-label={`Remove ${person.label}`}
          >
            ×
          </button>
        </span>
      ))}
      {atMax ? (
        <span className="text-xs text-charcoal">Max {max} people</span>
      ) : available.length === 0 ? null : open ? (
        <Select
          autoFocus
          defaultValue=""
          className="w-40"
          onChange={(e) => {
            if (e.target.value) onAdd(e.target.value);
            setOpen(false);
          }}
          onBlur={() => setOpen(false)}
        >
          <option value="" disabled>
            Assign…
          </option>
          {available.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-dashed border-border-c px-2.5 py-1 text-xs font-semibold text-charcoal hover:border-gold/50 hover:text-gold"
        >
          + Assign
        </button>
      )}
    </div>
  );
}
