"use client";

import { useActionState, useRef, useState } from "react";
import { inviteMember } from "@/lib/actions/admin";
import { Button, Input, Select } from "@/components/ui";

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteMember, undefined);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        setCopied(false);
        const result = await formAction(fd);
        if ((result as { success?: string } | undefined)?.success) formRef.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <Input name="email" type="email" required placeholder="name@sunnyadvertising.com.au" className="w-64" />
      <Input name="full_name" placeholder="Full name" className="w-40" />
      <Input name="team" placeholder="Team" className="w-36" />
      <Select name="role" defaultValue="team" className="w-28">
        <option value="team">Team</option>
        <option value="admin">Admin</option>
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate invite link"}
      </Button>
      {state?.error && <p className="w-full text-xs font-medium text-red-600">{state.error}</p>}
      {state?.success && (
        <div className="mt-1 w-full space-y-2">
          <p className="text-xs font-medium text-green-700">{state.success}</p>
          {state.inviteLink && (
            <div className="flex items-center gap-2">
              <Input readOnly value={state.inviteLink} className="flex-1 text-xs" onFocus={(e) => e.target.select()} />
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(state.inviteLink!);
                  setCopied(true);
                }}
              >
                {copied ? "Copied!" : "Copy link"}
              </Button>
            </div>
          )}
          <p className="text-xs text-charcoal">
            This link isn&apos;t emailed automatically — copy it and send it to them yourself (Slack, email, etc).
          </p>
        </div>
      )}
    </form>
  );
}
