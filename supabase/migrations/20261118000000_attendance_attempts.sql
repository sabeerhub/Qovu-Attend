-- Qovu — v0.16.0 migration: refused-tries log (attendance_attempts)
--
-- The gap (owner-reported 2026-11-17, verified in code): when a
-- student submission is refused — second submission, device already
-- used, device registered to another number, outside the hall,
-- location too imprecise, number not on the class list, no selfie —
-- the block worked, but nothing was ever written anywhere. There
-- was no attempts table, and the session monitor only reads
-- attendance_records, so the lecturer saw nothing. Detection
-- without a trace.
--
-- This table is the trace. Every logged refusal (see
-- supabase/functions/attendance-submit/attemptLog.ts for the exact
-- list) writes one row: which session, which registration number,
-- why, and when. The student sees exactly the same refusal message
-- as before — nothing about the log ever leaks to the student.
--
-- What is NOT logged, on purpose:
--   - Wrong-passcode guesses from the `validate` action: there is
--     no registration number there, and they are rate-limited
--     probes — logging them would flood the table.
--   - Malformed selfie input (`invalid_request`): a photo without
--     its hash, a non-JPEG, an oversized photo. Only a submission
--     with NO selfie at all (`selfie_required`) is logged.
--   - Session/token problems (`session_not_active`,
--     `invalid_token`, `token_expired`, `location_not_configured`),
--     rate limits and missing-field requests: these are not a
--     student's try at attendance in a session, so they leave no
--     row here.
--
-- A refused try is NEVER attendance: attempts are never counted in
-- any summary, never change a headcount difference, and never
-- affect eligibility. They are a record of what happened, not
-- proof of cheating — the lecturer decides what a try means.
--
-- Permanent, like records and audit logs: no delete, no expiry.
-- Only the Edge Function (service role) writes; lecturers read
-- only attempts for their own sessions (same session-lecturer
-- rule as attendance_records). No device data is stored here at
-- all — not even a hash.

create table public.attendance_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  registration_number text not null,
  reason text not null check (reason in (
    'already_submitted',
    'device_already_used',
    'device_registered_to_other',
    'outside_hall',
    'location_imprecise',
    'not_on_class_list',
    'selfie_missing'
  )),
  attempted_at timestamptz not null default now()
);

create index attendance_attempts_session_id_idx on public.attendance_attempts (session_id);

alter table public.attendance_attempts enable row level security;

-- Refused tries: readable only for the lecturer's own sessions.
-- No direct client insert/update/delete — only the Edge Function
-- (service role) writes, so no insert/update policy is granted.
create policy "attendance_attempts_own_session_read"
  on public.attendance_attempts for select
  using (
    exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_attempts.session_id
        and s.lecturer_id = public.current_lecturer_id()
    )
  );
