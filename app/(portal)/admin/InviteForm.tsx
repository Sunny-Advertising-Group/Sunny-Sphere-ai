"use client";

import { useActionState, useRef } from "react";
import { inviteMember } from "@/lib/actions/admin";
import { Button, Input, Select } from "@/components/ui";

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteMember, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
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
        {pending ? "Inviting…" : "Send invite"}
      </Button>
      {state?.error && <p className="w-full text-xs font-medium text-red-600">{state.error}</p>}
      {state?.success && <p className="w-full text-xs font-medium text-green-700">{state.success}</p>}
    </form>
  );
}
