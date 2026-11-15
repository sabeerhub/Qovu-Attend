# Deployment Guide — UniAttend

## Target

Cloudflare Pages hosting the Vite SPA. Supabase (Postgres + Auth)
as the backend. Free tier only, within published quotas.

## Prerequisites (needed from Mustapha)

1. A Supabase project (free tier) — project URL + anon key.
2. A Cloudflare account + a Pages project connected to the repo
   (the repo itself is **not** created yet — see README).
3. No service-role key is needed for the frontend, ever.

## Environment variables

Set these in Cloudflare Pages (and in a local `.env`, never
committed):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

There is no other secret in Phase 1.

## Database setup (once, against the Supabase project)

1. In the Supabase SQL editor, run
   `supabase/migrations/20261115000000_init.sql`.
2. Verify all 12 tables exist and RLS is enabled on each.
3. Only for a test/staging project, optionally run
   `supabase/seed.sql` — it contains **example/test data only**
   (Faculty of Computing, CIT 301 / CIT 305 / CSC 301). Never run
   seed data against a production project.
4. Test RLS with two lecturer accounts before pilot (see
   `SECURITY_MODEL.md` — unverified until that test runs).

## Build & deploy

```
npm install
npm run build      # tsc (strict) + vite build
```

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 18+ (tested locally on Node 24).

Cloudflare Pages will run the build on each push once the repo
exists and is connected.

## Rollback

- Frontend: redeploy the previous Pages deployment.
- Database: schema changes only ever go through a new migration
  file. Never edit a migration that has already been applied, and
  never silently drop an additive schema change.

## What is NOT verified yet

- No live Supabase project exists for this scaffold, so the
  migration has not been applied anywhere and RLS policies have
  not been tested live.
- No Cloudflare Pages project exists yet.
- No GitHub repo exists yet (deliberately — this scaffold is local
  only until Mustapha asks for a repo).
