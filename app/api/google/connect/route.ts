import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthUrl, isGoogleCalendarConfigured } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "google_oauth_state";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL));

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/tasks?google=not_configured", process.env.NEXT_PUBLIC_SITE_URL));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  return NextResponse.redirect(getGoogleAuthUrl(state));
}
