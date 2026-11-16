import { QovuBrand } from '@/components/brand/QovuBrand';
import { Button } from '@/components/ui/button';
import { LandingIllustration } from './LandingIllustration';

/**
 * Public landing page (v0.8.1 rebuild), shown at `/` to logged-out
 * visitors. Apple landing-page level, not scattered: one centred
 * hero (mark, one headline, one sentence, two buttons), one small
 * hand-built cartoon underneath it, then a short "How it works"
 * and a single minimal features strip — nothing else. Logged-in
 * lecturers never see this page; they go straight to the
 * dashboard. Students never need an account.
 */
export function LandingPage({
  onSignIn,
  onSignUp,
}: {
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-4 py-4 md:px-6">
        <QovuBrand markSize={24} textClassName="text-[17px]" />
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onSignIn}>
            Sign in
          </Button>
          <Button onClick={onSignUp}>Create account</Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col items-center px-4 text-center md:px-6">
        {/* Hero — one idea, centred */}
        <section className="flex flex-col items-center gap-5 py-16 md:py-24">
          <img src="/favicon.svg" alt="" aria-hidden="true" width={64} height={64} />
          <h1 className="max-w-[640px] text-[40px] font-semibold leading-tight tracking-tight text-ink md:text-[56px]">
            Attendance, verified.
          </h1>
          <p className="max-w-[560px] text-[17px] leading-relaxed text-muted">
            Qovu is attendance you can trust. The lecturer shows a code,
            students mark themselves present, and Qovu checks they are
            really in the room.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button onClick={onSignUp}>Create account</Button>
            <Button variant="secondary" onClick={onSignIn}>
              Sign in
            </Button>
          </div>
          <p className="text-[13px] text-faint">For lecturers. Students never need an account.</p>
          <div className="mt-8 w-full max-w-[560px]">
            <LandingIllustration />
          </div>
        </section>

        {/* How it works — three steps, nothing else */}
        <section className="w-full border-t border-line py-16">
          <h2 className="text-[17px] font-semibold text-ink">How it works</h2>
          <ol className="mx-auto mt-8 grid max-w-[880px] gap-8 text-center md:grid-cols-3">
            <li className="flex flex-col items-center gap-1.5">
              <p className="text-[13px] font-medium text-faint">1</p>
              <p className="text-[15px] font-medium text-ink">The lecturer starts a session</p>
              <p className="text-[13px] leading-relaxed text-muted">
                Create a session for your course. When the lecture begins,
                project the QR code or read out the 6-digit code.
              </p>
            </li>
            <li className="flex flex-col items-center gap-1.5">
              <p className="text-[13px] font-medium text-faint">2</p>
              <p className="text-[15px] font-medium text-ink">Students mark themselves present</p>
              <p className="text-[13px] leading-relaxed text-muted">
                Students scan the code or type it in. No account, no app to
                install — just a registration number.
              </p>
            </li>
            <li className="flex flex-col items-center gap-1.5">
              <p className="text-[13px] font-medium text-faint">3</p>
              <p className="text-[15px] font-medium text-ink">Qovu checks they are really there</p>
              <p className="text-[13px] leading-relaxed text-muted">
                Location must be within 30 metres of the lecturer, one device
                per student, and the count is checked against the lecturer’s
                headcount.
              </p>
            </li>
          </ol>
        </section>

        {/* Features — one quiet strip, no boxes, no filler */}
        <section className="w-full border-t border-line py-10">
          <p className="text-[13px] leading-relaxed text-muted">
            30 m location check&nbsp;&nbsp;·&nbsp;&nbsp;One device per student&nbsp;&nbsp;·&nbsp;&nbsp;Headcount
            cross-check
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-4 py-6 md:px-6">
          <p className="text-[13px] text-muted">Qovu — Attendance, verified.</p>
          <p className="text-[13px] text-faint">Lecturer Portal</p>
        </div>
      </footer>
    </div>
  );
}
