import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { notifyContactReport } from '@/lib/edgeFunctions';
import {
  CONTACT_TOPICS,
  isContactTopic,
  validateContact,
  type ContactErrors,
  type ContactTopic,
} from '@/lib/contactValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PublicPageLayout, type PublicPageNav } from '@/components/layout/PublicPageLayout';

/**
 * Contact us / Report a problem (v0.8.2) — a real form that saves
 * a real report. On submit the report is written to the
 * `contact_reports` table in Supabase (anonymous insert only; no
 * public read). There is no support email address: this form and
 * that table ARE the contact channel, and the owner reads the
 * reports in the Supabase dashboard.
 *
 * Since v0.8.3 the form also asks the server to email the report
 * to the owner (Edge Function `contact-notify`, via Resend). The
 * email is fire-and-forget and must NEVER fail the report: if the
 * function is unreachable or the email fails, the report stays
 * saved and the user still sees the normal success message. The
 * report id is generated here (a random UUID) so the form knows it
 * without needing a SELECT on the table — there is deliberately no
 * public SELECT policy on `contact_reports`.
 *
 * Honest failure: if Supabase is not connected, or the table does
 * not exist yet because the migration has not been applied, the
 * form shows a plain error — never a fake success.
 */
export function ContactPage({ nav }: { nav: PublicPageNav }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<ContactTopic>('problem');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<ContactErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const validation = validateContact({ name, email, topic, message });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    if (!supabase) {
      setError('Qovu is not connected yet, so your report could not be saved. Please try again later.');
      return;
    }
    setLoading(true);
    // The id is generated here so the form knows it without a
    // SELECT on the table (there is deliberately no public SELECT
    // policy on contact_reports). The server re-reads the row by
    // this id before emailing — the client is never trusted for the
    // report content.
    const reportId = globalThis.crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('contact_reports')
      .insert({ id: reportId, name: name.trim(), email: email.trim(), topic, message: message.trim() });
    setLoading(false);
    if (insertError) {
      setError('Your report could not be saved. Please try again later.');
      return;
    }
    // Fire-and-forget: the email must never fail the report. The
    // outcome is only logged to the console; the user still sees
    // the normal success message either way.
    void notifyContactReport(reportId)
      .then((result) => {
        if (result.ok) {
          console.info('Contact report email sent.', result.data.id);
        } else {
          console.warn('Contact report email was not sent.', result.error.code);
        }
      })
      .catch((err: unknown) => {
        console.warn(
          'Contact report email was not sent.',
          err instanceof Error ? err.message : 'unknown error',
        );
      });
    setSaved(true);
  }

  function reset() {
    setName('');
    setEmail('');
    setTopic('problem');
    setMessage('');
    setErrors({});
    setError(null);
    setSaved(false);
  }

  return (
    <PublicPageLayout
      title="Contact us"
      intro="Something wrong, or a question about Qovu? Tell us here. Your report is saved and we will look at it."
      nav={nav}
    >
      {saved ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <p className="text-[15px] font-medium text-ink">Thanks — your report is saved.</p>
            <p className="text-[15px] leading-relaxed text-muted">
              We will look at it. If you gave us your email, we can reply there.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={reset}>
                Send another report
              </Button>
              <Button variant="ghost" onClick={nav.onHome}>
                Back to Qovu
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Your name
            <Input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="Your full name"
            />
            {errors.name ? <span className="text-[13px] font-normal text-danger">{errors.name}</span> : null}
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
            What is this about?
            <select
              aria-label="What is this about?"
              value={topic}
              onChange={(e) => {
                const value = e.target.value;
                if (isContactTopic(value)) setTopic(value);
                setErrors((prev) => ({ ...prev, topic: undefined }));
              }}
              className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {CONTACT_TOPICS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.topic ? <span className="text-[13px] font-normal text-danger">{errors.topic}</span> : null}
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Message
            <textarea
              required
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setErrors((prev) => ({ ...prev, message: undefined }));
              }}
              placeholder="Tell us what happened, or what you want to ask."
              rows={6}
              className="min-h-[120px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
            />
            {errors.message ? (
              <span className="text-[13px] font-normal text-danger">{errors.message}</span>
            ) : null}
          </label>
          {error ? (
            <p className="text-[13px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading} className="mt-1 w-full sm:w-auto">
            {loading ? 'Saving…' : 'Send report'}
          </Button>
        </form>
      )}
    </PublicPageLayout>
  );
}
