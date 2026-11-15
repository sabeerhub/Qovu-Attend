import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type AuthState =
  | { status: 'not-configured' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session };

/** Real Supabase Auth session state. No fake login is ever used. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setState({ status: 'not-configured' });
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setState(
          data.session ? { status: 'signed-in', session: data.session } : { status: 'signed-out' },
        );
      })
      .catch(() => setState({ status: 'signed-out' }));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: 'signed-in', session } : { status: 'signed-out' });
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return state;
}
