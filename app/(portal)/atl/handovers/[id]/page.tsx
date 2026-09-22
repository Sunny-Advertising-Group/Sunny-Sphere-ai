import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";

// Google Docs share/edit links refuse to render in an iframe — the "preview"
// path is the one Google itself serves embeddable, so we swap to that for
// any docs.google.com link (docs, sheets and slides all support it).
function embeddableUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    if (!url.hostname.endsWith("docs.google.com")) return sourceUrl;
    url.pathname = url.pathname.replace(/\/(edit|view)$/, "/preview");
    if (!/\/preview$/.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/$/, "")}/preview`;
    url.search = "";
    return url.toString();
  } catch {
    return sourceUrl;
  }
}

export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();
  const { data: handover } = await supabase
    .from("handovers")
    .select("id, title, file_path, source_url")
    .eq("id", id)
    .single();
  if (!handover) notFound();

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title={handover.title}
        backHref="/atl"
        backLabel="All handovers"
        action={
          handover.source_url ? (
            <a
              href={handover.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal hover:text-gold"
            >
              Open in Google Docs <ExternalLink className="h-3 w-3" strokeWidth={2} />
            </a>
          ) : undefined
        }
      />
      <iframe
        src={handover.file_path ? `/atl/handovers/${handover.id}/raw` : embeddableUrl(handover.source_url!)}
        title={handover.title}
        sandbox={
          handover.file_path
            ? "allow-scripts allow-same-origin allow-popups"
            : "allow-scripts allow-same-origin allow-popups allow-forms"
        }
        referrerPolicy="no-referrer"
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
