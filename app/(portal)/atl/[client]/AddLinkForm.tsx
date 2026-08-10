"use client";

import { useActionState, useRef, useState } from "react";
import { addAtlLink } from "../actions";
import { Button, Input, Select } from "@/components/ui";

const KINDS = [
  { value: "flight_plan", label: "Flight plan" },
  { value: "wip", label: "WIP" },
  { value: "rate_card", label: "Rate card" },
  { value: "budget", label: "Budget" },
  { value: "assets", label: "Assets" },
  { value: "reporting", label: "Reporting" },
];

export function AddLinkForm({ clientId }: { clientId: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addAtlLink, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        + Add link
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
      }}
      className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-border-c bg-bg p-3"
    >
      <input type="hidden" name="client_id" value={clientId} />
      <Select name="kind" required className="w-40">
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </Select>
      <Input name="title" placeholder="Title" required className="w-40" />
      <Input name="url" placeholder="Drive link" required className="w-64" />
      <Input name="version_label" placeholder="v4 · 22 Jul" className="w-32" />
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
