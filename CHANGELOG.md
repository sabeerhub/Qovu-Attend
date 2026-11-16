# Changelog — UniAttend

## v0.7.0 — 2026-11-17 — Landing page, logo splash, lecturer sign-up, dashboard skeletons, desktop polish

- **Logo splash on load (Phase A).** Opening any Qovu link first plays
  a short premium intro: full-screen canvas white, the Q mark draws
  itself in (ring, then tail, then the accent-blue dot), the "Qovu"
  wordmark fades in, and the screen fades into the page — 1.3 s
  total. The idea only is borrowed from sites like Stake (logo
  animation first, then the page); the look stays light and
  Apple-minimal, never their dark casino style. `prefers-reduced-motion`
  skips it entirely, and the CSS end-state is `visibility: hidden`,
  so the splash can never trap the page even if its timer fails.
  New: `src/components/brand/LogoSplash.tsx`, `src/lib/splash.ts`,
  keyframes in `src/styles/globals.css`, wired in `src/App.tsx`.
- **Public landing page (Phase B).** Logged-out visitors at `/` now see
  a landing page instead of the bare sign-in box: hero with the Qovu
  mark and "Attendance, verified." tagline, plain words on what Qovu
  does, "How it works" in three short steps (lecturer starts a
  session, students mark themselves present, Qovu checks they are
  really there), a minimal three-item features section (30 m location
  check, one device per student, headcount cross-check), "Create
  account" and "Sign in" buttons, and a minimal footer. Logged-in
  lecturers skip it and go straight to the dashboard. Routing is a
  tiny path router (`src/lib/authRoutes.ts`: `/` landing,
  `/signin`, `/signup`, back button works); `/submit` and
  `?submit=...` are decided first by the existing `getSubmitRoute`
  and work exactly as before. New: `src/features/landing/LandingPage.tsx`.
- **Lecturer sign-up (Phase C).** New sign-up page at `/signup`: full
  name, email, password, confirm password, with plain inline client
  validation (valid email, password at least 8 characters with a
  letter and a number, passwords match — `src/lib/signupValidation.ts`).
  On submit: Supabase Auth `signUp` with the name as user metadata,
  then the lecturer profile row is created for the new user
  (`src/features/authentication/lecturerProfile.ts`). No migration was
  needed: the existing `lecturer_profiles_own` RLS policy (migration
  20261115000000) is `FOR ALL` with `user_id = auth.uid()`, so an
  authenticated user may already insert exactly their own row — never
  anyone else's, no service-role key. Email confirmation is currently
  OFF, so sign-up normally returns a session at once and the lecturer
  lands on the dashboard; if confirmation is ever switched back on,
  the form says to check email, and the profile row is created on the
  first sign-in instead (SignInForm now calls the same helper, best
  effort, never blocking sign-in). Sign-in and sign-up link to each
  other. Open registration for now — invite-only is possible later.
- **Skeleton loading on the dashboard (Phase D).** Overview, Courses
  and Sessions list views now show skeleton placeholders (grey blocks
  in the shape of the real content, calm opacity pulse) instead of
  spinners or blank space. New: `src/components/ui/skeleton.tsx`
  (`OverviewSkeleton`, `CourseListSkeleton`, `SessionListSkeleton`,
  `SessionWorkspaceSkeleton`); the four loading branches in
  `Overview.tsx`, `CourseList.tsx`, `SessionWorkspace.tsx` and
  `SessionList.tsx` render them. No gradients — the pulse is opacity
  only, per the design system. The auth-loading spinner in AppShell
  is untouched.
- **Desktop polish (Phase E).** Desktop layout only, mobile tab bar
  unchanged: the dashboard header is now sticky with a little more
  breathing room, main content has more top/bottom air on desktop
  (`md:py-8`), sidebar brand spacing and nav rhythm loosened
  slightly. No layout rebuild, no new colours, no gradients.
- **Tests.** 229/229 green (was 211/211): splash timing (2),
  auth routing (3), sign-up validation + profile-row builder (8),
  skeleton presence via server render (5). Build green.
- **Not verified live.** The sign-up flow (including the
  email-confirmation-off behaviour) was verified only by unit tests
  and the build — no live Supabase sign-up was performed in this
  slice. The 1280px/1440px desktop polish was checked by CSS review
  only, not by a visual screenshot.

## v0.6.0 — 2026-11-17 — The product is now Qovu: hand-built logo, favicon, in-app brand

- **New name: Qovu (product-owner decision 2026-11-17).** The attendance
  product's global name is Qovu — 4 letters, invented, checked free of
  any company using it (the only hit is a Fijian surname). The repo
  (`sabeerhub/UniAttend`), the Vercel project (`uniattend-x`) and the
  Supabase project are NOT renamed — those are owner actions. The live
  URL is unchanged.
- **Logo, hand-built, not AI slop.** The mark is a plain Q drawn by hand
  in SVG: one circle, one short tail, and a single accent-blue dot at
  its centre — present, here, checked in. Ink `#111111`, one accent
  `#0071e3` used exactly once (the dot), no gradients, no shadows, no
  clip-art, no generic checkmark-in-a-circle. The ring and tail stay
  readable at 16 px favicon size. The wordmark is just "Qovu" in the
  system font, ink, next to the mark.
- **Files.** `public/favicon.svg` (mark only; the ink strokes switch to
  white under `prefers-color-scheme: dark`), `public/logo.svg` (mark +
  "Qovu" horizontal lockup), `public/apple-touch-icon.png` (180×180,
  rendered from the same mark geometry — no converter was available on
  the build machine, so it was rasterised with a small stdlib-only
  Python script and its pixels verified: white corners, accent-blue
  centre dot, ink ring and tail). `index.html` links the favicon and
  the touch icon and titles the page "Qovu — Attendance, verified".
- **In-app brand.** New shared `src/components/brand/QovuBrand.tsx`
  (mark from `/favicon.svg` — one source of truth for the geometry —
  plus the "Qovu" wordmark) replaces the "UniAttend" text brand in the
  lecturer sign-in / not-configured screens (`AppShell.tsx`), the
  desktop sidebar (`Sidebar.tsx`), and the student submission pages
  (`SubmitAttendance.tsx`, `SubmitEntry.tsx`); the location-permission
  copy now says Qovu. Layout, spacing and colours are unchanged.
- **Deliberately untouched.** Docs and the spec still say UniAttend
  (no doc rewrites in this slice); the canvas text in
  `src/lib/deviceFingerprint.ts` still reads "UniAttend device check"
  — it feeds the device hash, so changing it would change every
  device's fingerprint; the package/repo names are unchanged.
- Client: `public/favicon.svg`, `public/logo.svg`,
  `public/apple-touch-icon.png`, `src/components/brand/QovuBrand.tsx`
  (new), `index.html`, `src/app/AppShell.tsx`,
  `src/components/layout/Sidebar.tsx`,
  `src/features/submission/SubmitAttendance.tsx`,
  `src/features/submission/SubmitEntry.tsx`,
  `src/components/ui/location-permission.tsx`. No migration, no Edge
  Function change.

## v0.5.5 — 2026-11-16 — The /submit page now checks the code straight away

- **Code checked the moment the student taps Continue (v0.5.5, product-owner
  correction of a real v0.5.4 mistake).** In v0.5.4 the entry page only
  checked the code's *format* (six digits) and did not verify whether it
  was the right code until the final submission — a wrong code sailed
  through to the registration-number form and only failed at the end.
  Now the page asks the server first and shows a "Checking code…"
  state: a right code continues to the attendance form; a wrong code
  stays on the code screen with "That code is not right. Check the code
  your lecturer is showing and try again." The QR-link flow
  (`?submit=<sessionId>&token=<token>`) is untouched.
- **Validate-only action (server, `attendance-submit`).** `POST
  { action: 'validate', passcode }` resolves the passcode exactly as a
  submission does — exactly one ACTIVE session, same token-expiry window,
  and a lecturer anchor present (a session with no anchor refuses
  submissions, so its code must not validate as "correct") — and answers
  valid/invalid only: never a session id, a course name, or any detail,
  and never how many sessions matched. The full submission still
  re-verifies everything (session, expiry, location, device, duplicate)
  at submit time; validation is not authorization.
- **Brute-force guard.** A validate call is an oracle for a 6-digit
  code, so it is rate-limited strictly and separately from submissions:
  60 attempts per client IP per minute, plus a 2000-per-minute global
  cap. The per-IP number is set above a single student's honest use
  on purpose: a whole lecture hall on shared campus WiFi shares one
  public IP, so 30/min could block honest students who mistype. It
  stays safe because a code lives only 5 minutes — at most ~300
  guesses per code lifetime per IP out of 900,000 possible codes —
  and the global cap stays as flood protection. Over the limit
  answers 429 `rate_limited`. Like the submission limiter it is
  in-memory per function instance (best-effort, resets when the
  instance is recycled); a managed limiter in front of the function
  remains the production-grade answer.
- Client: `src/features/submission/SubmitEntry.tsx` (checks the code on
  Continue), `src/lib/edgeFunctions.ts` (`validatePasscode`),
  `src/lib/submission.ts` (`mapPasscodeValidation` — the pure
  advance/stay decision, tested); server:
  `supabase/functions/attendance-submit/index.ts` (`validate` branch),
  `supabase/functions/attendance-submit/resolveSession.ts`
  (`validatePasscodeEntry`, `isTokenWindowLive`),
  `supabase/functions/attendance-submit/validateRateLimit.ts` (new).
  No migration; the 30 m radius, the token-expiry rules and all
  location/device rules are unchanged.

## v0.5.4 — 2026-11-16 — Students without a camera can submit at /submit with the 6-digit code

- **Passcode entry page (v0.5.4, product-owner request: a student who cannot
  scan the QR code should be able to go to `/submit`, type the code, and
  submit attendance).** Opening `/submit` with no session in the URL now
  shows a simple page — "Enter the code your lecturer is showing" — with a
  6-digit passcode field and a Continue button. After the code, the existing
  attendance form appears (registration number, then the same location +
  device checks as the QR path). The QR-link flow
  (`?submit=<sessionId>&token=<token>`) is untouched.
- **Passcode-only session resolution (server, `attendance-submit`).** The
  function already verified a passcode, but only after the session was
  identified by `sessionId` from the URL — a student with only the code
  could not reach a session. Now `sessionId` may be omitted when a passcode
  is supplied: the server finds the session by SHA-256(passcode) among
  ACTIVE sessions. Exactly one match proceeds with every existing check
  unchanged (expiry, location anchor/radius/accuracy, device binding,
  duplicate, headcount flag, rate limit). Zero matches or more than one
  match is rejected as `invalid_token` — the caller is never told how many
  matched — and a passcode is never accepted for a Draft, Closed,
  Finalized or Archived session. The client sends no `sessionId` in this
  flow and uses an attempt-scoped idempotency key (the stable
  per-(session, student) key needs a session id); a retry is still
  deduplicated server-side by the unique constraint on
  (session_id, registration_number).
- **Honest notes.** The code is checked for format on the entry page and
  verified server-side at submission — there is no separate "does this
  code exist" check before the form, because no such endpoint exists and
  none was added. *(Superseded in v0.5.5: the validate action now exists
  and the entry page checks the code on Continue.)* The entry page
  therefore reports a wrong code the same way the existing passcode path
  does. There is no index on
  `passcode_hash`, so the lookup scans `attendance_sessions` (one row per
  lecture session — small); no migration was added for this slice.
- Client: `src/features/submission/SubmitEntry.tsx` (new),
  `src/features/submission/SubmitAttendance.tsx` (optional `passcode` prop,
  session-optional submit), `src/app/AppShell.tsx` (routes via
  `getSubmitRoute`), `src/lib/edgeFunctions.ts` (`getSubmitRoute`,
  optional `sessionId` in `SubmitAttendanceInput`), `src/lib/qr.ts`
  (`isValidPasscode`); server: `supabase/functions/attendance-submit/index.ts`
  (passcode-only resolution) + `resolveSession.ts` (new, dependency-free
  resolver); tests: `tests/unit/submit-route.test.ts` (new),
  `tests/unit/passcode-resolution.test.ts` (new), `tests/unit/qr.test.ts`,
  `tests/integration/edge-functions.test.ts`.

## v0.5.3 — 2026-11-16 — Old submission links no longer show "This page doesn't exist"

- **SPA rewrite added (v0.5.3, product-owner report: an old submission link
  `https://uniattend-x.vercel.app/submit?submit=<sessionId>&token=<token>`
  returned Vercel 404 NOT_FOUND).** v0.5.2 fixed new links to use the app root,
  but QR codes and links already out in the world still point at `/submit` —
  and with no SPA rewrite, the host had no file at that path, so it answered
  404. The new `vercel.json` at the project root rewrites every path to
  `index.html`, so old `/submit?...` links now open the app and AppShell reads
  the session and token from the query string, exactly as it does on the root
  path. The app has no Vercel server-side routes of its own (the backend is
  Supabase Edge Functions), and real static files such as JS/CSS assets are
  still served directly, so the main page and assets are unaffected. Note: a
  token on an old link may still be expired, and a session created before
  v0.5.0 may still lack a location anchor — a fresh session is still the
  recommended test path.
- Config: `vercel.json` (new, SPA fallback rewrite).

## v0.5.2 — 2026-11-16 — QR codes now open the attendance page when scanned

- **QR code content fixed (v0.5.2, product-owner report: scanning the QR showed
  raw text instead of opening attendance).** The QR used to encode a JSON
  payload (`{"v":1,"sessionId":...,"token":...}`), and a phone camera only
  opens a QR code when it contains a URL — so phones displayed the raw data
  text instead of the attendance page. The QR now encodes the public
  submission URL itself (`https://uniattend-x.vercel.app/?submit=<sessionId>&token=<token>`).
  The URL is at the app root on purpose: this repo has no SPA rewrite, so a
  `/submit` path would 404 on the host, while `/` always serves the app and
  AppShell already reads the query string there. The QR image and the
  displayed "Submission link" text are now built from the same single URL, so
  the two can never disagree again. The old JSON payload parser
  (`parseQrPayload`) is removed as dead code — nothing used it except its own
  tests. Token, passcode, expiry, location and device rules are untouched.
- Client: `src/lib/qr.ts` (`buildQrPayload` now takes the origin and returns
  the submission URL; `buildSubmitUrl` builds the root-path URL),
  `src/features/attendance/QrDisplay.tsx` (one URL built once, used for the
  QR and the link text); tests: `tests/unit/qr.test.ts` (QR content is a URL
  on the given origin, token round-trips, URL-unsafe token characters
  survive); docs: `docs/API_CONTRACTS.md` (QR payload is a submission URL,
  not JSON).

## v0.5.1 — 2026-11-16 — Location capture that works indoors: longer fix + explicit permission step

- **Location capture fixed (v0.5.1, product-owner report: activation failed with the
  location-required error even with location services on).** The old capture was one
  high-accuracy attempt with a 10 s timeout — a GPS fix indoors routinely takes longer
  than 10 s or fails, so activation was refused even when location was on. Capture is
  now two-stage: high accuracy for 30 s, then, only on a timeout or an unavailable
  position, a network-based fix for 15 s (cached fixes up to 30 s old accepted). A
  denied permission still fails fast with no retry. The 30 m radius and the 100 m
  accuracy cap are unchanged, and the mandatory-location rules are unchanged: no
  location, no activation and no submission.
- **Explicit permission step.** Before capturing, the app checks the permission state
  with `navigator.permissions` where the browser has it. If location is denied for
  this site, the app does not call `getCurrentPosition` again — a denied permission
  never re-prompts — and instead shows a blocked panel with plain re-allow steps for
  Chrome (address-bar tune/lock icon → Site settings → Location → Allow) and Safari
  (aA icon → Website Settings → Location → Allow), plus a "Try again" button that
  re-checks the permission. If the state is 'prompt' or 'granted', an "Allow location
  to continue" button triggers the capture from an explicit tap so the browser shows
  its prompt reliably. Without a Permissions API the app goes straight to the capture.
  A website cannot force the browser to re-show the prompt after a denial and cannot
  switch on OS location services — the in-app panel + instructions is the correct
  mechanism.
- **Visible locating state.** Activation (monitor and session list) and student
  submission now show "Finding your location…" while the capture runs, instead of
  silence followed by an error.
- Client: `src/lib/geo.ts` (two-stage `requestDeviceLocation`, `queryLocationPermission`,
  `nextLocationStep`); new `src/components/ui/location-permission.tsx`
  (`LocationBlockedPanel`, `LocationAllowPanel`); `SessionMonitor` / `SessionList` /
  `SubmitAttendance` route location through the permission gate. No Edge Function
  changes, no migration, no schema change.
- Tests: `tests/unit/geo.test.ts` — stage-1 success, timeout/unavailable falling back
  to the network fix, denial failing fast with no retry, both stages failing, and
  permission-state branching (denied → blocked, prompt/granted → ask, no Permissions
  API → straight to capture).

## v0.5.0 — 2026-11-16 — Smart verification: lecturer-anchored location, device binding, headcount confirm

- **Lecturer-anchored location (Phase 4 slice 1, product-owner decisions 2026-11-16).**
  When a session is activated, the lecturer's device location is captured in the browser and
  stored on the session as the anchor. Every student submission must carry the student's
  device coordinates — a submission without a location is refused, with no fallback — and
  the `attendance-submit` Edge Function checks server-side (Haversine) that the student is
  within the session's radius of the anchor. **Radius is 30 metres** (owner's rule: if the
  student and the lecturer are in the same location and the distance is not above 30 m the
  student is eligible; above 30 m the submission is rejected). A reported accuracy worse
  than 100 m is refused as too imprecise. The check applies identically to the QR-token
  path and the passcode path; client-side distance math is display-only. Sessions activated
  before v0.5.0 have no anchor and refuse submissions until closed and reopened. An
  activation without a usable lecturer location is refused (`anchor_required`) — no silent
  fallback. The monitor shows the anchor state after activation (captured time, accuracy,
  radius).
- **Device binding (Phase 4 slice 1).** The submission page computes a device fingerprint
  (screen, user agent, timezone, hardware, canvas — hashed with SHA-256; only the hash
  ever leaves the phone) and sends it with every submission. Server-side, the first
  submission binds a device to one registration number (`device_registrations`, unique on
  the hash); a later submission from the same device for a different number is refused
  (`device_bound_to_another_student`), and one device may submit once per session (partial
  unique index on `(session_id, device_fingerprint_hash)`). A per-browser localStorage flag
  is a UX hint only — the server enforces. Manual attendance stays lecturer-attested, with
  no location/device checks, audit-logged as before.
- **Headcount confirmed at activation.** The headcount was only an expected number entered
  at session creation; the lecturer counts real bodies in the hall just before projecting
  the QR. The monitor now shows a "Physical headcount — confirm now" field when starting
  (or reopening) a session, prefilled with the stored count, saved to the session with the
  activation call. When verified + manual submissions exceed the confirmed headcount the
  monitor shows a review flag ("Submissions exceed the physical headcount — review") —
  display only, never automatic fraud, per the spec rule.
- **Projector QR.** `QrDisplay` gains a fullscreen projector view (large high-contrast QR
  + big passcode, minimal chrome, Esc to close) so the code reads from the back of the hall.
  The QR is now rendered at 560 px for a crisp projection.
- **Submission rate limit raised (Phase 4 addition).** `attendance-submit` went from 60 to
  **300 submissions per session per minute**: a full Nigerian lecture hall scanning at once
  must not hit the limiter. Still the same in-memory best-effort guard, not a distributed
  limiter.
- **Honest limits, stated in `docs/SECURITY_MODEL.md`:** GPS can be spoofed with
  mock-location apps, indoor GPS drifts 10–20 m, and a fingerprint is a hashed deterrent,
  not a proof of identity. Location + device checks verify the phone, not the person;
  they are mitigations, not guarantees. No facial liveness in this slice (spec: only after
  a privacy/feasibility review). No student registration or accounts were added.
- New migration `supabase/migrations/20261116020000_smart_verification.sql` (existing
  migrations untouched): anchor columns + `location_radius_meters` (default 30) on
  `attendance_sessions`; `device_fingerprint_hash` on `attendance_records` + partial unique
  index; new `device_registrations` table (RLS on, no policies — service role only).
- Client: new pure `src/lib/geo.ts` (Haversine, radius/accuracy rules, Geolocation wrapper)
  and `src/lib/deviceFingerprint.ts` (stable fingerprint + SHA-256, injectable for tests,
  localStorage flag helpers); `src/lib/edgeFunctions.ts` payloads carry the anchor,
  headcount, coordinates and fingerprint; `SessionMonitor` / `SessionList` capture the
  lecturer location before activation; `SubmitAttendance` blocks without location or
  fingerprint and maps the new server error codes to plain language.
- Tests: `tests/unit/geo.test.ts` (Haversine known distances, radius/accuracy rules),
  `tests/unit/deviceFingerprint.test.ts` (hash stability, known SHA-256 vector,
  no-window-at-import), `tests/unit/submission.test.ts` (headcount-confirm parsing),
  `tests/integration/edge-functions.test.ts` (anchor + headcount sent on activation,
  location + fingerprint sent on submission).

## v0.4.1 — 2026-11-16 — Lecturer sets lecture date, start time and week freely

- **Session creation unblocked (spec change, product-owner decision 2026-11-16).**
  The lecturer now assigns the lecture date AND start time himself,
  and the semester date range no longer blocks or rejects a session.
  This overrides spec §6 (week validated against the academic
  calendar): a lecture date outside the semester dates is allowed,
  and the chosen week (1–15) need not match the week the date falls
  in. The live semester dates were stale example data (First
  Semester 2025-09-01 → 2026-01-31), so every date was being
  rejected; the fix is the rule change, not new semester dates.
- New migration `supabase/migrations/20261116010000_session_start_time.sql`
  (existing migrations untouched): `attendance_sessions.start_time`
  (`time`, nullable so existing sessions are unaffected).
- Client: the session form gains a required "Lecture start time"
  (`type="time"`, 24-hour HH:MM, validated in `src/lib/sessionForm.ts`)
  next to the lecture date, and sends `start_time` in the insert
  payload. When the picked date falls inside the semester, the
  derived week is suggested in the week select (still
  lecturer-editable); when it falls outside, there is no suggestion
  and the chosen week stands. The semester date-range line under the
  selected course is removed (only academic session + semester name
  remain). `validateLectureDate` stays in `src/lib/calendar.ts` as a
  tested pure utility for the academic calendar; it no longer gates
  session creation.
- `src/types/database.ts`: `AttendanceSession` gains
  `start_time: string | null`.
- Tests: `tests/unit/session-form-validation.test.ts` rewritten for
  the new behaviour (out-of-semester date valid, week/date mismatch
  valid, missing/invalid start time rejected) plus tests for
  `isValidStartTime` and `suggestedWeekForLectureDate`.

## v0.4.0 — 2026-11-16 — Lecturer-created courses + Apple-style mobile navigation

- **Lecturer-created courses (spec change, product-owner decision 2026-11-16).**
  Lecturers can now create a course from My Courses: department,
  semester, code, title, level, credit units. This overrides the
  Lecturer Dashboard spec v1.0 rule that courses are
  admin-controlled. Creating a course also creates the lecturer's
  own assignment to it, so the new course appears immediately.
- New migration `supabase/migrations/20261116000000_lecturer_course_create.sql`
  (existing migrations untouched): a `SECURITY DEFINER` RPC,
  `create_lecturer_course(...)`, that resolves the caller's profile
  from `auth.uid()`, validates everything server-side (department
  and semester exist; code/title/level/credit-unit rules; the
  unique `(department_id, code, semester_id)` rule with a clean
  duplicate error), and inserts the course and the assignment
  atomically. Executable by `authenticated` only. No direct client
  insert policy on `courses` or `lecturer_assignments`.
- The same migration loosens READ policies so any signed-in lecturer
  can read reference data for the form's pickers: `departments`,
  `semesters`, `academic_sessions`, `faculties`, `universities`.
  Attendance data keeps the assignment-based policies.
- Client: new pure `src/lib/courseForm.ts` (validation, RPC call,
  server-error mapping), new `CourseForm` component with
  loading/empty/error/success states (honest empty state when no
  departments or semesters exist yet — no invented options), new
  `useCourseReferenceData` hook, and a "New course" button on My
  Courses with list refresh on success. `useAssignments` takes an
  optional `refreshKey` (default 0; existing callers unchanged).
- **Mobile navigation (Apple-style).** The horizontal scrolling pill
  row is replaced by an iOS-style bottom tab bar (mobile only):
  Overview, Courses, Sessions, History, plus a "More" tab opening a
  bottom sheet with My Departments, Reports & Exports, Profile &
  Settings. Lucide icons + labels (never icons-only), accent-blue
  active state, white background, 1px top border, safe-area bottom
  padding; Escape/backdrop/Cancel close the sheet. Desktop sidebar
  unchanged. AppShell adds bottom padding so the bar never covers
  content. Navigation grouping is pure and tested
  (`src/lib/navigation.ts`).
- Tests: 25 new tests (course-form validation, error mapping,
  mocked-RPC create, navigation grouping); 124 tests total, all
  passing. `tsc -b` + vite build green. Note: the bundle passed
  500 kB minified (502.83 kB) with the first lucide-react imports,
  so vite now prints its chunk-size warning; the extra weight is
  the six tab/sheet icons plus the new code.
- **Not verified live:** the new migration has not been applied to
  the Supabase project (SQL Editor run needed), and the
  `create_lecturer_course` RPC has not been executed against a live
  database. The form's pickers only have options once departments
  and semesters exist (seed or admin setup).

## v0.3.1 — 2026-11-15 — Environment variables hidden from the repo

- Removed `.env.example` from the project entirely (no env file of any kind in the repo).
- Removed environment-variable names and `.env` instructions from all user-facing messages, README and docs. Connection values now live only in the deployment dashboard, never in this repo.
- The only remaining references are the unavoidable code reads: `src/lib/supabase.ts` and `src/types` (`vite-env.d.ts`) name the two connection keys so the app can read them at runtime (names only, never values), and the server-only Edge Function helper reads Supabase's own server-side names. No values exist anywhere in the repo.

## v0.3.0 — 2026-11-15 — Phase 2 attendance operations complete

- QR tokens + classroom passcodes: new pure `src/lib/qr.ts`
  (`generateQrToken` via `crypto.getRandomValues`, never
  `Math.random`; 6-digit passcodes; `isTokenExpired` /
  `tokenRemainingSeconds` display-only helpers; QR payload +
  submission URL builders), tested. `qrcode` (+ `@types/qrcode`)
  installed for rendering.
- New migration `supabase/migrations/20261115010000_session_qr_tokens.sql`
  (Phase 1 migration untouched): `qr_token_hash`,
  `qr_token_issued_at`, `passcode_hash` on `attendance_sessions`
  (SHA-256 hashes only), `idempotency_key` on `attendance_records`
  with a unique index on `(session_id, idempotency_key)`.
- Three Deno Edge Functions (`supabase/functions/`, each with a README
  noting they are untested against a live project):
  `attendance-submit` (public, no student account; active-session +
  hash + server-side expiry checks; normalisation; duplicate via the
  DB unique constraint; idempotency returns the original record on
  retry; status derived server-side; best-effort in-memory rate limit
  60/session/minute, documented as not production-grade),
  `session-transition` (lecturer auth + ownership; same transition
  table as the client; audit row per transition; fresh token +
  passcode on any transition to `active`, returned once),
  `manual-attendance` (manual add + correction, reason-required,
  audit-logged; refuses finalized/archived sessions).
- Activation + QR display: Draft sessions have an Activate action (in
  the list and in the monitor); on success the monitor shows the QR
  code, classroom passcode, display-only expiry countdown and
  submission link. Without a configured backend the honest
  unavailable state is shown — never a fake QR.
- Public student submission at `?submit=<sessionId>&token=<token>`
  (no sign-in): registration number only, passcode entry when no
  token is in the URL; success / already-submitted / expired / error
  states; no other session's data exposed; unavailable state when no
  backend is configured.
- Session monitoring (`src/features/attendance/SessionMonitor.tsx`):
  headcount, verified, manual, pending, rejected, suspicious and
  total counts from real record queries; headcount-vs-submissions
  difference labelled as a number to review, with the explicit text
  that a discrepancy is NOT automatic evidence of fraud; submitted
  registration numbers with statuses; loading / empty / error states.
- Manual attendance + corrections in the monitor (both reason-required,
  both via the Edge Function path, both audit-logged). Finalized /
  archived sessions are read-only: no manual/correction controls are
  rendered. Lifecycle controls (Start, Close, Finalize, Archive,
  Reopen) guarded by `canTransitionSession`.
- SessionForm: the Phase 1 passcode planning checkbox is removed;
  the form now states plainly that the QR code + passcode are
  generated at activation.
- Tests: 47 new tests (QR, submission helpers, Phase 2 lifecycle
  guards, mocked-client Edge Function integration tests); 99 tests
  total, all passing. `tsc -b` + vite build green.
- Docs: README status, `DATABASE_SCHEMA.md` (new columns),
  `API_CONTRACTS.md` (full Edge Function contracts + submit URL),
  `SECURITY_MODEL.md` (token hashing, server-side expiry, no client
  record/audit writes), `ATTENDANCE_RULES.md` (passcode now real),
  `TESTING_STRATEGY.md` (Phase 2 coverage + live pre-pilot checks),
  `supabase/functions/README.md`.
- Still not verified: no live Supabase project — migrations not
  applied, RLS untested live, Edge Functions not deployed or
  exercised against a real project. Phase 2 is local only, unpushed.

## v0.2.0 — 2026-11-15 — Phase 1 foundation complete

- Profile & Settings screen: loads the signed-in lecturer's
  `lecturer_profiles` row (full name, email, staff ID) via RLS, with
  loading / empty / error states and a plain note that assignments
  are admin-controlled.
- Assignment-driven departments and courses (`src/hooks/useAssignments.ts`):
  departments and courses are loaded only through
  `lecturer_assignments`; department/course counts are DISTINCT
  counts (null `course_id` ignored). New DepartmentWorkspace
  (faculty, assigned courses, academic session, department-filtered
  session/record stats and session history). CourseList shows
  department and semester names and filters by department.
- Overview: department filter that re-queries stats, recent
  attendance sessions and records, and courses with no sessions in
  their semester ("courses requiring attention", plainly labelled).
  Upcoming lectures still render the honest "timetable integration
  is not enabled" empty state.
- Academic calendar: new pure `src/lib/calendar.ts`
  (`weekForDate`, `validateLectureDate`, `weekDateRange`, tested) and
  an AcademicCalendarView under `src/features/calendar/` listing
  academic sessions and semesters with dates and the current
  teaching week.
- Full session creation form: department/course from authorized
  assignments, academic session/semester derived from the course,
  week 1–15 cross-checked against the lecture date via `calendar.ts`
  (mismatch rejected before any network call), lecture room from the
  department's `lecture_rooms`, headcount, QR expiry select
  (60/300/600/900 s). Lecturer, timestamp and `draft` status are
  system-set. Passcode is a documented Phase 2 setting and is not
  stored (no passcode column exists in the Phase 1 schema).
  SessionList now shows the course code via a course join.
- Tests: 37 new unit tests (calendar week derivation, distinct
  assignment counts, session-form validation); 52 tests total, all
  passing. `tsc -b` + vite build green.
- Docs: README status updated; `API_CONTRACTS.md` and
  `ATTENDANCE_RULES.md` updated only where behaviour changed
  (calendar week derivation, lecture-room + QR-expiry insert fields,
  passcode Phase 2 note).
- Still not verified: no live Supabase project — migration and RLS
  policies remain untested against a real project; no GitHub repo
  push in this change (local only).

## v0.1.0 — 2026-11-15 — Phase 1 foundation scaffold

- Created the full project tree (docs, src, supabase, tests).
- Wrote all 9 docs: product requirements, system architecture,
  database schema, security model, attendance rules, design system
  (Apple-minimalist, no AI slop), API contracts, testing strategy,
  deployment guide.
- Initial Supabase migration creating all 12 tables with constraints
  (week 1–15 CHECK, unique reg-no per session, session lifecycle
  enum, audit log) and RLS enabled with a policy sketch (unverified
  against live Supabase).
- Example-only seed data (Faculty of Computing; CIT 301, CIT 305,
  CSC 301), clearly marked as test data.
- Vite + React + strict TypeScript + Tailwind + shadcn-style UI
  skeleton; app shell with all 7 navigation sections; real Supabase
  Auth sign-in; overview statistics queried from the database;
  Draft session creation with week validation.
- Unit tests: week validation, session lifecycle transitions, CSV
  escaping / formula-injection neutralization.
- No GitHub repo created (local scaffold only); no live Supabase
  verification yet.
