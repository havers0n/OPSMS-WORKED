import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { routes } from '@/shared/config/routes';

function NoWorkspaceAccess() {
  const { signOut, user, workspaceError } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-secondary)] px-6">
      <div className="w-full max-w-xl rounded-[24px] border border-amber-200 bg-white p-8 shadow-[var(--shadow-soft)]">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">Workspace Access</div>
        <div className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">Your account is authenticated, but no warehouse workspace is assigned yet.</div>
        <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          {workspaceError ?? 'The authenticated profile has no tenant membership. Ask an administrator to grant access, then sign in again.'}
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-3 text-sm text-slate-700">
          Signed in as <span className="font-medium text-slate-900">{user?.email ?? 'unknown user'}</span>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isReady, user, workspaceError } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return null;
  }

  if (!user) {
    return <Navigate to={routes.login} replace state={{ from: location }} />;
  }

  if (workspaceError) {
    return <NoWorkspaceAccess />;
  }

  return children;
}
