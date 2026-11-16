# Global Roadmap — UniAttend v3 / v4

> Plan only. Nothing in this document is built, and nothing here starts
> without the product owner's go-ahead. The live product is v0.5.x, a
> university lecturer tool. This document describes where it could go
> next: a global attendance system for universities **and** companies.

## 1. The vision, in plain terms

Today UniAttend answers one question for a university lecturer: "who is
in my lecture hall right now, and can I trust that answer?" The v3/v4
vision is the same question, asked anywhere people gather on a schedule:
a lecture hall, an office, a shift, a training room. The people change
— students become employees and interns — and the person running the
session changes — a lecturer becomes a manager or organiser — but the
trust problem is the same, so the engine that solves it stays the same.

## 2. What company mode is (v3/v4)

- **Organisations, not just universities.** An organisation is either
  a university or a company. A university keeps departments, courses,
  semesters and weeks. A company has teams, shifts and workdays
  instead of semesters — the calendar is the company's own, not an
  academic one.
- **People are employees and interns.** A person checks in with an
  employee ID (the same idea as a registration number) and a role:
  employee or intern. No accounts for the people checking in, exactly
  as students have no accounts today.
- **A manager or organiser runs the session.** This is the lecturer's
  role with a different name: they start the session, take the
  headcount, show the QR code, watch the live count, close and
  finalise it.
- **Every check-in shows the exact arrival time.** The time the person
  came is recorded and shown on the record — e.g. "09:04" next to the
  name — so lateness is visible at a glance. (The arrival time is
  already recorded server-side today as `submitted_at`; what is new is
  showing it on every record, in the session monitor, in history, and
  in exports.)
- **The person can add a reason with their check-in.** For example a
  late arrival adds "traffic", "bus delayed", or "family emergency".
  The reason is optional, short, written by the person at check-in,
  and shown next to their arrival time. It is a note, not an excuse
  the system judges — the manager decides what it means.
- **The same anti-cheating engine, unchanged.** QR code or 6-digit
  passcode to check in; the manager's location at activation is the
  anchor and the person must be within 30 metres of it; one device
  per person per session; the physical headcount is still the
  cross-check no phone can fake, and a mismatch flags the session for
  review — never automatic fraud.

## 3. What the database needs (new fields and tables)

No migration is written yet. When the build starts, these are the
changes, all behind new migrations per the Engineering Constitution:

| Change | Detail |
| --- | --- |
| `universities` → organisations | Add `type` (`university` / `company`) to the organisation table, or a new `organisations` table that universities and companies both belong to. University-only columns stay; company-only columns are added, not forced onto universities. |
| Person role | A `role` on the person record (`employee` / `intern` for companies; `student` stays for universities). A check-in already stores a registration number; companies store an employee ID in the same column. |
| Manager role | A `manager` / `organiser` role alongside `lecturer` on profiles and assignments. A manager runs sessions for their own teams only — the same assignment-scoping rule lecturers have today. |
| Arrival time on display | `attendance_records.submitted_at` already stores the check-in time server-side. No new column needed to record it; the work is showing it everywhere (monitor, history, exports). |
| Reason field | New nullable `checkin_reason` (short text, e.g. max 140 characters) on `attendance_records`, filled by the person at check-in. A reason is never required to check in, and it never changes a record's status by itself. |
| Company calendar | Companies need teams and shifts instead of semesters and weeks. The 15-week semester rule stays university-only; company sessions are dated by workday/shift, not by week number. |

## 4. What changes in the flows

**Manager flow (the lecturer flow, renamed):** create a team/session,
set the date and start time, activate in the room or office (location
anchor captured exactly as today), confirm the physical headcount,
project the QR code, watch arrivals come in with their times and
reasons, close and finalise. The only new screen element is the
arrival time and reason on each row.

**Employee / intern flow (the student flow):** open the link or scan
the QR, or go to `/submit` and type the 6-digit code (exactly as
today); type the employee ID; optionally add a short reason; allow
location; submit. The arrival time is stamped by the server at that
moment — the person never types a time, and the client never decides
it.

**Reports and exports:** arrival time and reason become columns in
history, CSV and PDF, next to the name and status. Late-arrival
summaries (how many arrived after the session start time) are a
report, not a punishment — the manager reads it, the system does not
act on it.

## 5. What stays exactly the same

- The anti-cheating engine: QR/passcode, 30 m location anchor,
  accuracy cap, device binding, headcount cross-check, rate limits,
  server-side validation, never trusting client-submitted status.
- The session lifecycle: Draft → Active → Closed → Finalized →
  Archived. Finalised records stay read-only; corrections need an
  authorised action with a reason and an audit log.
- The design system: Apple-level minimalist, one accent colour, no
  generic AI SaaS layout.
- The security rules: no service-role keys in the client, RLS +
  server-side authorization, audit logging, no student/employee
  accounts.

## 6. What is NOT decided yet (owner's decisions)

- **The product name.** "UniAttend" is university-specific. A global
  product for universities and companies may need a neutral name.
  This document does not pick one — that is the owner's decision.
- **Separate workspace or a mode switch?** Is company mode a second
  product/area inside the same app (one login, pick university or
  company), or a separate workspace per organisation? Not decided.
- **Who counts as late?** The arrival time is shown, but the line for
  "late" (e.g. 5 minutes after the start time) is a company policy,
  not a product rule. Not decided whether the product draws that line
  or leaves it to the manager.
- **Pricing and tiers.** Universities are free-tier today. Whether
  company mode is free, paid, or limited is not decided and not part
  of this plan.
- **Company onboarding.** How a company signs up, who its first
  manager is, and how employees get their IDs is not designed yet.

## 7. Suggested order (when the owner says go)

1. v3 — organisations + roles + arrival-time display + reason field.
   The university product keeps working untouched; company mode is a
   second organisation type behind it.
2. v4 — company calendar (teams/shifts), late-arrival summaries,
   manager reporting. Only after v3 is tested in a real company.
3. The name decision and the workspace question (section 6) are
   answered before v3 starts, not during it.

## 8. Open questions for the owner

1. Should the product keep the name UniAttend, or get a neutral name?
2. One app with a university/company switch, or a separate workspace
   per organisation?
3. Who decides what counts as "late" — the product, or the manager?
4. Is company mode aimed at small companies first, or any size?
5. Does the owner want v3 built next, or is the university pilot
   (Phase 3 history/exports) still first?
