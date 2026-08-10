"use client";

import { useActionState, useRef } from "react";
import { submitAiRequest } from "./actions";
import { Button, Input, Textarea } from "@/components/ui";

export function AiRequestForm() {
  const [state, formAction, pending] = useActionState(submitAiRequest, undefined);
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
      <div>
        <label className="mb-1 block text-xs font-semibold text-charcoal">What&apos;s the task?</label>
        <Textarea name="task" required placeholder="Describe what you're doing manually that AI could help with" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-charcoal">How often?</label>
          <Input name="frequency" placeholder="e.g. Weekly" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-charcoal">Hours it costs you</label>
          <Input name="hours_estimate" placeholder="e.g. 3 hrs/week" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-charcoal">Clients affected</label>
        <Input name="clients_affected" placeholder="Optional" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-charcoal">Ideal outcome</label>
        <Textarea name="ideal_outcome" placeholder="What would 'solved' look like?" />
      </div>

      {state?.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm font-medium text-green-700">Sent to the AI Champs 🎉</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit to the AI Champs →"}
      </Button>
    </form>
  );
}
