import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDriveFileId, fetchDriveMetadata, isAuthorizedCronRequest, mapWithConcurrency } from "@/lib/driveSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hourly Drive metadata sync for the Housekeeping tab (see vercel.json for the
// schedule). Refreshes drive_modified_at/drive_modified_by for every atl_links
// row that has a tracked cadence, by reading the underlying Drive file's
// metadata via a plain API key — which only works because those files are
// shared "Anyone with the link can view". Folder links only reflect changes
// to the folder itself (rename, description), not files added inside it —
// Drive doesn't roll content changes up to folder modifiedTime.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_DRIVE_API_KEY is not configured" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const { data: links, error } = await supabase
    .from("atl_links")
    .select("id, url, cadence")
    .not("cadence", "is", null)
    .neq("cadence", "none");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const checkedAt = new Date().toISOString();
  let synced = 0;
  let failed = 0;
  let skippedNoFileId = 0;

  await mapWithConcurrency(links ?? [], 6, async (link) => {
    const fileId = extractDriveFileId(link.url);
    if (!fileId) {
      skippedNoFileId++;
      return;
    }

    try {
      const meta = await fetchDriveMetadata(fileId, apiKey);
      await supabase
        .from("atl_links")
        .update({
          drive_modified_at: meta.modifiedTime,
          drive_modified_by: meta.modifiedByName,
          drive_checked_at: checkedAt,
        })
        .eq("id", link.id);
      synced++;
    } catch (err) {
      failed++;
      // Still record the attempt so a broken link doesn't sit at "Awaiting sync" forever
      // looking identical to one that's never been checked.
      await supabase.from("atl_links").update({ drive_checked_at: checkedAt }).eq("id", link.id);
      console.error(`Drive metadata sync failed for atl_links.id=${link.id} (${link.url})`, err);
    }
  });

  return NextResponse.json({ checkedAt, synced, failed, skippedNoFileId, total: links?.length ?? 0 });
}
