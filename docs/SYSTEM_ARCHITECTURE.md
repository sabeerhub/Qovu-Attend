# System Architecture — UniAttend

## Stack (per spec §14)

- React + Vite, TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Supabase PostgreSQL, Supabase Auth, Supabase Edge Functions
- Cloudflare Pages (hosting)
- `qrcode` (QR generation), `html5-qrcode` (scanning) — Phase 2
- Browser Geolocation API — Phase 4
- Browser print styles + a PDF-generation library — Phase 3
- CSV export, client-side or server-side — Phase 3
- Free tier only, within published quotas.

## High-level shape

```
Lecturer browser (React SPA, Cloudflare Pages)
        │  HTTPS, anon key only
        ▼
Supabase Auth ──► Supabase PostgreSQL (RLS on)
        │                ▲
        │                │  service-role / Edge Functions only
        └────► Edge Functions (server-side validation,
               QR tokens, expiry, rate limiting, exports)
```

The frontend never holds a service-role key and never decides
authorization on its own. It renders data the backend has already
authorized.

## Feature-based layout

```
src/
  app/            App shell, routing, layout
  components/     Shared UI (ui/ = shadcn-style primitives, layout/ = shell)
  features/       One folder per domain, each with its own components
                  and hooks; business logic lives in lib/, not in JSX
    authentication/
    departments/
    courses/
    attendance/
    history/
    reports/
  hooks/          Shared data hooks (e.g. overview stats)
  lib/            Supabase client, validation, CSV helpers
  styles/         Tailwind entry + design tokens
  types/          Strict TypeScript types for all 12 tables
```

Rules from the constitution:

- Business logic out of presentation components.
- Server-side validation for all sensitive operations.
- Never trust client-submitted attendance status.
- Database constraints for data integrity.
- Tests for security-critical behaviour.

## Data flow (Phase 1)

1. Lecturer signs in with Supabase Auth (email/password).
2. App loads `lecturer_profiles` + `lecturer_assignments` for that user.
3. Overview queries counts from `attendance_sessions` /
   `attendance_records`, scoped by assignment — never hardcoded.
4. Session creation (Draft) inserts into `attendance_sessions` with the
   lecturer id taken from the authenticated session, not from the form.

## Data flow (later phases, for context only)

- Phase 2: Edge Function issues a short-lived QR token, validates
  expiry server-side, enforces uniqueness and rate limits on
  submissions, and records manual attendance with a reason + audit row.
- Phase 3: history reads and PDF/CSV exports run server-side (or
  through an Edge Function) so permission checks cannot be bypassed
  in the browser.
- Phase 4: GPS/passcode verification, risk indicators; facial liveness
  only after a privacy and feasibility review.

## Trade-offs recorded

- **Supabase over a custom backend:** faster to ship on the free tier,
  RLS + Auth are built in. Cost: vendor-specific SQL/RLS; migration
  away later would need a rewrite of the policy layer.
- **Database-first design:** the 12-table schema (including the audit
  log and the unique reg-no-per-session constraint) is created in
  Phase 1, before the Phase 2/3 features that depend on it. This is
  deliberate — finalized history and audit are foundational, not
  add-ons. Cost: a larger initial migration.
- **No timetable integration in Phase 1:** upcoming lectures on the
  Overview are shown only if timetable integration is enabled; in
  Phase 1 that section renders an empty state.
- **No custom server:** Edge Functions are the only server-side code.
  Anything that must not be spoofable (attendance status, expiry,
  assignment checks) must live there or in RLS, never in the client.
