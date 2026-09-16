"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { finalizeMonthlyWrapUpload } from "../../actions";
import { Button, Input, PageHeader } from "@/components/ui";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// This is a Supabase Storage limit, not Vercel's — the file goes straight
// from the browser to storage, bypassing the serverless function entirely.
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function UploadWrapForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const month = String(formData.get("month") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const file = formData.get("file");

    if (!month) return setError("Choose a month.");
    if (!(file instanceof File) || file.size === 0) return setError("Choose an HTML file to upload.");
    if (!/\.html?$/i.test(file.name)) return setError("Only .html files are supported.");
    if (file.size > MAX_FILE_BYTES) {
      return setError(`That file is ${(file.size / (1024 * 1024)).toFixed(1)}MB — the limit is 50MB.`);
    }

    setPending(true);
    const supabase = createClient();
    const path = `${crypto.randomUUID()}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("monthly_wraps")
      .upload(path, file, { contentType: "text/html" });
    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setPending(false);
      return;
    }

    const result = await finalizeMonthlyWrapUpload(month, title, path);
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    router.push("/agency/monthly-wraps");
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Upload this month's wrap"
        description="Uploading again for a month you've already published replaces that wrap."
        backHref="/agency/monthly-wraps"
        backLabel="All wraps"
      />
      <div className="p-8">
        <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
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

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

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
