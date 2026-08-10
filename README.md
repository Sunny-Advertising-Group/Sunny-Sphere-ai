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

## Known deferred work

- Live Material Google Sheet sync (hourly cron) — `clients` and `atl_links` are live; `live_material` is wired up but shows a "sync not yet configured" state until Sheets credentials are added.
- Client-facing `partner` role — not built; can be added without touching existing tables.
- Custom domain — currently on the default Vercel domain.

The original static prototype lives in `legacy/` for reference.
