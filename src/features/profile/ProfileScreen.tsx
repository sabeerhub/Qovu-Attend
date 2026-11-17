import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAssignments } from '@/hooks/useAssignments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

/**
 * Profile & Settings. Loads the signed-in lecturer's row from
 * `lecturer_profiles` (via RLS, user_id = auth uid) and shows it
 * read-only. Lecturers cannot edit assignments or create
 * departments — those are admin-controlled, and the screen says so
 * plainly. No fake profile is ever shown.
 */
export function ProfileScreen() {
  const state = useAssignments();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  if (state.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Supabase is not connected yet."
      />
    );
  }
  if (state.status === 'loading') return <LoadingState label="Loading profile…" />;
  if (state.status === 'error') return <ErrorState message={state.message} />;
  if (state.status === 'no-profile') {
    return (
      <EmptyState
        title="No lecturer profile found"
        description="Your account has no lecturer profile yet. Ask your university administrator to create one for your account."
      />
    );
  }

  const { profile, departments, courses } = state.data;
  const fields: Array<{ label: string; value: string }> = [
    { label: 'Full name', value: profile.full_name },
    { label: 'Email', value: profile.email },
    { label: 'Staff ID', value: profile.staff_id ?? 'Not set' },
    { label: 'Assigned departments', value: String(departments.length) },
    { label: 'Assigned courses', value: String(courses.length) },
  ];

  async function onSignOut() {
    setSignOutError(null);
    setSigningOut(true);
    const { error } = await (supabase?.auth.signOut() ?? Promise.resolve({ error: null }));
    setSigningOut(false);
    if (error) setSignOutError(error.message);
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-4">
            {fields.map((field) => (
              <div key={field.label} className="flex flex-col gap-0.5 border-b border-line pb-4 last:border-b-0 last:pb-0">
                <dt className="text-[13px] text-muted">{field.label}</dt>
                <dd className="text-[15px] text-ink">{field.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] leading-relaxed text-muted">
            Your departments and courses are assigned by your university administrator.
            You cannot edit assignments or create departments from this portal. If an
            assignment is missing or wrong, contact your administrator.
          </p>
        </CardContent>
      </Card>

      {/* Icon-led sign-out row (v0.13.1): the log-out icon with
          the "Sign out" label, full-width like an iOS settings row.
          Signs out immediately — there is no confirmation step,
          exactly as before. The header icon and the More-sheet row
          do the same. */}
      <div className="flex flex-col items-start gap-2">
        <Button
          variant="danger"
          className="w-full justify-start gap-2"
          onClick={() => void onSignOut()}
          disabled={signingOut}
        >
          <LogOut size={20} aria-hidden="true" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
        {signOutError ? (
          <p className="text-[13px] text-danger" role="alert">
            {signOutError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
