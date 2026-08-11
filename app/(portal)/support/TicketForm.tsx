"use client";

import { useActionState, useRef } from "react";
import { submitTicket } from "./actions";
import { Button, Select, Textarea } from "@/components/ui";

export function TicketForm() {
  const [state, formAction, pending] = useActionState(submitTicket, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        const result = await formAction(fd);
        if (!(result as { error?: string } | undefined)?.error) formRef.current?.reset();
      }}
      className="max-w-xl space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-charcoal">Category</label>
          <Select name="category" defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option>Access</option>
            <option>Bug</option>
            <option>Equipment</option>
            <option>HR</option>
            <option>Other</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-charcoal">Urgency</label>
          <Select name="urgency" defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </Select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-charcoal">What&apos;s going on?</label>
        <Textarea name="body" required placeholder="Describe the issue" />
      </div>

      {state?.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm font-medium text-green-700">Ticket raised — we&apos;ll get back to you.</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Raising…" : "Raise a ticket"}
      </Button>
    </form>
  );
}
