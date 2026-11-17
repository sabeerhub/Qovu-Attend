-- UniAttend — v0.10.0 migration: face (live selfie) check
--
-- At submission a student may take a live selfie. The photo is
-- stored in a PRIVATE Storage bucket and the record keeps only an
-- 8x8 average perceptual hash of it (16 hex chars). If the same
-- hash is submitted for two different registration numbers in one
-- session, both records are flagged for lecturer review
-- (face_review) — never auto-rejected, never a refusal.
--
-- What this check IS and IS NOT (owner-agreed, documented in
-- docs/ATTENDANCE_RULES.md and docs/SECURITY_MODEL.md):
--   IS: a deterrent that catches one face submitting for two
--       numbers in the same class.
--   IS NOT: face recognition, and NOT identity proof. There are no
--       student photos on file, so the check can never prove the
--       face belongs to the registration number. A similar-looking
--       photo (twins, family, a bad hash collision) can flag an
--       honest student — which is exactly why a flag is review-only.
--
-- Photos live under sessions/<session_id>/<record_id>.jpg and are
-- DELETED when the session is Finalized (see the
-- session-transition function). The camera is never required to
-- submit: a student who skips the photo, or has no front camera,
-- submits exactly as before, and the lecturer can add them by hand.
--
-- Storage access: only the Edge Functions (service role) write or
-- delete photos. Authenticated lecturers may READ a photo only
-- when they are assigned to the session's course — enforced by the
-- storage.objects policy below, so the client can only fetch a
-- short-lived signed URL for its own sessions. There is no public
-- access and no anon upload.
--
-- UNVERIFIED: this migration has NOT been applied to a live
-- Supabase project yet. Apply in the SQL Editor, then confirm the
-- columns and the session-selfies bucket exist before relying on
-- the face check or the review UI.

-- ------------------------------------------------------------ columns
alter table public.attendance_records
  add column if not exists selfie_path text,
  add column if not exists selfie_hash text,
  add column if not exists face_review boolean;

-- Same-face lookup is always within one session, so the lookup is
-- (session_id, selfie_hash). Manual records have a NULL hash and
-- are unaffected.
create index if not exists attendance_records_session_selfie_hash_idx
  on public.attendance_records (session_id, selfie_hash)
  where selfie_hash is not null;

-- ------------------------------------------------------------ bucket
-- Private bucket: public = false. No public URLs are ever built
-- for these photos; lecturers fetch short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('session-selfies', 'session-selfies', false)
on conflict (id) do nothing;

-- A lecturer reads a photo only for a session of a course they are
-- assigned to (course-level assignment, or department-level with a
-- null course_id) — the same ownership rule as courses. The session
-- id is the second path segment: sessions/<session_id>/<file>.jpg.
-- Comparing as text (s.id::text) avoids a cast error on any stray
-- path that is not a UUID.
create policy "session_selfies_lecturer_read"
  on storage.objects for select
  using (
    bucket_id = 'session-selfies'
    and storage.objects.name like 'sessions/%/%'
    and exists (
      select 1
      from public.attendance_sessions s
      join public.courses c on c.id = s.course_id
      join public.lecturer_assignments a
        on a.department_id = c.department_id
        and (a.course_id is null or a.course_id = c.id)
      where s.id::text = split_part(storage.objects.name, '/', 2)
        and a.lecturer_id = public.current_lecturer_id()
    )
  );

-- No insert / update / delete policy for authenticated users: only
-- the Edge Functions (service role, which bypasses RLS) write or
-- delete photos. An authenticated client that tries to upload
-- directly is refused.
