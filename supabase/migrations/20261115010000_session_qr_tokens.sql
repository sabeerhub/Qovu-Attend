-- UniAttend — Phase 2 migration: QR tokens, passcode + idempotency
--
-- Adds the columns Phase 2 attendance operations need. Does NOT
-- touch the Phase 1 migration (20261115000000_init.sql).
--
-- Security: only SHA-256 hashes of the QR token and the classroom
-- passcode are stored — never the token or passcode themselves.
-- The token/passcode are returned once to the lecturer at activation
-- (see supabase/functions/session-transition) and cannot be recovered
-- from the database afterwards. Expiry is validated server-side from
-- qr_token_issued_at + qr_expires_in_seconds; the client never
-- decides whether a token is still valid.
--
-- Idempotency: attendance_records.idempotency_key lets the
-- attendance-submit Edge Function return the original record when a
-- student retries a submission, instead of creating a second row.
-- The unique constraint on (session_id, registration_number) remains
-- the backstop against duplicates.
--
-- UNVERIFIED: this migration has NOT been applied to a live Supabase
-- project yet. Apply to staging first and confirm the columns exist
-- before relying on the Phase 2 Edge Functions.

alter table public.attendance_sessions
  add column if not exists qr_token_hash text,
  add column if not exists qr_token_issued_at timestamptz,
  add column if not exists passcode_hash text;

alter table public.attendance_records
  add column if not exists idempotency_key text;

-- One idempotency key per session: a retry with the same key maps to
-- the same submission. Partial index so NULL keys (records created
-- before Phase 2, manual entries without a key) are unaffected.
create unique index if not exists attendance_records_session_idempotency_key_idx
  on public.attendance_records (session_id, idempotency_key)
  where idempotency_key is not null;

-- Look up a session's live token hash by session id when validating
-- a submission (Edge Function only; no client policy is added).
create index if not exists attendance_sessions_qr_token_issued_at_idx
  on public.attendance_sessions (qr_token_issued_at);
