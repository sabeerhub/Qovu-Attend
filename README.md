# UniAttend — Lecturer Portal

University Attendance Management System. Lecturer Portal, Phase 1
foundation scaffold.

A lecturer teaches multiple courses across multiple departments.
Every attendance record belongs to a specific lecturer, department,
course, academic session, semester, week and lecture session.
A semester has 15 teaching weeks.

## Stack

React + Vite, TypeScript (strict), Tailwind CSS + shadcn/ui,
Supabase (PostgreSQL, Auth, Edge Functions), Cloudflare Pages.
Free tier only.

## Status — Phase 1 scaffold (v0.1.0, 2026-11-15)

Done:

- Full directory tree, docs (9 docs + the Lecturer Dashboard spec),
  12-table migration with constraints + RLS sketch, example-only seed.
- App shell with all 7 navigation sections, Apple-minimalist design
  system (see `docs/DESIGN_SYSTEM.md`).
- Real Supabase Auth sign-in, real overview statistics from the
  database (never hardcoded), department/course lists via RLS,
  Draft session creation with week 1–15 validation.
- Unit tests for week validation, session lifecycle and CSV escaping.

Not done / not verified:

- **No live Supabase project yet.** The migration has not been
  applied anywhere and the RLS policies have not been tested live.
  The app shows a "not configured" empty state until
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set.
- **No GitHub repo yet.** This scaffold is local only. The repo is
  to be created by Mustapha (public, name `UniAttend`, under
  `sabeerhub`) — the GitHub App token could not create it (403).
- Phase 2 (QR, monitoring, manual attendance), Phase 3 (history,
  PDF/CSV exports) and Phase 4 (GPS/passcode, risk) are not built.

## Quick start

```bash
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npm run dev            # dev server
npm test               # unit tests (no credentials needed)
npm run build          # tsc (strict) + vite build
```

## Docs

- `docs/LECTURER_DASHBOARD_SPEC.md` — the full product spec v1.0
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/SECURITY_MODEL.md`
- `docs/ATTENDANCE_RULES.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/API_CONTRACTS.md`
- `docs/TESTING_STRATEGY.md`
- `docs/DEPLOYMENT_GUIDE.md`

## Working rules

See `AGENTS.md` (the Engineering Constitution). In short: inspect,
plan, explain before changing, build only approved scope, run tests
and report actual results, never claim a test passed unless it ran,
never proceed to another phase without approval.
