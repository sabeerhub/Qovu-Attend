import { useEffect, useState } from 'react';
import {
  BookOpen,
  CalendarCheck,
  ChevronRight,
  Ellipsis,
  History,
  House,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QovuBrand } from '@/components/brand/QovuBrand';
import { isMoreNavKey, MORE_SHEET_ITEMS, TAB_BAR_ITEMS, type TabBarKey } from '@/lib/navigation';
import type { NavKey } from '@/app/routes';

export const NAV_ITEMS: Array<{ key: NavKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'departments', label: 'My Departments' },
  { key: 'courses', label: 'My Courses' },
  { key: 'plan', label: 'My Lecture Plan' },
  { key: 'sessions', label: 'Attendance Sessions' },
  { key: 'history', label: 'Attendance History' },
  { key: 'reports', label: 'Reports & Exports' },
  { key: 'profile', label: 'Profile & Settings' },
];

/** Tab-bar icons, one per tab. Labels are always shown alongside. */
const TAB_ICONS: Record<TabBarKey, LucideIcon> = {
  overview: House,
  courses: BookOpen,
  sessions: CalendarCheck,
  history: History,
};

export function Sidebar({
  current,
  onNavigate,
}: {
  current: NavKey;
  onNavigate: (key: NavKey) => void;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-canvas px-3 py-6 md:flex">
      <p className="px-3 pb-8">
        <QovuBrand markSize={22} textClassName="text-[17px]" />
      </p>
      <nav aria-label="Lecturer portal" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            aria-current={current === item.key ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-2 text-left text-[15px] transition-colors',
              current === item.key
                ? 'bg-surface font-medium text-ink shadow-card'
                : 'text-muted hover:bg-surface hover:text-ink',
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <p className="mt-auto px-3 pt-6 text-[12px] leading-relaxed text-faint">
        Lecturer Portal
      </p>
    </aside>
  );
}

/**
 * Mobile navigation (v0.13.1): a floating frosted-white pill tab
 * bar, like the Apple Liquid Glass pill the owner sent — but in
 * our colors. The pill floats above the safe area (never glued to
 * the bottom edge), is fully rounded, translucent white with a
 * backdrop blur, a 1px hairline and a soft shadow. Active item:
 * accent-blue icon + small label inside a soft rounded highlight.
 * Inactive items: ink icon only (labels are still on every button
 * as aria-labels, so screen readers hear the section name).
 *
 * Four tabs — Overview, Courses, Sessions, History — plus a "More"
 * tab that opens a bottom sheet with My Departments, My Lecture
 * Plan, Reports & Exports, and Profile & Settings. Five slots fit
 * the pill cleanly at phone width, so the grouping is unchanged
 * from the old full-width bar — nothing moved, nothing hidden.
 * The sheet also carries a Sign out row (icon + label, danger
 * color); it signs out immediately, exactly like the header
 * sign-out does — there is no confirmation step anywhere today.
 * AppShell adds bottom padding to the content so the floating pill
 * never covers anything. Desktop keeps the sidebar unchanged.
 */
export function MobileNav({
  current,
  onNavigate,
  onSignOut,
}: {
  current: NavKey;
  onNavigate: (key: NavKey) => void;
  /** Signs out immediately, same as the header sign-out. */
  onSignOut: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  const moreActive = isMoreNavKey(current);

  return (
    <>
      <nav
        aria-label="Lecturer portal"
        className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[420px] rounded-full border border-line bg-surface/80 shadow-[0_8px_24px_rgba(17,17,17,0.12)] backdrop-blur-xl md:hidden"
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          {TAB_BAR_ITEMS.map((item) => {
            const Icon = TAB_ICONS[item.key];
            const active = current === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={cn(
                  'flex min-h-[52px] min-w-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] leading-none transition-colors',
                  active ? 'bg-accent/10 font-medium text-accent' : 'text-muted',
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
                {active ? item.label : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreActive ? 'page' : undefined}
            aria-label="More sections"
            className={cn(
              'flex min-h-[52px] min-w-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] leading-none transition-colors',
              moreActive ? 'bg-accent/10 font-medium text-accent' : 'text-muted',
            )}
          >
            <Ellipsis size={22} strokeWidth={moreActive ? 2.25 : 2} aria-hidden="true" />
            {moreActive ? 'More' : null}
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="More sections"
        >
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-surface pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
            <nav aria-label="More sections" className="flex flex-col px-2 pb-2 pt-2">
              {MORE_SHEET_ITEMS.map((item) => {
                const active = current === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onNavigate(item.key);
                      setMoreOpen(false);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[15px] transition-colors',
                      active ? 'font-medium text-accent' : 'text-ink',
                    )}
                  >
                    {item.label}
                    <ChevronRight
                      size={16}
                      aria-hidden="true"
                      className={active ? 'text-accent' : 'text-faint'}
                    />
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-line px-2 pb-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onSignOut();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] font-medium text-danger"
              >
                <LogOut size={20} aria-hidden="true" />
                Sign out
              </button>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="w-full rounded-lg py-2 text-center text-[15px] font-medium text-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
