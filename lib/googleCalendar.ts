import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/callback`,
  );
}

export function isGoogleCalendarConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function getGoogleAuthUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function saveConnectionFromCode(profileId: string, code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.expiry_date) {
    throw new Error("Incomplete token response from Google.");
  }

  const admin = createAdminClient();
  // Google only sends a refresh_token on the *first* consent — a reconnect
  // without one keeps whatever refresh_token is already stored.
  let refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    const { data: existing } = await admin
      .from("google_calendar_connections")
      .select("refresh_token")
      .eq("profile_id", profileId)
      .maybeSingle();
    refreshToken = existing?.refresh_token;
  }
  if (!refreshToken) {
    throw new Error("Google didn't grant offline access. Try disconnecting any prior grant at myaccount.google.com and reconnecting.");
  }

  const { error } = await admin.from("google_calendar_connections").upsert({
    profile_id: profileId,
    access_token: tokens.access_token,
    refresh_token: refreshToken,
    token_expiry: new Date(tokens.expiry_date).toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function removeGoogleConnection(profileId: string) {
  const admin = createAdminClient();
  await admin.from("google_calendar_connections").delete().eq("profile_id", profileId);
}

export async function hasGoogleConnection(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_calendar_connections")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  return !!data;
}

// An authorized googleapis client for this profile, refreshing the access
// token first if it's about to expire — or null if they're not connected.
async function authorizedClientFor(profileId: string) {
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expiry")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!connection) return null;

  const client = oauthClient();
  client.setCredentials({ access_token: connection.access_token, refresh_token: connection.refresh_token });

  const expiresSoon = new Date(connection.token_expiry).getTime() < Date.now() + 60_000;
  if (expiresSoon) {
    const { credentials } = await client.refreshAccessToken();
    if (credentials.access_token && credentials.expiry_date) {
      await admin
        .from("google_calendar_connections")
        .update({ access_token: credentials.access_token, token_expiry: new Date(credentials.expiry_date).toISOString() })
        .eq("profile_id", profileId);
    }
  }
  return client;
}

export type CalendarSyncTask = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  google_event_id: string | null;
  google_calendar_owner_id: string | null;
};

function addOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Keeps a task's Google Calendar event (an all-day event on its due date) in
// sync with whoever the task currently belongs to — the tagged assignee if
// any, otherwise whoever's column it's filed in. Silently no-ops if that
// person hasn't connected Google Calendar, or Google OAuth isn't configured
// at all. Returns the {google_event_id, google_calendar_owner_id} to
// persist on the task row; never throws (sync failures shouldn't block the
// task mutation that triggered them).
export async function syncTaskCalendarEvent(
  task: CalendarSyncTask,
  calendarOwnerId: string,
): Promise<{ google_event_id: string | null; google_calendar_owner_id: string | null }> {
  if (!isGoogleCalendarConfigured()) {
    return { google_event_id: task.google_event_id, google_calendar_owner_id: task.google_calendar_owner_id };
  }

  try {
    let current = task;

    // Re-tagged since the last sync, or the due date was cleared: drop the
    // stale event from whichever calendar it was actually created on.
    if (current.google_event_id && current.google_calendar_owner_id && (current.google_calendar_owner_id !== calendarOwnerId || !current.due_date)) {
      const oldClient = await authorizedClientFor(current.google_calendar_owner_id);
      if (oldClient) {
        await google
          .calendar({ version: "v3", auth: oldClient })
          .events.delete({ calendarId: "primary", eventId: current.google_event_id })
          .catch(() => {});
      }
      current = { ...current, google_event_id: null, google_calendar_owner_id: null };
    }

    if (!current.due_date) return { google_event_id: null, google_calendar_owner_id: null };

    const client = await authorizedClientFor(calendarOwnerId);
    if (!client) return { google_event_id: null, google_calendar_owner_id: null };

    const calendar = google.calendar({ version: "v3", auth: client });
    const requestBody = {
      summary: `📋 ${current.title}`,
      description: current.description ?? undefined,
      start: { date: current.due_date },
      end: { date: addOneDay(current.due_date) },
    };

    if (current.google_event_id) {
      try {
        await calendar.events.update({ calendarId: "primary", eventId: current.google_event_id, requestBody });
        return { google_event_id: current.google_event_id, google_calendar_owner_id: calendarOwnerId };
      } catch {
        // Fall through to recreate — the event may have been deleted on Google's side.
      }
    }
    const { data } = await calendar.events.insert({ calendarId: "primary", requestBody });
    return { google_event_id: data.id ?? null, google_calendar_owner_id: data.id ? calendarOwnerId : null };
  } catch (err) {
    console.error("[googleCalendar] sync failed:", err);
    return { google_event_id: task.google_event_id, google_calendar_owner_id: task.google_calendar_owner_id };
  }
}

export async function deleteTaskCalendarEvent(task: CalendarSyncTask): Promise<void> {
  if (!task.google_event_id || !task.google_calendar_owner_id) return;
  try {
    const client = await authorizedClientFor(task.google_calendar_owner_id);
    if (!client) return;
    await google
      .calendar({ version: "v3", auth: client })
      .events.delete({ calendarId: "primary", eventId: task.google_event_id })
      .catch(() => {});
  } catch (err) {
    console.error("[googleCalendar] delete failed:", err);
  }
}
