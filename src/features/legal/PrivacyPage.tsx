import { PublicPageLayout, type PublicPageNav } from '@/components/layout/PublicPageLayout';

/**
 * Privacy Policy (v0.8.2) — real content, written for what Qovu
 * actually does. No lorem, no placeholders. Last updated
 * 17 November 2026.
 */
export function PrivacyPage({ nav }: { nav: PublicPageNav }) {
  return (
    <PublicPageLayout
      title="Privacy Policy"
      intro="Last updated: 17 November 2026. This page explains, in plain words, what Qovu collects, why, and who can see it."
      nav={nav}
    >
      <div className="flex flex-col gap-8 text-[15px] leading-relaxed text-muted">
        <section>
          <h2 className="text-[17px] font-semibold text-ink">What Qovu is</h2>
          <p className="mt-2">
            Qovu is an attendance tool for lecturers. A lecturer creates
            sessions for their courses, students mark themselves present
            with a QR code or a 6-digit code, and Qovu checks that the
            student is really in the lecture hall. That is all Qovu is
            for.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">What we collect</h2>
          <p className="mt-2">We collect only what attendance needs:</p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              <strong className="font-medium text-ink">Lecturers:</strong> your name and email address when you
              create an account, and the courses, sessions and lecture
              plans you create.
            </li>
            <li>
              <strong className="font-medium text-ink">Students:</strong> only a registration number, typed in
              when marking attendance. Students have no account, and we
              never ask students for a name, email or phone number.
            </li>
            <li>
              <strong className="font-medium text-ink">Location:</strong> the lecturer&apos;s location at the
              moment a session is activated, and the student&apos;s
              location at the moment they submit. Both are used for one
              check only: that the student is within 30 metres of the
              lecturer. A submission without a location is refused.
            </li>
            <li>
              <strong className="font-medium text-ink">Device:</strong> a one-way hash of the submitting
              device, so one device cannot mark several students
              present. Only the hash is sent or stored — the raw
              details of the device never leave the phone.
            </li>
            <li>
              <strong className="font-medium text-ink">Selfie (required):</strong> every student takes a
              live selfie when submitting — one still photo. It is
              only used to check the same face is not used for two
              registration numbers in the same class. The photo is
              deleted when the session is finalized; only a short
              code derived from the photo is kept. If a
              student&apos;s phone has no front camera, the lecturer
              adds them by hand instead. The photo is never used to
              identify a student — there are no student photos on
              file to compare it against.
            </li>
            <li>
              <strong className="font-medium text-ink">Headcount:</strong> the number of students the lecturer
              counts in the hall, entered by the lecturer.
            </li>
            <li>
              <strong className="font-medium text-ink">Contact reports:</strong> the name, email and message
              you write if you use the Contact us form.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">Why we collect it</h2>
          <p className="mt-2">
            Only to run attendance: to know who was present, to check
            they were really in the hall, and to keep a record the
            lecturer can look back at. Nothing is collected for
            advertising, and Qovu runs no advertising or analytics
            trackers.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">Who can see it</h2>
          <p className="mt-2">
            Only the lecturer who owns the session or lecture plan.
            Every lecturer&apos;s data is kept separate — one lecturer
            can never see another lecturer&apos;s courses, sessions or
            records. We do not sell data, and we do not share it with
            anyone else. The data is stored in Qovu&apos;s database
            (Supabase), which hosts it on our behalf and does not use
            it for its own purposes.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">How long we keep it</h2>
          <p className="mt-2">
            Attendance history is kept, because a permanent record is
            the point of the product: a lecturer can look back at any
            past session. Selfie photos are different — they are
            deleted when the session is finalized, and only the short
            code derived from the photo is kept. Contact reports are kept until they have
            been handled. If you want your account or your data
            deleted, write to us through the Contact us page and we
            will delete it.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">Staying signed in</h2>
          <p className="mt-2">
            When you sign in, a session is kept in your browser so you
            stay signed in between visits. Signing out ends it. We do
            not use tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">Honest limits</h2>
          <p className="mt-2">
            Location checks where a phone says it is, not who is
            holding it. GPS can be faked, and indoor GPS can drift by
            10 to 20 metres, so an honest student at the back of a hall
            can sometimes be refused. A device hash is a deterrent, not
            proof of identity. A selfie check only catches the same
            face used for two numbers in one class — it cannot prove
            the face belongs to the number, and similar faces can be
            flagged by mistake, which is why a flag is only ever a
            review. A headcount that does not match the
            submissions only flags a session for the lecturer to
            review — it is never treated as proof of cheating.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-semibold text-ink">Questions</h2>
          <p className="mt-2">
            Anything about your data — a copy, a correction, a
            deletion — write to us through the Contact us page.
          </p>
        </section>
      </div>
    </PublicPageLayout>
  );
}
