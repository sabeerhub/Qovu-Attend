import { describe, expect, it } from 'vitest';
import { getSubmitRoute } from '@/lib/edgeFunctions';

describe('getSubmitRoute — public submission routing (v0.5.4)', () => {
  it('routes a QR link on the root path to the session form', () => {
    expect(getSubmitRoute('/', '?submit=session-1&token=tok-abc')).toEqual({
      kind: 'session',
      params: { sessionId: 'session-1', token: 'tok-abc' },
    });
  });

  it('routes a QR link on /submit to the session form', () => {
    expect(getSubmitRoute('/submit', '?submit=session-1&token=tok-abc')).toEqual({
      kind: 'session',
      params: { sessionId: 'session-1', token: 'tok-abc' },
    });
  });

  it('routes a session link without a token to the session form (passcode path)', () => {
    expect(getSubmitRoute('/', '?submit=session-1')).toEqual({
      kind: 'session',
      params: { sessionId: 'session-1', token: null },
    });
  });

  it('routes /submit with no session params to the passcode entry page', () => {
    expect(getSubmitRoute('/submit', '')).toEqual({ kind: 'entry' });
    expect(getSubmitRoute('/submit', '?token=tok-abc')).toEqual({ kind: 'entry' });
  });

  it('routes any other path with no session params to the lecturer portal', () => {
    expect(getSubmitRoute('/', '')).toBeNull();
    expect(getSubmitRoute('/', '?token=tok-abc')).toBeNull();
    expect(getSubmitRoute('/sessions', '')).toBeNull();
  });
});
