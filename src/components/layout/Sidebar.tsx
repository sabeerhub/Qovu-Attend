import { useEffect, useState } from 'react';
import {
  BookOpen,
  CalendarCheck,
  ChevronRight,
  Ellipsis,
  History,
  House,
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
 * Mobile navigation (iOS-style bottom tab bar, mobile only).
 *
 * Four tabs — Overview, Courses, Sessions, History — plus a "More"
 * tab that opens a bottom sheet with My Departments, Reports &
 * Exports, and Profile & Settings. Active tab is the accent blue;
 * inactive tabs are muted grey. Labels are always shown next to
 * the icons (never icons-only). The bar is fixed to the bottom of
 * the viewport; AppShell adds bottom padding to the content so the
 * bar never covers anything. Desktop keeps the sidebar unchanged.
 */
export function MobileNav({
  current,
  onNavigate,
}: {
  current: NavKey;
  onNavigate: (key: NavKey) => void;
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid grid-cols-5">
          {TAB_BAR_ITEMS.map((item) => {
            const Icon = TAB_ICONS[item.key];
            const active = current === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[52px] flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-[10px] leading-none',
                  active ? 'font-medium text-accent' : 'text-muted',
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreActive ? 'page' : undefined}
            className={cn(
              'flex min-h-[52px] flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-[10px] leading-none',
              moreActive ? 'font-medium text-accent' : 'text-muted',
            )}
          >
            <Ellipsis size={22} strokeWidth={moreActive ? 2.25 : 2} aria-hidden="true" />
            More
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
                      'flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[15px]',
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
            <div className="border-t border-line px-4 py-3">
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
