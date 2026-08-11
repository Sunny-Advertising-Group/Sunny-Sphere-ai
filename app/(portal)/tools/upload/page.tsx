"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitTool } from "../actions";
import { Button, Input, PageHeader, Select, Textarea } from "@/components/ui";

const TOOL_TYPES = ["Claude Skill", "Prompt", "Tool", "Template"];
const CATEGORIES = ["Reporting", "Strategy", "Creative", "Brand", "Ways of Working"];

export default function UploadToolPage() {
  const [state, formAction, pending] = useActionState(submitTool, undefined);

  return (
    <div>
      <PageHeader title="Submit a tool" description="Goes to the admin review queue before it's visible in the hub." />
      <div className="p-8">
        <form action={formAction} className="max-w-xl space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Name</label>
            <Input name="name" required placeholder="e.g. Campaign Brief Summariser" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">Type</label>
              <Select name="tool_type" required defaultValue="">
                <option value="" disabled>
                  Select type
                </option>
                {TOOL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">Category</label>
              <Select name="category" required defaultValue="">
                <option value="" disabled>
                  Select category
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Description</label>
            <Textarea name="description" required placeholder="What does it do?" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">How to use it</label>
            <Textarea name="how_to_use" placeholder="Optional setup or usage notes" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Link (optional)</label>
            <Input name="link_url" type="url" placeholder="https://…" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Attach a file (optional)</label>
            <input
              name="file"
              type="file"
              className="block w-full text-sm text-charcoal file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
            />
          </div>

          {state?.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit for review"}
            </Button>
            <Link href="/tools" className="text-sm text-charcoal hover:text-ink">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
