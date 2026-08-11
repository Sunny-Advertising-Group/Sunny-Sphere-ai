import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDriveFileId, fetchDriveCsvExport, mapWithConcurrency } from "@/lib/driveSync";
import { parseLiveMaterial } from "@/lib/liveMaterial";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hourly sync (see vercel.json) for the Live material tab: exports each
// client's "Live material tracker" Google Sheet as CSV via the Drive API
// (plain API key — works because the sheet is shared "Anyone with the link
// can view") and replaces that client's live_material rows with the parsed
// result. The tracker sheet is the source of truth, so this is a full
// delete-and-replace per client rather than an upsert.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_DRIVE_API_KEY is not configured" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const { data: trackerLinks, error } = await supabase
    .from("atl_links")
    .select("id, client_id, url")
    .eq("kind", "live_material_tracker");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const syncedAt = new Date().toISOString();
  let syncedClients = 0;
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

      await supabase.from("live_material").delete().eq("client_id", link.client_id);
      if (records.length > 0) {
        await supabase.from("live_material").insert(
          records.map((r) => ({ ...r, client_id: link.client_id, synced_at: syncedAt })),
        );
      }
      syncedClients++;
      totalRows += records.length;
    } catch (err) {
      failed++;
      console.error(`Live material sync failed for client_id=${link.client_id} (${link.url})`, err);
    }
  });

  return NextResponse.json({ syncedAt, syncedClients, failed, skippedNoFileId, totalRows });
}
