import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { User } from '@supabase/supabase-js';
import { bffRequest } from '@/shared/api/bff/client';
import { ensureDevSession, subscribeToAuthChanges } from '@/shared/api/supabase/auth';
import { supabase } from '@/shared/api/supabase/client';

type TenantMembership = {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  role: 'platform_admin' | 'tenant_admin' | 'operator';
};

type WorkspaceSession = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  currentTenantId: string | null;
  memberships: TenantMembership[];
};

type AuthContextValue = {
  isReady: boolean;
  user: User | null;
  currentTenantId: string | null;
  memberships: TenantMembership[];
};

const AuthContext = createContext<AuthContextValue>({
  isReady: false,
  user: null,
  currentTenantId: null,
  memberships: []
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

async function resolveWorkspaceSession(): Promise<WorkspaceSession> {
  return bffRequest<WorkspaceSession>('/me');
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthContextValue>({
    isReady: false,
    user: null,
    currentTenantId: null,
    memberships: []
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let bootstrapComplete = false;

    async function hydrateAuthenticatedWorkspace() {
      const user = await resolveAuthenticatedUser();

      if (!user) {
        throw new Error('Authenticated user session was not established.');
      }

      const workspaceSession = await resolveWorkspaceSession();

      if (!isMounted) return;
      bootstrapComplete = true;
      setState({
        isReady: true,
        user,
        currentTenantId: workspaceSession.currentTenantId,
        memberships: workspaceSession.memberships
      });
    }

    void ensureDevSession()
      .then(hydrateAuthenticatedWorkspace)
      .catch((authError) => {
        if (!isMounted) return;
        setError(authError instanceof Error ? authError.message : 'Failed to initialize authentication');
      });

    const unsubscribe = subscribeToAuthChanges((user) => {
      if (!isMounted) return;
      if (!bootstrapComplete && !user) return;
      if (!user) {
        setState({
          isReady: true,
          user: null,
          currentTenantId: null,
          memberships: []
        });
        return;
      }

      void resolveWorkspaceSession()
        .then((workspaceSession) => {
          if (!isMounted) return;
          setState({
            isReady: true,
            user,
            currentTenantId: workspaceSession.currentTenantId,
            memberships: workspaceSession.memberships
          });
        })
        .catch((authError) => {
          if (!isMounted) return;
          setError(authError instanceof Error ? authError.message : 'Failed to refresh authenticated workspace');
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
          <div className="mt-2 text-sm text-[var(--text-muted)]">Initializing the local Supabase session and resolving the active tenant workspace.</div>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
