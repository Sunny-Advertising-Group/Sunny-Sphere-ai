"use client";

import { useActionState, useRef } from "react";
import { submitTip } from "./actions";
import { Button, Input, Textarea } from "@/components/ui";

export function TipForm({ isPrompt }: { isPrompt: boolean }) {
  const [state, formAction, pending] = useActionState(submitTip, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        const result = await formAction(fd);
        if (!(result as { error?: string } | undefined)?.error) formRef.current?.reset();
      }}
      className="space-y-3 rounded-xl border border-border-c bg-white p-4"
    >
      <input type="hidden" name="is_prompt" value={isPrompt ? "true" : "false"} />
      {isPrompt && <Input name="title" placeholder="Prompt title" required />}
      <div className="flex gap-3">
        <Input name="category" placeholder="Tag (optional)" className="max-w-[160px]" />
      </div>
      <Textarea name="body" required placeholder={isPrompt ? "Paste the prompt…" : "Share a tip or trick…"} />
      {state?.error && <p className="text-xs font-medium text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Sharing…" : isPrompt ? "Add to prompt library" : "Share tip"}
      </Button>
    </form>
  );
}
