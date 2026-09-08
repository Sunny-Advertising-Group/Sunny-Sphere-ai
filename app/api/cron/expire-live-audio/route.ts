import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/driveSync";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Daily sweep (see vercel.json) for the ATL audio production tracker: any
// spot still marked "live" whose end_date has passed flips to "notlive"
// automatically. A null end_date means ongoing/no fixed end and is never
// touched here — only editing the item (e.g. pushing end_date forward)
// keeps a spot live past its original date.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("atl_audio_items")
    .update({ status: "notlive" })
    .eq("status", "live")
    .not("end_date", "is", null)
    .lt("end_date", today)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expired: data?.length ?? 0 });
}
