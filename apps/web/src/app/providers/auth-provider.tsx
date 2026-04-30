import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { User } from '@supabase/supabase-js';
import { resetLocalWorkspaceState } from '@/app/session/reset-local-workspace-state';
import { resolveAuthenticatedUser, signInWithPassword, signOutSession, signUpWithPassword } from '@/shared/api/supabase/auth';
import { useSupabaseAuthState } from '@/shared/api/supabase/use-supabase-auth-state';
import { resolveWorkspaceSession, useWorkspaceSession, type TenantMembership } from '@/shared/api/bff/use-workspace-session';

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

export function AuthProvider({ children }: PropsWithChildren) {
  const supabaseAuth = useSupabaseAuthState();
  const workspaceSession = useWorkspaceSession(supabaseAuth.user);
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
    if (!supabaseAuth.isReady) {
      return;
    }

    setError(null);

    if (!supabaseAuth.user) {
      resetLocalWorkspaceState();
      setState((current) => ({
        ...current,
        isReady: true,
        user: null,
        currentTenantId: null,
        memberships: [],
        workspaceError: null
      }));
      return;
    }

    if (workspaceSession.error) {
      setError(workspaceSession.error);
      return;
    }

    if (!workspaceSession.isReady) {
      return;
    }

    setState((current) => ({
      ...current,
      isReady: true,
      user: supabaseAuth.user,
      currentTenantId: workspaceSession.currentTenantId,
      memberships: workspaceSession.memberships,
      workspaceError: workspaceSession.workspaceError
    }));
  }, [supabaseAuth.isReady, supabaseAuth.user, workspaceSession]);

  const startupError = supabaseAuth.error ?? error;

  if (startupError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-secondary)] px-6">
        <div className="w-full max-w-lg rounded-[22px] border border-red-200 bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-red-600">Authentication</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Failed to start authenticated workspace.</div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">{startupError}</div>
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
    supabaseAuth.clearError();
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
    supabaseAuth.clearError();
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
    supabaseAuth.clearError();
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
