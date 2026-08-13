import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDriveFileId, fetchDriveCsvExport, isAuthorizedCronRequest, mapWithConcurrency } from "@/lib/driveSync";
import { parseLiveMaterial } from "@/lib/liveMaterial";
import { LIVE_MATERIAL_KIND_PATTERN } from "@/lib/atl";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily sync (4:15pm AEST / 06:15 UTC, see vercel.json) for the Live material
// tab: exports every
// tracker Google Sheet (any atl_links row whose kind contains "live_material"
// — most clients have one, Lincoln Place has three, split by state) as CSV
// via the Drive API (plain API key — works because the sheet is shared
// "Anyone with the link can view"), and replaces that link's live_material
// rows with the parsed result. Scoped by (client_id, source_kind) rather than
// just client_id so a client with multiple trackers doesn't have one
// overwrite another's rows. The tracker sheet is the source of truth, so
// this is a full delete-and-replace per source, not an upsert.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_DRIVE_API_KEY is not configured" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const { data: trackerLinks, error } = await supabase
    .from("atl_links")
    .select("id, client_id, kind, url")
    .ilike("kind", `%${LIVE_MATERIAL_KIND_PATTERN}%`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const syncedAt = new Date().toISOString();
  let syncedTrackers = 0;
  let failed = 0;
  let skippedNoFileId = 0;
  let totalRows = 0;

  await mapWithConcurrency(trackerLinks ?? [], 4, async (link) => {
    const fileId = extractDriveFileId(link.url);
    if (!fileId) {
      skippedNoFileId++;
      return;
    }

    try {
      const csv = await fetchDriveCsvExport(fileId, apiKey);
      const records = parseLiveMaterial(csv);

      await supabase
        .from("live_material")
        .delete()
        .eq("client_id", link.client_id)
        .eq("source_kind", link.kind);
      if (records.length > 0) {
        await supabase.from("live_material").insert(
          records.map((r) => ({ ...r, client_id: link.client_id, source_kind: link.kind, synced_at: syncedAt })),
        );
      }
      syncedTrackers++;
      totalRows += records.length;
    } catch (err) {
      failed++;
      console.error(`Live material sync failed for atl_links.id=${link.id} (${link.url})`, err);
    }
  });

  return NextResponse.json({ syncedAt, syncedTrackers, failed, skippedNoFileId, totalRows });
}
