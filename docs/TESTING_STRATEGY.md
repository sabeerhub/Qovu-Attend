# Testing Strategy — UniAttend

## Principles

- Never claim a test passed unless it was executed.
- Tests for security-critical behaviour are mandatory, not optional.
- Run the relevant tests after every implementation task.

## Tooling

- **Unit / integration:** Vitest (`npm test`), Node environment for
  pure logic. Run with `npm test` from the project root.
- **E2E:** Playwright is planned, not yet installed — see
  `tests/e2e/README.md`. E2E is not part of the Phase 1 scaffold.
- **Type check + build:** `npm run build` runs `tsc -b` (strict)
  then `vite build`. Both must pass.

## What is tested now (Phase 1 scaffold)

| File | Covers |
|---|---|
| `tests/unit/week.test.ts` | Week validation: 1–15 valid, 0/16/non-integers invalid. |
| `tests/unit/session-lifecycle.test.ts` | Allowed/forbidden session status transitions; finalized is terminal for edits; archived is terminal. |
| `tests/unit/csv.test.ts` | CSV escaping (commas, quotes, newlines) and formula-injection neutralization (`=`, `+`, `-`, `@`). |

## What must be tested before pilot (not yet — needs live Supabase)

- RLS: two lecturer accounts, one assigned and one not, confirming
  the unassigned lecturer sees no rows in `courses`,
  `attendance_sessions` or `attendance_records`.
- Duplicate reg. no. within a session rejected by the unique
  constraint (attempt a second insert, expect a constraint error).
- Week 16 / week 0 rejected by the CHECK constraint at the DB level.
- Finalized session cannot be edited through the normal update path.
- Audit log row is written for every manual attendance and
  correction.
- Export (Phase 3) contains only authorized records.

## Conventions

- Tests live under `tests/unit`, `tests/integration`, `tests/e2e`.
- Pure logic (validation, transitions, CSV) is tested without a
  database so it runs in CI with no credentials.
- Anything touching Supabase is an integration test and must be
  skipped (not faked as passing) when no test project is configured.
- No fake production data in tests; example data is clearly marked
  as example data.
