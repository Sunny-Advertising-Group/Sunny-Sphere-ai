"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { submitTool } from "../actions";
import { CategorySelect } from "../CategorySelect";
import { Button, Input, PageHeader, Select, Textarea } from "@/components/ui";

const TOOL_TYPES = ["Claude Skill", "Prompt", "Tool", "Template"];
const DEFAULT_COLOUR = "#FDB600";

export function UploadToolForm({ categories }: { categories: { id: number; name: string }[] }) {
  const [state, formAction, pending] = useActionState(submitTool, undefined);
  const [useColour, setUseColour] = useState(false);
  const [colour, setColour] = useState(DEFAULT_COLOUR);

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
              <CategorySelect categories={categories} />
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
          <div>
            <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-charcoal">
              <input
                type="checkbox"
                checked={useColour}
                onChange={(e) => setUseColour(e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              Give this tool&apos;s card a custom colour
            </label>
            {useColour && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colour}
                  onChange={(e) => setColour(e.target.value)}
                  className="h-9 w-9 flex-none cursor-pointer rounded border border-border-c bg-white p-0.5"
                  aria-label="Card colour"
                />
                <Input
                  value={colour}
                  onChange={(e) => setColour(e.target.value)}
                  placeholder="#RRGGBB"
                  className="w-28"
                  maxLength={7}
                />
              </div>
            )}
            <input type="hidden" name="colour" value={useColour ? colour : ""} />
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
