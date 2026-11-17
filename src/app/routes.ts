export type NavKey =
  | 'overview'
  | 'departments'
  | 'courses'
  | 'plan'
  | 'sessions'
  | 'history'
  | 'reports'
  | 'analytics'
  | 'profile';

export const NAV_TITLES: Record<NavKey, string> = {
  overview: 'Overview',
  departments: 'My Departments',
  courses: 'My Courses',
  plan: 'My Lecture Plan',
  sessions: 'Attendance Sessions',
  history: 'Attendance History',
  reports: 'Reports & Exports',
  analytics: 'Analytics',
  profile: 'Profile & Settings',
};
