-- UniAttend — v0.5.0 migration: smart verification (Phase 4 slice 1)
--
-- Lecturer-anchored location, mandatory student location, and device
-- binding (product-owner decisions 2026-11-16). No facial liveness
-- in this slice (spec: only after a privacy/feasibility review).
--
-- 1. Lecturer anchor on attendance_sessions: when a session is
--    activated, the lecturer's device location is captured in the
--    browser and stored here. It is the centre of the allowed area;
--    student submissions are checked against it server-side.
--    location_radius_meters defaults to 30 (the owner's rule: the
--    student and the lecturer are in the same location, and the
--    distance is not above 30 metres).
-- 2. Device binding on attendance_records: the SHA-256 hash of the
--    submitting device's fingerprint (hash only — never raw device
--    attributes). One device may submit once per session (partial
--    unique index; manual records have a NULL fingerprint and are
--    unaffected).
-- 3. device_registrations: first submission binds a device hash to
--    one registration number, across all sessions. A device that
--    tries to submit for a different registration number is
--    rejected server-side. The binding is per device, not per
--    student: a new phone binds on first use; a shared phone stays
--    bound to the first student who used it (a lecturer can still
--    add the other student manually, audit-logged).
--
-- Honest limits (see docs/SECURITY_MODEL.md): these are mitigations,
-- not guarantees. GPS can be spoofed with mock-location apps, and
-- indoor GPS drifts; a fingerprint is a hashed deterrent, not a
-- proof of identity.

alter table public.attendance_sessions
  add column if not exists anchor_latitude double precision,
  add column if not exists anchor_longitude double precision,
  add column if not exists anchor_accuracy_meters double precision,
  add column if not exists anchor_captured_at timestamptz,
  add column if not exists location_radius_meters integer not null default 30
    check (location_radius_meters > 0);

alter table public.attendance_records
  add column if not exists device_fingerprint_hash text;

-- One device, one submission per session (manual records excluded:
-- their fingerprint is NULL).
create unique index if not exists attendance_records_session_device_unique
  on public.attendance_records (session_id, device_fingerprint_hash)
  where device_fingerprint_hash is not null;

create table if not exists public.device_registrations (
  device_fingerprint_hash text primary key,
  registration_number text not null,
  first_seen_at timestamptz not null default now()
);
create index if not exists device_registrations_registration_number_idx
  on public.device_registrations (registration_number);

-- RLS on, no policies: only the Edge Functions (service role) read
-- and write this table. The frontend never touches it.
alter table public.device_registrations enable row level security;
