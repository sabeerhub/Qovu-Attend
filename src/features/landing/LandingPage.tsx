import { PublicTopBar } from '@/components/layout/PublicTopBar';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { LandingIllustration } from './LandingIllustration';
import {
  CodeIllustration,
  HallCheckIllustration,
  WeekPlanIllustration,
} from './SectionIllustrations';

/**
 * Public landing page (v0.8.2 rebuild) — a true Apple-style scroll
 * story, not a crowded grid. Slim sticky top bar; one big hero with
 * huge type and the lecturer-and-QR cartoon; then three sections,
 * one idea each, alternating white and canvas, each with a huge
 * headline, one short sentence, and one small cartoon that animates
 * in on scroll. A short closing call to action, then a real footer
 * with links to Contact, Privacy Policy and Terms & Conditions.
 * Logged-in lecturers never see this page; they go straight to the
 * dashboard. Students never need an account.
 */
export function LandingPage({
  onSignIn,
  onSignUp,
  onContact,
  onPrivacy,
  onTerms,
}: {
  onSignIn: () => void;
  onSignUp: () => void;
  onContact: () => void;
  onPrivacy: () => void;
  onTerms: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <PublicTopBar
        onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onSignIn={onSignIn}
        onSignUp={onSignUp}
      />

      <main className="flex-1">
        {/* Hero — one idea, huge type, the cartoon underneath */}
        <section className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 pb-20 pt-20 text-center md:px-6 md:pb-28 md:pt-28">
          <img src="/favicon.svg" alt="" aria-hidden="true" width={72} height={72} />
          <h1 className="mt-6 max-w-[800px] text-[48px] font-semibold leading-[1.05] tracking-tight text-ink md:text-[72px]">
            Attendance, verified.
          </h1>
          <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-muted md:text-[21px]">
            Qovu is attendance you can trust. The lecturer shows a code,
            students mark themselves present, and Qovu checks they are
            really in the room.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button onClick={onSignUp}>Create account</Button>
            <Button variant="secondary" onClick={onSignIn}>
              Sign in
            </Button>
          </div>
          <p className="mt-4 text-[13px] text-faint">For lecturers. Students never need an account.</p>
          <div className="mt-14 w-full max-w-[720px]">
            <LandingIllustration />
          </div>
        </section>

        {/* 1 — Show the code. Canvas, so the story breathes. */}
        <section className="bg-canvas">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 py-24 text-center md:px-6 md:py-32">
            <Reveal>
              <h2 className="text-[32px] font-semibold leading-tight tracking-tight text-ink md:text-[48px]">
                Show the code.
              </h2>
              <p className="mx-auto mt-4 max-w-[520px] text-[17px] leading-relaxed text-muted">
                When the lecture begins, project the QR code or read out the
                6-digit code. That is the whole setup.
              </p>
              <div className="mx-auto mt-12 w-full max-w-[560px]">
                <CodeIllustration />
              </div>
            </Reveal>
          </div>
        </section>

        {/* 2 — Only the hall counts. */}
        <section>
          <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 py-24 text-center md:px-6 md:py-32">
            <Reveal>
              <h2 className="text-[32px] font-semibold leading-tight tracking-tight text-ink md:text-[48px]">
                Only the hall counts.
              </h2>
              <p className="mx-auto mt-4 max-w-[520px] text-[17px] leading-relaxed text-muted">
                A student must be within 30 metres of where you activated
                the session, on a device that has not marked anyone else
                present. A friend at home cannot check in for them.
              </p>
              <div className="mx-auto mt-12 w-full max-w-[560px]">
                <HallCheckIllustration />
              </div>
            </Reveal>
          </div>
        </section>

        {/* 3 — Your week, planned. Canvas again. */}
        <section className="bg-canvas">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 py-24 text-center md:px-6 md:py-32">
            <Reveal>
              <h2 className="text-[32px] font-semibold leading-tight tracking-tight text-ink md:text-[48px]">
                Your week, planned.
              </h2>
              <p className="mx-auto mt-4 max-w-[520px] text-[17px] leading-relaxed text-muted">
                Add each lecture once — course, day, time, room — and when
                the lecture starts, one tap turns it into a live session.
              </p>
              <div className="mx-auto mt-12 w-full max-w-[560px]">
                <WeekPlanIllustration />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Closing — one line, one button, nothing else */}
        <section className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 py-24 text-center md:px-6 md:py-32">
          <h2 className="text-[32px] font-semibold leading-tight tracking-tight text-ink md:text-[48px]">
            Ready when your next lecture starts.
          </h2>
          <div className="mt-8">
            <Button onClick={onSignUp}>Create account</Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6">
          <p className="text-[13px] text-muted">Qovu — Attendance, verified.</p>
          <nav className="flex flex-wrap gap-6 text-[13px]" aria-label="Footer">
            <button type="button" className="text-muted hover:text-ink" onClick={onContact}>
              Contact us
            </button>
            <button type="button" className="text-muted hover:text-ink" onClick={onPrivacy}>
              Privacy Policy
            </button>
            <button type="button" className="text-muted hover:text-ink" onClick={onTerms}>
              Terms &amp; Conditions
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
}
