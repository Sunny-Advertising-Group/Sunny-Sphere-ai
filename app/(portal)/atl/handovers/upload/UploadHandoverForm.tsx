"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createHandover } from "../../actions";
import { Button, Input, PageHeader, Textarea } from "@/components/ui";

// Supabase Storage limit, not Vercel's — the file goes straight from the
// browser to storage, bypassing the serverless function entirely (same
// reasoning as Monthly Wraps).
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function UploadHandoverForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "link">("file");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const coveringFor = String(formData.get("covering_for") ?? "").trim();
    const startsOn = String(formData.get("starts_on") ?? "").trim();
    const endsOn = String(formData.get("ends_on") ?? "").trim();

    if (!title) return setError("Give the handover a title.");

    setPending(true);

    if (mode === "link") {
      const sourceUrl = String(formData.get("source_url") ?? "").trim();
      if (!sourceUrl) {
        setError("Paste a Google Doc link.");
        setPending(false);
        return;
      }
      const result = await createHandover({ title, coveringFor, startsOn, endsOn, sourceUrl });
      if (result?.error) {
        setError(result.error);
        setPending(false);
        return;
      }
      router.push("/atl");
      router.refresh();
      return;
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return finishWithError("Choose an HTML file to upload.");
    if (!/\.html?$/i.test(file.name)) return finishWithError("Only .html files are supported.");
    if (file.size > MAX_FILE_BYTES) {
      return finishWithError(`That file is ${(file.size / (1024 * 1024)).toFixed(1)}MB — the limit is 50MB.`);
    }

    const supabase = createClient();
    const path = `${crypto.randomUUID()}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("handovers")
      .upload(path, file, { contentType: "text/html" });
    if (uploadError) return finishWithError(`Upload failed: ${uploadError.message}`);

    const result = await createHandover({ title, coveringFor, startsOn, endsOn, filePath: path });
    if (result?.error) return finishWithError(result.error);

    router.push("/atl");
    router.refresh();

    function finishWithError(message: string) {
      setError(message);
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Add a handover"
        description="Upload an HTML write-up or link a Google Doc so the team can find it while you're away."
        backHref="/atl"
        backLabel="Back to ATL"
      />
      <div className="p-8">
        <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Title</label>
            <Input name="title" placeholder="e.g. Acme Co — while I'm away" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Covering for / notes (optional)</label>
            <Textarea name="covering_for" placeholder="e.g. Jordan is covering client calls, briefs go to Sam" rows={2} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-charcoal">Away from (optional)</label>
              <Input name="starts_on" type="date" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-charcoal">Back on (optional)</label>
              <Input name="ends_on" type="date" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {(["file", "link"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === m ? "border-gold bg-gold text-ink" : "border-border-c text-charcoal hover:border-gold/50"
                }`}
              >
                {m === "file" ? "Upload HTML file" : "Link a Google Doc"}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">Handover HTML file</label>
              <input
                name="file"
                type="file"
                accept=".html,.htm,text/html"
                className="block w-full text-sm text-charcoal file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">Google Doc link</label>
              <Input name="source_url" type="url" placeholder="https://docs.google.com/document/d/..." />
              <p className="mt-1 text-xs text-charcoal">
                Make sure the doc is shared with the team (&ldquo;Anyone with the link can view&rdquo;) so it opens for everyone.
              </p>
            </div>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Publish handover"}
            </Button>
            <Link href="/atl" className="text-sm text-charcoal hover:text-ink">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
