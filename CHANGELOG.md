# Changelog — UniAttend

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
