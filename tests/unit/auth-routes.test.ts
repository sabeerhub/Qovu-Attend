import { describe, expect, it } from 'vitest';
import { AUTH_VIEW_PATHS, getAuthView } from '@/lib/authRoutes';

describe('getAuthView — lecturer-portal auth routing (v0.7.0)', () => {
  it('shows the landing page at / and on unknown paths', () => {
    expect(getAuthView('/')).toBe('landing');
    expect(getAuthView('/anything-else')).toBe('landing');
  });

  it('routes /signin and /signup to their screens', () => {
    expect(getAuthView('/signin')).toBe('signin');
    expect(getAuthView('/signup')).toBe('signup');
  });

  it('maps every view to its path', () => {
    expect(AUTH_VIEW_PATHS).toEqual({ landing: '/', signin: '/signin', signup: '/signup' });
  });
});
