import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { saveConnectionFromCode } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (oauthError || !code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/tasks?google=error", siteUrl));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", siteUrl));

  try {
    await saveConnectionFromCode(user.id, code);
  } catch (err) {
    console.error("[google/callback] failed to save connection:", err);
    return NextResponse.redirect(new URL("/tasks?google=error", siteUrl));
  }

  return NextResponse.redirect(new URL("/tasks?google=connected", siteUrl));
}
