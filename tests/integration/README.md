# Integration tests — planned, not yet written

Integration tests against a live Supabase project are required
before pilot (see `docs/TESTING_STRATEGY.md`):

- RLS: assigned vs. unassigned lecturer visibility.
- Duplicate registration number rejected by the unique constraint.
- Week 0 / 16 rejected by the CHECK constraint at the DB level.
- Finalized session read-only through the normal update path.
- Audit log row written for manual attendance and corrections.

They are not written yet because no Supabase test project exists
for this scaffold. When one does, add them here and gate them so
they are skipped — never faked as passing — when no test project
is configured.
