-- Qovu — v0.8.2 migration: contact_reports
--
-- Public "Contact us / Report a problem" form. Anyone can write a
-- report (no account needed); nobody can read reports from the
-- client — the owner reads them in the Supabase dashboard.
-- There is deliberately NO public SELECT policy.
--
-- UNVERIFIED: this migration has NOT been applied to a live Supabase
-- project yet. Apply in the SQL Editor (it is DDL + RLS, so the
-- publishable key cannot run it), then confirm the
-- contact_reports table exists before relying on the form. Until
-- it is applied the form shows a plain error, never a fake success.

-- ------------------------------------------------------------ table
create table public.contact_reports (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 255),
  -- Report a problem, a question, or feedback.
  topic text not null check (topic in ('problem', 'question', 'feedback')),
  message text not null check (char_length(message) between 10 and 4000),
  created_at timestamptz not null default now()
);

create index contact_reports_created_at_idx on public.contact_reports (created_at desc);

-- ------------------------------------------------------------ RLS
alter table public.contact_reports enable row level security;

-- Anyone may write a report — the form is public and needs no account.
create policy "contact_reports_public_insert"
  on public.contact_reports for insert
  to anon, authenticated
  with check (true);

-- No select, update or delete policy: reports are read only by the
-- owner in the Supabase dashboard, never from the client.
