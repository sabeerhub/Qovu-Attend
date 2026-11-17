import type { ReactNode } from 'react';
import { PublicTopBar } from '@/components/layout/PublicTopBar';

export interface PublicPageNav {
  onHome: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onContact: () => void;
  onPrivacy: () => void;
  onTerms: () => void;
}

/**
 * Shared shell for the public pages (v0.8.2) — contact, privacy,
 * terms. Same slim sticky top bar as the landing page, one narrow
 * centred column of content, and the same minimal footer with
 * links to the three public pages.
 */
export function PublicPageLayout({
  title,
  intro,
  nav,
  children,
}: {
  title: string;
  intro?: string;
  nav: PublicPageNav;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <PublicTopBar onHome={nav.onHome} onSignIn={nav.onSignIn} onSignUp={nav.onSignUp} />

      <main className="mx-auto w-full max-w-[680px] flex-1 px-4 py-12 md:px-6 md:py-16">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {intro ? <p className="mt-3 text-[17px] leading-relaxed text-muted">{intro}</p> : null}
        <div className="mt-8">{children}</div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6">
          <p className="text-[13px] text-muted">Qovu — Attendance, verified.</p>
          <nav className="flex flex-wrap gap-6 text-[13px]" aria-label="Footer">
            <button type="button" className="text-muted hover:text-ink" onClick={nav.onContact}>
              Contact us
            </button>
            <button type="button" className="text-muted hover:text-ink" onClick={nav.onPrivacy}>
              Privacy Policy
            </button>
            <button type="button" className="text-muted hover:text-ink" onClick={nav.onTerms}>
              Terms &amp; Conditions
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
}
