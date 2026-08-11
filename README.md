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
- `app/api/cron/sync-drive-metadata` — hourly job (see `vercel.json`) that refreshes the Housekeeping tab's "last updated"/"by" columns

## Housekeeping tab Drive sync

Each `atl_links` row can have a `cadence` (weekly/fortnightly/monthly/quarterly/none). For rows with a cadence, an hourly cron hits the Drive API with a plain API key — not a service account — to read `modifiedTime`/`lastModifyingUser` for the file, and writes it to `drive_modified_at`/`drive_modified_by`. This only works because the linked files are shared "Anyone with the link can view"; if that ever changes for a file, its sync will start failing (currently: silently — `drive_checked_at` still updates but `drive_modified_at` won't, so a row stuck on a stale date is the tell).

Setup: `GOOGLE_DRIVE_API_KEY` (a Drive-API-only key, no service account) and `CRON_SECRET` (checked against the cron request's `Authorization` header) as Vercel env vars — see `.env.example`.

Known limitation: for links pointing at a folder rather than a single file, `modifiedTime` only reflects changes to the folder itself (rename, description), not files added/edited inside it — Drive doesn't roll content changes up to the folder's own metadata.

## Known deferred work

- Live Material Google Sheet sync (hourly cron) — `clients` and `atl_links` are live; `live_material` is wired up but shows a "sync not yet configured" state until Sheets credentials are added.
- Client-facing `partner` role — not built; can be added without touching existing tables.
- Custom domain — currently on the default Vercel domain.

The original static prototype lives in `legacy/` for reference.
