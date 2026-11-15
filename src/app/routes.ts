export type NavKey =
  | 'overview'
  | 'departments'
  | 'courses'
  | 'sessions'
  | 'history'
  | 'reports'
  | 'profile';

export const NAV_TITLES: Record<NavKey, string> = {
  overview: 'Overview',
  departments: 'My Departments',
  courses: 'My Courses',
  sessions: 'Attendance Sessions',
  history: 'Attendance History',
  reports: 'Reports & Exports',
  profile: 'Profile & Settings',
};
