import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { User } from '@supabase/supabase-js';
import { resetUiStore } from '@/app/store/ui-store';
import { resetEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { resetNavigationStore } from '@/widgets/warehouse-editor/model/v2/navigation-store';
import { resetSelectionStore } from '@/widgets/warehouse-editor/model/v2/selection-store';
import { resetTaskStore } from '@/widgets/warehouse-editor/model/v2/task-store';
import { bffRequest } from '@/shared/api/bff/client';
import { queryClient } from '@/shared/api/supabase/query-client';
import { ensureDevSession, getCurrentSessionUser, signInWithPassword, signOutSession, signUpWithPassword, subscribeToAuthChanges } from '@/shared/api/supabase/auth';
import { supabase } from '@/shared/api/supabase/client';
import { BffRequestError } from '@/shared/api/bff/client';
import { env } from '@/shared/config/env';

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
  workspaceError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  isReady: false,
  user: null,
  currentTenantId: null,
  memberships: [],
  workspaceError: null,
  signIn: async () => undefined,
  signUp: async () => undefined,
  signOut: async () => undefined
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

function resetLocalWorkspaceState() {
  queryClient.clear();
  resetUiStore();
  resetEditorStore();
  resetNavigationStore();
  resetSelectionStore();
  resetTaskStore();
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthContextValue>({
    isReady: false,
    user: null,
    currentTenantId: null,
    memberships: [],
    workspaceError: null,
    signIn: async () => undefined,
    signUp: async () => undefined,
    signOut: async () => undefined
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function applyAnonymousState() {
      if (!isMounted) return;
      resetLocalWorkspaceState();
      setState((current) => ({
        ...current,
        isReady: true,
        user: null,
        currentTenantId: null,
        memberships: [],
        workspaceError: null
      }));
    }

    async function applyWorkspaceForUser(user: User) {
      try {
        const workspaceSession = await resolveWorkspaceSession();
        if (!isMounted) return;
        setState((current) => ({
          ...current,
          isReady: true,
          user,
          currentTenantId: workspaceSession.currentTenantId,
          memberships: workspaceSession.memberships,
          workspaceError: null
        }));
      } catch (authError) {
        if (!isMounted) return;
        if (authError instanceof BffRequestError && authError.code === 'WORKSPACE_UNAVAILABLE') {
          setState((current) => ({
            ...current,
            isReady: true,
            user,
            currentTenantId: null,
            memberships: [],
            workspaceError: authError.message
          }));
          return;
        }
        throw authError;
      }
    }

    async function bootstrap() {
      if (env.enableDevAutoLogin) {
        await ensureDevSession();
      }

      const user = await getCurrentSessionUser();
      if (!user) {
        await applyAnonymousState();
        return;
      }

      await applyWorkspaceForUser(user);
    }

    void bootstrap().catch((authError) => {
      if (!isMounted) return;
      setError(authError instanceof Error ? authError.message : 'Failed to initialize authentication');
    });

    const unsubscribe = subscribeToAuthChanges((user) => {
      if (!isMounted) return;
      setError(null);

      if (!user) {
        void applyAnonymousState();
        return;
      }

      void applyWorkspaceForUser(user).catch((authError) => {
        if (!isMounted) return;
        setError(authError instanceof Error ? authError.message : 'Failed to initialize authentication');
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

  async function handleSignIn(email: string, password: string) {
    setError(null);
    resetLocalWorkspaceState();
    const result = await signInWithPassword(email, password);
    if (result.error) {
      throw result.error;
    }

    const user = result.data.user ?? (await resolveAuthenticatedUser());
    if (!user) {
      throw new Error('Authenticated user session was not established.');
    }

    await resolveWorkspaceSession();
  }

  async function handleSignUp(email: string, password: string) {
    setError(null);
    resetLocalWorkspaceState();
    const result = await signUpWithPassword(email, password, email.split('@')[0]);
    if (result.error) {
      throw result.error;
    }

    const user = result.data.user ?? (await resolveAuthenticatedUser());
    if (!user) {
      throw new Error('Authenticated user session was not established.');
    }

    await resolveWorkspaceSession();
  }

  async function handleSignOut() {
    setError(null);
    resetLocalWorkspaceState();
    await signOutSession();
    setState((current) => ({
      ...current,
      isReady: true,
      user: null,
      currentTenantId: null,
      memberships: [],
      workspaceError: null
    }));
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
