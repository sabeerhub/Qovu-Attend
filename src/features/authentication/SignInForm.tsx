import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { ensureLecturerProfile } from './lecturerProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Lecturer sign-in, wired to Supabase Auth. No fake login. */
export function SignInForm({ onSignUp }: { onSignUp?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!supabase) {
      setError('Supabase is not connected yet.');
      return;
    }
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    // Best-effort: lecturers who signed up while email confirmation
    // was on have an account but no profile row yet. Creating it
    // here never blocks sign-in — if it fails, the dashboard shows
    // the honest "no profile" state as before.
    if (data.user) {
      void ensureLecturerProfile(supabase, data.user);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Lecturer Portal — use your university account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Email
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Password
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="text-[13px] text-danger" role="alert">{error}</p> : null}
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
          {onSignUp ? (
            <p className="text-center text-[13px] text-muted">
              New to Qovu?{' '}
              <button type="button" className="font-medium text-accent" onClick={onSignUp}>
                Create an account
              </button>
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
