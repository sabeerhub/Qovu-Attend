-- UniAttend — v0.4.1 migration: lecture start time on sessions
--
-- SPEC CHANGE (2026-11-16, product owner decision): the lecturer
-- assigns the lecture date AND start time himself when creating a
-- session. The semester date range no longer blocks or rejects a
-- session, and the chosen week need not match the week the date
-- falls in (see the v0.4.1 CHANGELOG entry). This migration only
-- adds the start_time column; no date/week rule is enforced in the
-- database, and no semester dates are changed here.
--
-- Nullable so existing sessions are unaffected; the form requires
-- a start time for every new session.

alter table public.attendance_sessions
  add column if not exists start_time time;
