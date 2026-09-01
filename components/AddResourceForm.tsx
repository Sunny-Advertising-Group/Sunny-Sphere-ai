"use client";

import { useActionState, useRef, useState } from "react";
import { addResource } from "@/lib/actions/resources";
import { Button, Input, Select, Textarea } from "@/components/ui";

const RESOURCE_TYPES = ["PDF", "Doc", "Folder", "Tool", "Video"];

export function AddResourceForm({
  section,
  label = "+ Add resource",
  showBody = false,
  showDuration = false,
}: {
  section:
    | "policy"
    | "learning_path"
    | "loom"
    | "faq"
    | "dashboard_doc"
    | "dashboard_notification"
    | "dashboard_link"
    | "key_resource"
    | "acronym";
  label?: string;
  showBody?: boolean;
  showDuration?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addResource, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        const result = await formAction(fd);
        if (!(result as { error?: string } | undefined)?.error) formRef.current?.reset();
      }}
      className="mb-6 space-y-3 rounded-xl border border-border-c bg-white p-4"
    >
      <input type="hidden" name="section" value={section} />
      <div className="grid grid-cols-2 gap-3">
        <Input name="group_name" placeholder="Group (e.g. People & culture)" />
        <Input name="title" placeholder="Title" required />
      </div>
      {showBody ? (
        <Textarea name="body" placeholder="Answer / body" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Input name="url" placeholder="Link (Drive, Loom, etc.)" />
          <Select name="resource_type" defaultValue="">
            <option value="" disabled>
              Type
            </option>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Textarea name="description" placeholder="Short description (optional)" />
      {showDuration && (
        <div className="grid grid-cols-2 gap-3">
          <Input name="duration" placeholder="Duration (e.g. 12 min)" />
          <Input name="module_count" type="number" placeholder="Module count" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-charcoal hover:text-ink">
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-xs font-medium text-red-600">{state.error}</p>}
    </form>
  );
}
