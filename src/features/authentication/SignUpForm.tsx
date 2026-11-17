import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { validateSignup, type SignupErrors } from '@/lib/signupValidation';
import { ensureLecturerProfile } from './lecturerProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Lecturer sign-up (v0.7.0), wired to Supabase Auth. Client
 * validation first (plain inline errors), then `signUp` with the
 * full name stored as user metadata, then the lecturer profile row
 * is created for the new user (see lecturerProfile.ts — self-insert
 * only, under the existing RLS policy).
 *
 * Email confirmation is currently OFF in the Supabase project, so
 * sign-up normally returns a session at once and the lecturer lands
 * on the dashboard. If confirmation is ever switched back on, the
 * sign-up returns no session: the form then says to check email,
 * and the profile row is created on the first sign-in instead
 * (SignInForm calls the same helper).
 */
export function SignUpForm({
  onSignIn,
  onPrivacy,
  onTerms,
}: {
  onSignIn?: () => void;
  onPrivacy?: () => void;
  onTerms?: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<SignupErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNeedsConfirmation(false);
    const validation = validateSignup({ fullName, email, password, confirmPassword });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    if (!supabase) {
      setError('Supabase is not connected yet.');
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }
    if (!data.session || !data.user) {
      // Confirmation required: no session yet. The profile row is
      // created on the first sign-in (SignInForm).
      setLoading(false);
      setNeedsConfirmation(true);
      return;
    }
    const profile = await ensureLecturerProfile(supabase, data.user);
    setLoading(false);
    if (!profile.ok) {
      // Signed in but no profile row: sign back out so the lecturer
      // sees this error instead of a dashboard with no profile.
      await supabase.auth.signOut();
      setError(profile.message);
      return;
    }
    // Signed in with a profile: the auth listener moves the
    // lecturer to the dashboard automatically.
  }

  if (needsConfirmation) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to {email.trim()}. Open it, then sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {onSignIn ? (
            <Button variant="secondary" className="w-full" onClick={onSignIn}>
              Back to sign in
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Lecturer Portal — one account per lecturer.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Full name
            <Input
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              placeholder="Mustapha Abdulsalam Sabeer"
            />
            {errors.fullName ? <span className="text-[13px] font-normal text-danger">{errors.fullName}</span> : null}
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Email
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="you@university.edu"
            />
            {errors.email ? <span className="text-[13px] font-normal text-danger">{errors.email}</span> : null}
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Password
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: undefined }));
              }}
            />
            {errors.password ? <span className="text-[13px] font-normal text-danger">{errors.password}</span> : null}
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Confirm password
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
            />
            {errors.confirmPassword ? (
              <span className="text-[13px] font-normal text-danger">{errors.confirmPassword}</span>
            ) : null}
          </label>
          {error ? (
            <p className="text-[13px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? 'Creating your account…' : 'Create account'}
          </Button>
          {onSignIn ? (
            <p className="text-center text-[13px] text-muted">
              Already have an account?{' '}
              <button type="button" className="font-medium text-accent" onClick={onSignIn}>
                Sign in
              </button>
            </p>
          ) : null}
          {onPrivacy && onTerms ? (
            <p className="text-center text-[13px] text-muted">
              By continuing, you agree to the{' '}
              <button type="button" className="font-medium text-accent" onClick={onTerms}>
                Terms
              </button>{' '}
              and{' '}
              <button type="button" className="font-medium text-accent" onClick={onPrivacy}>
                Privacy Policy
              </button>
              .
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
