# Sunny Sphere

Sunny Advertising's internal AI tool hub and agency portal — Next.js (App Router, TypeScript) + Supabase (Auth, Postgres, Storage, RLS), deployed on Vercel.

## Stack

- Next.js App Router, TypeScript, Tailwind
- Supabase — invite-only email/password auth, Postgres with RLS, Storage
- Poppins via `next/font/google`

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL/keys
npm run dev
```

## Access model

- Invite-only. Admins invite via `supabase.auth.admin.inviteUserByEmail()`, restricted to `@sunnyadvertising.com.au`.
- Two roles: `team` | `admin`, stored on `profiles`. Admins see every section implicitly.
- Restricted sections (currently just `atl`) require an explicit row in `section_access`. Enforced in three places: the sidebar (hidden), the dashboard tiles (hidden), and the route itself (redirected) — RLS is the real boundary underneath all three.

## Structure

- `app/(portal)/` — everything behind the authenticated shell (sidebar + role/section gating in `layout.tsx`)
- `app/login`, `app/invite` — public auth routes
- `lib/supabase/` — browser, server (cookie-based), and service-role clients
- `lib/access.ts` — single source of truth for what the current user can see
- `lib/actions/` — shared server actions (admin mutations, resource content entry)
- `app/api/cron/sync-drive-metadata` — hourly job that refreshes the Links tab's "last updated"/"by" columns
- `app/api/cron/sync-live-material` — hourly job that replaces each client's Live material rows from their tracker sheet
- (see `vercel.json` for both schedules)

## Google Drive syncs (Links freshness + Live material)

Both hourly syncs read from Drive using a single plain API key — no service account — which only works because the target files are shared "Anyone with the link can view". If that sharing ever changes for a file, its sync starts failing (currently silently for the metadata sync: `drive_checked_at` still updates but `drive_modified_at` won't, so a row stuck on a stale date is the tell; the live material sync logs and skips that client on export failure, leaving its existing rows in place).

- **Links freshness** (`sync-drive-metadata`): each `atl_links` row can have a `cadence` (weekly/fortnightly/monthly/quarterly/none). For rows with a cadence, this job reads `modifiedTime`/`lastModifyingUser` via `files.get` and writes `drive_modified_at`/`drive_modified_by`, which drive the current/due soon/overdue status shown in the Links tab. Known limitation: for links pointing at a folder rather than a single file, `modifiedTime` only reflects changes to the folder itself (rename, description), not files added/edited inside it.
- **Live material** (`sync-live-material`): for every `atl_links` row with kind `live_material_tracker`, exports that client's tracker Google Sheet as CSV via `files.export`, parses it with `lib/liveMaterial.ts`, and replaces (delete + insert) that client's `live_material` rows. The tracker sheet is the source of truth, so this is a full replace, not a merge.

Setup: `GOOGLE_DRIVE_API_KEY` (a Drive-API-only key, no service account) and `CRON_SECRET` (checked against each cron request's `Authorization` header) as Vercel env vars — see `.env.example`. Note: Vercel's Hobby plan runs cron jobs at most once a day regardless of the schedule string in `vercel.json` — true hourly runs need a Pro (or higher) plan.

## Known deferred work

- Client-facing `partner` role — not built; can be added without touching existing tables.
- Custom domain — currently on the default Vercel domain.

The original static prototype lives in `legacy/` for reference.
