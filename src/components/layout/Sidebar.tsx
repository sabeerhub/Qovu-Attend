import { cn } from '@/lib/utils';
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

export function Sidebar({
  current,
  onNavigate,
}: {
  current: NavKey;
  onNavigate: (key: NavKey) => void;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-canvas px-3 py-6 md:flex">
      <p className="px-3 pb-6 text-[17px] font-semibold tracking-tight text-ink">UniAttend</p>
      <nav aria-label="Lecturer portal" className="flex flex-col gap-0.5">
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

export function MobileNav({
  current,
  onNavigate,
}: {
  current: NavKey;
  onNavigate: (key: NavKey) => void;
}) {
  return (
    <nav
      aria-label="Lecturer portal"
      className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-4 py-2 md:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onNavigate(item.key)}
          aria-current={current === item.key ? 'page' : undefined}
          className={cn(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm',
            current === item.key ? 'bg-canvas font-medium text-ink' : 'text-muted',
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
