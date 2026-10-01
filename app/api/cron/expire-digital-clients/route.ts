import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/driveSync";
import { brisbaneTodayIso } from "@/lib/digitalOpti";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Daily sweep (see vercel.json) for the Digital board: any client or
// tactical whose end_date (a tactical's end, or an offboarding date) is now
// in the past is archived, so it drops off the board. end_date is the last
// day it runs, so it's archived the day after. A null end_date is ongoing
// and never touched. The board also hides past-end-date rows itself, so a
// late or missed run never leaves one showing.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("clients")
    .update({ digital_status: "archived" })
    .eq("on_digital", true)
    // A null status reads as "active" everywhere else, and a plain neq
    // would skip it (null <> 'archived' isn't true in SQL).
    .or("digital_status.is.null,digital_status.neq.archived")
    .not("end_date", "is", null)
    .lt("end_date", brisbaneTodayIso())
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ archived: data?.length ?? 0 });
}
