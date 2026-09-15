"use client";

import { useActionState } from "react";
import Link from "next/link";
import { uploadMonthlyWrap } from "../../actions";
import { Button, Input, PageHeader } from "@/components/ui";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function UploadWrapForm() {
  const [state, formAction, pending] = useActionState(uploadMonthlyWrap, undefined);

  return (
    <div>
      <PageHeader
        title="Upload this month's wrap"
        description="Uploading again for a month you've already published replaces that wrap."
        backHref="/agency/monthly-wraps"
        backLabel="All wraps"
      />
      <div className="p-8">
        <form action={formAction} className="max-w-xl space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Month</label>
            <Input name="month" type="month" required defaultValue={currentMonth()} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Title (optional)</label>
            <Input name="title" placeholder="e.g. September 2026 Wrap" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Wrap HTML file</label>
            <input
              name="file"
              type="file"
              accept=".html,.htm,text/html"
              required
              className="block w-full text-sm text-charcoal file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
            />
          </div>

          {state?.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Publish wrap"}
            </Button>
            <Link href="/agency/monthly-wraps" className="text-sm text-charcoal hover:text-ink">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
