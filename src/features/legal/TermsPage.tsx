import { PublicPageLayout, type PublicPageNav } from '@/components/layout/PublicPageLayout';

/**
 * Terms & Conditions (v0.8.2) — real content, written for what Qovu
 * actually does. No lorem, no placeholders. Last updated
 * 17 November 2026.
 */
export function TermsPage({ nav }: { nav: PublicPageNav }) {
  return (
    <PublicPageLayout
      title="Terms & Conditions"
      intro="Last updated: 17 November 2026. These are the rules for using Qovu, in plain words."
      nav={nav}
    >
      <div className="flex flex-col gap-8 text-[15px] leading-relaxed text-muted">
        <section>
          <h2 className="text-[17px] font-semibold text-ink">Who can use Qovu</h2>
          <p className="mt-2">
            Anyone can create a lecturer account. Lecturers run
            sessions for their own courses. Students do not need an
            account — they only need the QR code or the 6-digit code
            their lecturer shows them, and their registration number.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">Your responsibilities as a lecturer</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>
              Activate a session inside the lecture hall. The location
              is captured where your phone is when you tap Activate,
              so activating from your office would reject the whole
              hall.
            </li>
            <li>Take an honest physical headcount before you activate.</li>
            <li>Keep your account and password safe. You are responsible for what happens under your account.</li>
            <li>Your data is yours. Do not use Qovu to collect information you have no right to collect.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">Rules for students</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>One device marks one registration number per session.</li>
            <li>Location must be on to submit attendance. Without it, there is no attendance.</li>
            <li>Do not submit attendance for someone else, and do not share a QR code or passcode with someone outside the hall.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">What Qovu does not promise</h2>
          <p className="mt-2">
            Qovu is provided as it is. The location and device checks
            are mitigations, not guarantees: GPS can be faked with
            mock-location apps, indoor GPS can drift, and a second
            phone defeats device binding. They catch the common cases;
            they do not make proxy attendance impossible. A headcount
            that does not match the submissions only flags a session
            for the lecturer to review — it is never automatic proof
            of cheating, and Qovu does not decide that for you.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">Finalised records</h2>
          <p className="mt-2">
            Once a session is finalised, its records are read-only.
            Corrections need an authorised action, and the change is
            written to the audit log with who made it, when, and why.
            History is never silently rewritten.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">Acceptable use</h2>
          <p className="mt-2">
            Do not use Qovu for anything unlawful, do not try to break
            or bypass the attendance checks, and do not send spam
            through the Contact us form. Accounts that break these
            terms may be closed.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">Changes to these terms</h2>
          <p className="mt-2">
            These terms may change as Qovu grows. The date at the top
            of this page is the date of the current version. If you
            keep using Qovu after a change, you accept the new terms.
          </p>
        </section>
      </div>
    </PublicPageLayout>
  );
}
