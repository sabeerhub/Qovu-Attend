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
import { isMoreNavKey, mobileNavActiveIndex, MORE_SHEET_ITEMS, TAB_BAR_ITEMS, type TabBarKey } from '@/lib/navigation';
import type { NavKey } from '@/app/routes';

export const NAV_ITEMS: Array<{ key: NavKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'departments', label: 'My Departments' },
  { key: 'courses', label: 'My Courses' },
  { key: 'plan', label: 'My Lecture Plan' },
  { key: 'sessions', label: 'Attendance Sessions' },
  { key: 'history', label: 'Attendance History' },
  { key: 'reports', label: 'Reports & Exports' },
  { key: 'analytics', label: 'Analytics' },
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
 * Mobile navigation (v0.13.2): REAL Apple liquid glass, in our
 * colors — the owner rejected the flat v0.13.1 pill, so the pill
 * is now a material with depth and movement, not just a
 * translucent panel. The layers (see `.liquid-glass-*` in
 * `src/styles/globals.css`): translucent white (65%) + strong
 * blur and saturation, a hairline border, a bright inset top
 * highlight (the specular rim), a soft inner bottom shadow for
 * depth, and one soft drop shadow underneath. A slow sheen —
 * a soft blurred white shape — drifts across the pill so the
 * glass feels alive even when nobody taps. No gradients anywhere.
 *
 * The active indicator is a glassy blue pill-within-a-pill
 * (translucent accent + blur + its own inner top highlight) that
 * GLIDES from one slot to the next on a springy 450ms transform
 * transition, carrying the active icon + label with it (the label
 * pops in while the pill travels). The five buttons underneath
 * render icons only — the active button's icon fades out so the
 * indicator's icon is the one you see. A tap squashes the pressed
 * item slightly (~150ms press morph). Reduced motion: static
 * glass, static highlight, no sheen, no press morph.
 *
 * Four tabs — Overview, Courses, Sessions, History — plus a "More"
 * tab that opens a bottom sheet with My Departments, My Lecture
 * Plan, Reports & Exports, Analytics, and Profile & Settings. Five slots fit
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
  // The five slots the indicator can glide between: the four tabs
  // plus More. The indicator is positioned from this index alone —
  // one slot per step, driven by a transform, so it glides.
  const slots: Array<{ key: TabBarKey | 'more'; label: string; icon: LucideIcon }> = [
    ...TAB_BAR_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      icon: TAB_ICONS[item.key],
    })),
    { key: 'more' as const, label: 'More', icon: Ellipsis },
  ];
  const activeIndex = mobileNavActiveIndex(current);
  const ActiveIcon = slots[activeIndex].icon;

  return (
    <>
      <nav
        aria-label="Lecturer portal"
        className="liquid-glass-nav fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[420px] overflow-hidden rounded-full md:hidden"
      >
        {/* Moving light: a soft blurred white shape drifting across
            the glass. It sits behind the buttons, so the light
            passes inside the pill, not over the icons. */}
        <div
          aria-hidden="true"
          className="liquid-glass-sheen pointer-events-none absolute -inset-y-1/2 w-[90px] rounded-full bg-white"
        />
        <div className="relative flex items-center justify-between py-1.5">
          {/* The gliding indicator: an empty glassy blue pill that
              travels slot to slot, carrying the active icon + label.
              pointer-events-none, so taps pass straight through to
              the buttons underneath. */}
          <div
            aria-hidden="true"
            className="liquid-glass-glide pointer-events-none absolute inset-y-1.5 left-0 z-0 w-[20%]"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          >
            <div className="liquid-glass-indicator mx-1 flex h-full flex-col items-center justify-center gap-0.5 rounded-full">
              <div
                key={slots[activeIndex].key}
                className="liquid-indicator-content flex flex-col items-center justify-center gap-0.5"
              >
                <ActiveIcon size={22} strokeWidth={2.25} aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none">
                  {slots[activeIndex].label}
                </span>
              </div>
            </div>
          </div>
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
                className="liquid-glass-press flex min-h-[52px] min-w-[52px] flex-1 items-center justify-center rounded-full px-1 py-1.5 text-muted"
              >
                {/* The active button's own icon fades out — the
                    indicator above carries the visible one. */}
                <Icon
                  size={22}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={cn('transition-opacity duration-200', active && 'opacity-0')}
                />
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
            className="liquid-glass-press flex min-h-[52px] min-w-[52px] flex-1 items-center justify-center rounded-full px-1 py-1.5 text-muted"
          >
            <Ellipsis
              size={22}
              strokeWidth={2}
              aria-hidden="true"
              className={cn('transition-opacity duration-200', moreActive && 'opacity-0')}
            />
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
