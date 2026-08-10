"use client";

import { useActionState, useRef, useState } from "react";
import { addClient } from "./actions";
import { Button, Input } from "@/components/ui";

export function AddClientForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addClient, undefined);
  const formRef = useRef<HTMLFormElement>(null);

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
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <Input name="name" placeholder="Client name" required className="w-48" />
      <Input name="colour" placeholder="#RRGGBB (optional)" className="w-40" />
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
