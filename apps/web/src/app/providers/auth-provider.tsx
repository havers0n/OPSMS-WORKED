import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { User } from '@supabase/supabase-js';
import { ensureDevSession, subscribeToAuthChanges } from '@/shared/api/supabase/auth';
import { supabase } from '@/shared/api/supabase/client';

type AuthContextValue = {
  isReady: boolean;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue>({
  isReady: false,
  user: null
});

async function resolveAuthenticatedUser(retries = 10, delayMs = 150): Promise<User | null> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      return user;
    }

    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  return null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthContextValue>({
    isReady: false,
    user: null
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let bootstrapComplete = false;

    void ensureDevSession()
      .then(async () => {
        const user = await resolveAuthenticatedUser();

        if (!user) {
          throw new Error('Authenticated user session was not established.');
        }

        if (!isMounted) return;
        bootstrapComplete = true;
        setState({
          isReady: true,
          user
        });
      })
      .catch((authError) => {
        if (!isMounted) return;
        setError(authError instanceof Error ? authError.message : 'Failed to initialize authentication');
      });

    const unsubscribe = subscribeToAuthChanges((user) => {
      if (!isMounted) return;
      if (!bootstrapComplete && !user) return;
      setState({
        isReady: true,
        user
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-secondary)] px-6">
        <div className="w-full max-w-lg rounded-[22px] border border-red-200 bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-red-600">Authentication</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Failed to start authenticated workspace.</div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">{error}</div>
        </div>
      </div>
    );
  }

  if (!state.isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-secondary)] px-6">
        <div className="w-full max-w-lg rounded-[22px] border border-[var(--border-muted)] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Authentication</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Signing in to the warehouse workspace...</div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">Initializing the local Supabase session for authenticated layout operations.</div>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
