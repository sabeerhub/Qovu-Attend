# Supabase Edge Functions — UniAttend Phase 2

Three functions, all written from the spec (Lecturer Dashboard §7,
§8, §12) and `docs/API_CONTRACTS.md`. None of them has been run
against a live Supabase project: deploy to staging and exercise the
documented paths before pilot.

| Function | Purpose |
|---|---|
| `attendance-submit` | Public student submission: validate session state, QR token / passcode hash + server-side expiry, roster (class-list) check — a number not on a non-empty course list is refused (`reg_number_not_registered`); an empty list accepts anyone — enforce uniqueness + idempotency, derive status server-side. Compulsory live selfie (v0.10.0): a submission without a selfie is refused (`selfie_required`); stores the photo in the private `session-selfies` bucket + its average hash, and flags same-face-different-number records for lecturer review (never a rejection). No student account. |
| `session-transition` | Lecturer lifecycle transitions with ownership check + audit logging. Generates the QR token + passcode on activation (hashes only are stored). Finalize (v0.10.0) deletes the session's selfie photos and clears `selfie_path` on its records. |
| `manual-attendance` | Lecturer manual add + record correction, both reason-required and audit-logged. Refuses finalized / archived sessions. Face review (v0.10.0): confirm (record becomes `suspicious`) or dismiss a `face_review` flag, reason-required and audit-logged. Bulk mark all as arrived (v0.12.0): one tap marks every student on the course's class list as manual attendance, skipping anyone who already has a record; one shared reason, one audit row per marked record; a course with no class list is refused (`empty_class_list`). |
| `contact-notify` | Emails one saved contact report to the owner via Resend (premium HTML + plain text, PNG logo). Called fire-and-forget by the contact form after the report saves. Needs the `RESEND_API_KEY` secret (set by the owner in the Supabase dashboard); the recipient is `mustaphaabdulsalam1666@gmail.com` unless the `CONTACT_REPORT_EMAIL` secret overrides it. |

Shared helpers live in `_shared/server.ts` (service-role client,
SHA-256, caller lecturer lookup, JSON responses).

## Deploy (once a Supabase project exists)

```bash
supabase functions deploy attendance-submit
supabase functions deploy session-transition
supabase functions deploy manual-attendance
supabase functions deploy contact-notify
```

Set the function secrets in the Supabase dashboard (never in the
repo): the Supabase connection values, set in the Supabase dashboard. The service-role key is used only
inside these functions — the frontend never sees it. `contact-notify`
also needs `RESEND_API_KEY` (set by the owner in the dashboard);
without it the function answers `not_configured` and sends nothing.

## Why the client cannot do these writes itself

The Phase 1 migration grants NO client insert/update policy on
`attendance_records` or `attendance_audit_logs`, and
`attendance_sessions` insert is Draft-only. All Phase 2 writes go
through these functions with the service-role key, server-side.
