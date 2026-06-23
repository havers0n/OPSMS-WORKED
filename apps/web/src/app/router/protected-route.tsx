import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { routes } from '@/shared/config/routes';
import { useT } from '@/shared/i18n';

function NoWorkspaceAccess() {
  const t = useT();
  const { signOut, user, workspaceError } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-secondary)] px-6" data-testid="workspace-access-error">
      <div className="w-full max-w-xl rounded-[24px] border border-amber-200 bg-white p-8 shadow-[var(--shadow-soft)]">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">{t('auth.workspaceAccess.eyebrow')}</div>
        <div className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{t('auth.workspaceAccess.title')}</div>
        <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          {workspaceError ?? t('auth.workspaceAccess.defaultMessage')}
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-3 text-sm text-slate-700">
          {t('auth.signedInAs')} <span className="font-medium text-slate-900" dir="auto">{user?.email ?? t('auth.unknownUser')}</span>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          {t('auth.signOut')}
        </button>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: PropsWithChildren) {
  const t = useT();
  const { isReady, user, workspaceError } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-secondary)] text-sm text-[var(--text-muted)]" data-testid="protected-route-loading">
        {t('app.loading.session')}
      </div>
    );
  }

  if (!user) {
    return <Navigate to={routes.login} replace state={{ from: location }} />;
  }

  if (workspaceError) {
    return <NoWorkspaceAccess />;
  }

  return children;
}
