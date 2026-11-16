import { QovuBrand } from '@/components/brand/QovuBrand';
import { Button } from '@/components/ui/button';

/**
 * Public landing page (v0.7.0), shown at `/` to logged-out
 * visitors. Plain words, no decoration: what Qovu does, how it
 * works in three steps, and two buttons — Create account, Sign in.
 * Logged-in lecturers never see this page; they go straight to
 * the dashboard. Students never need an account.
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

      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 md:px-6">
        {/* Hero */}
        <section className="flex flex-col items-start gap-4 py-16 md:py-24">
          <h1 className="max-w-[640px] text-[32px] font-semibold leading-tight tracking-tight text-ink md:text-[40px]">
            Attendance, verified.
          </h1>
          <p className="max-w-[560px] text-[17px] leading-relaxed text-muted">
            Qovu is attendance you can trust. The lecturer shows a code,
            students mark themselves present, and Qovu checks they are
            really in the room.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={onSignUp}>Create account</Button>
            <Button variant="secondary" onClick={onSignIn}>
              Sign in
            </Button>
          </div>
          <p className="text-[13px] text-faint">For lecturers. Students never need an account.</p>
        </section>

        {/* How it works — three steps */}
        <section className="border-t border-line py-12">
          <h2 className="text-[17px] font-semibold text-ink">How it works</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            <li className="flex flex-col gap-1.5">
              <p className="text-[13px] font-medium text-faint">1</p>
              <p className="text-[15px] font-medium text-ink">The lecturer starts a session</p>
              <p className="text-[13px] leading-relaxed text-muted">
                Create a session for your course. When the lecture begins,
                project the QR code or read out the 6-digit code.
              </p>
            </li>
            <li className="flex flex-col gap-1.5">
              <p className="text-[13px] font-medium text-faint">2</p>
              <p className="text-[15px] font-medium text-ink">Students mark themselves present</p>
              <p className="text-[13px] leading-relaxed text-muted">
                Students scan the code or type it in. No account, no app to
                install — just a registration number.
              </p>
            </li>
            <li className="flex flex-col gap-1.5">
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

        {/* Features — kept minimal */}
        <section className="border-t border-line py-12">
          <h2 className="text-[17px] font-semibold text-ink">Built against cheating</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <p className="text-[15px] font-medium text-ink">In the room, not at home</p>
              <p className="text-[13px] leading-relaxed text-muted">
                A student outside the lecture hall is turned away — the
                check is 30 metres from where the lecturer activates the
                session.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[15px] font-medium text-ink">One device, one student</p>
              <p className="text-[13px] leading-relaxed text-muted">
                A phone can only mark one registration number per session,
                so one student cannot sign in for a friend.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[15px] font-medium text-ink">Headcount cross-check</p>
              <p className="text-[13px] leading-relaxed text-muted">
                Submissions are compared with the physical headcount the
                lecturer takes in the hall.
              </p>
            </div>
          </div>
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
