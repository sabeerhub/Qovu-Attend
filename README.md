<p align="center">
  <img src="public/logo-animated.svg" width="320" alt="Qovu">
</p>

<p align="center"><strong>Attendance, verified.</strong></p>

<p align="center">
  <a href="https://qovu.vercel.app">qovu.vercel.app</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.14.0-0071e3" alt="Version 0.14.0">
  <img src="https://img.shields.io/badge/React-18-111111" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-strict-111111" alt="TypeScript strict">
  <img src="https://img.shields.io/badge/Supabase-Postgres-111111" alt="Supabase Postgres">
  <img src="https://img.shields.io/badge/Deployed_on-Vercel-111111" alt="Deployed on Vercel">
</p>

## What Qovu is

Qovu is lecturer attendance that verifies who is really in the hall. A lecturer starts a session, students mark themselves present with their phone, and Qovu checks the code, the location, the device and the face — so a name on the list means a person who was actually there.

## Features

- **QR code + 6-digit passcode.** At activation the lecturer projects a QR code, with the 6-digit code beside it for phones without a camera. Students scan the code or type it at `/submit` — no student account, just a registration number.
- **Location check, anchored in the hall.** The lecturer's phone sets the hall spot at activation. Each student's phone must be within 30 metres of it, with a good GPS fix (100 m accuracy or better). The app waits patiently for a fix — up to 2 minutes — because a cold fix without mobile data is slow.
- **One device per student.** A phone is bound to one registration number per session, so one phone cannot mark a whole class present.
- **Headcount cross-check.** The lecturer counts the hall first. If verified + manual attendance passes the headcount, the session is flagged for review — a mismatch is never automatic fraud.
- **Compulsory live selfie.** Every submission needs a live selfie from the front camera. If the same face is used for two registration numbers in one session, the lecturer reviews it with the photo. No front camera? The lecturer adds the student by hand.
- **Class lists with CSV import.** Add students one by one or import a CSV with a preview first — what will be added, what is already on the list, what is repeated, what has problems. Only registration numbers on the list can submit.
- **Eligibility — the 75% check.** Attendance % per student per course, counted from sessions actually held. The bar is 75% by default and the lecturer can change it per course, with a week-by-week (W1–W15) view.
- **Mark all as arrived.** One tap marks the whole class list present, skipping anyone who already submitted, with a confirm step first.
- **My Lecture Plan.** A weekly timetable (Monday–Saturday). One tap turns a planned lecture into a live session.
- **Exports — PDF + CSV.** One session or a whole course: the spreadsheet keeps every session's detail (registration number, status, method, time, reason), and the printed report is the A4 summary with the session list, per-student attended/held/%, and a signature area. Only your own assigned records, ever.
- **History.** Every session stays available, filterable by department, course, status and date — open any session to see its detail and export it.
- **Contact reports by email.** The contact form sends a report straight to the owner's inbox.

## How it works

1. **Before the lecture.** Create the course, add the class list (CSV import), plan the week in My Lecture Plan.
2. **In the hall.** Start the session, count the hall, activate inside the hall, project the QR or read out the 6-digit code. Students scan or type the code, allow location, take a live selfie — and Qovu checks the code, the location, the device, the class list and the face.
3. **After the lecture.** Close the session, check the headcount against verified + manual attendance, finalise. At the end of the semester, eligibility shows who is below the bar.

## Tech stack

React + Vite, TypeScript (strict), Tailwind CSS, Supabase (PostgreSQL, Auth, Edge Functions, Storage), Vercel. Free tier only.

## Status

Live at [qovu.vercel.app](https://qovu.vercel.app) — **v0.14.0**.

Version history lives in [CHANGELOG.md](CHANGELOG.md).

Not yet: a real hall test is in progress.

## Quick start

```bash
npm install
npm run dev            # dev server
npm test               # unit tests (no credentials needed)
npm run build          # tsc (strict) + vite build
```

Connection values live in your deployment dashboard, never in this repo.

## Docs

- `docs/LECTURER_DASHBOARD_SPEC.md` — the full product spec v1.0
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/SECURITY_MODEL.md`
- `docs/ATTENDANCE_RULES.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/API_CONTRACTS.md`
- `docs/TESTING_STRATEGY.md`
- `docs/DEPLOYMENT_GUIDE.md`

## Working rules

See `AGENTS.md` (the Engineering Constitution). In short: inspect, plan, explain before changing, build only approved scope, run tests and report actual results, never claim a test passed unless it ran, never proceed to another phase without approval.
