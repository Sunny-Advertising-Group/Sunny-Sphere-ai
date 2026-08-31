import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/driveSync";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Daily purge (see vercel.json) of tasks ticked off more than 14 days ago —
// completed tasks disappear from the board instantly but stay visible in the
// "Completed" history for that window before being permanently removed here.
const RETENTION_DAYS = 14;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();

  const { data, error } = await supabase.from("tasks").delete().lt("completed_at", cutoff).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: data?.length ?? 0 });
}
