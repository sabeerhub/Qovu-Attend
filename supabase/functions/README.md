# Supabase Edge Functions — planned, not implemented

Phase 1 has no Edge Functions. The functions below are planned for
Phase 2/3 (see `docs/API_CONTRACTS.md`) and will be added one at a
time, each with its own folder and tests:

- `attendance-submit` — server-side attendance submission: validate
  session state + QR expiry, enforce uniqueness + rate limit, derive
  status (never trust the client), write the record + audit row.
- `session-transition` — lifecycle transitions with authorization +
  audit logging.
- `export-report` — PDF / CSV export scoped to the lecturer's
  authorized records.

Do not call an Edge Function endpoint that does not exist yet.
