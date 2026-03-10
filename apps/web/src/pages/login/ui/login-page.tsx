import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { routes } from '@/shared/config/routes';

type AuthMode = 'signin' | 'signup';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isReady, user, workspaceError, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const candidate = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return candidate && candidate !== routes.login ? candidate : routes.warehouse;
  }, [location.state]);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    navigate(routes.warehouse, { replace: true });
  }, [isReady, navigate, user]);

  const handleSubmit = async () => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }

      navigate(nextPath, { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--surface-secondary)] px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.14),_transparent_30%)]" />
      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] border border-slate-900/10 bg-slate-950 p-8 text-slate-100 shadow-[var(--shadow-panel)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">Warehouse Ops</div>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight">Sign in to the active warehouse workspace.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400">
            Authentication is handled by Supabase Auth. Workspace access is resolved after sign in through the tenant-aware BFF session contract.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ['Auth', 'Email and password sessions managed by Supabase Auth.'],
              ['Workspace', 'Tenant membership is resolved only after the session is established.'],
              ['Access', 'If your account has no workspace membership, the app stops before warehouse data is loaded.']
            ].map(([label, text]) => (
              <div key={label} className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{label}</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{text}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--border-muted)] bg-white p-8 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 rounded-full bg-[var(--surface-secondary)] p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={[
                'flex-1 rounded-full px-4 py-2 font-medium transition-colors',
                mode === 'signin' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500'
              ].join(' ')}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={[
                'flex-1 rounded-full px-4 py-2 font-medium transition-colors',
                mode === 'signup' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500'
              ].join(' ')}
            >
              Create Account
            </button>
          </div>

          <div className="mt-6">
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{mode === 'signin' ? 'Sign in' : 'Create your account'}</div>
            <div className="mt-2 text-sm text-[var(--text-muted)]">
              {mode === 'signin'
                ? 'Use your email and password to open the warehouse workspace.'
                : 'The first authenticated user becomes tenant admin for the default local tenant.'}
            </div>
          </div>

          <form
            className="mt-6 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const emailVal = (data.get('email') as string) ?? email;
              const passwordVal = (data.get('password') as string) ?? password;
              if (emailVal) setEmail(emailVal);
              if (passwordVal) setPassword(passwordVal);
              void handleSubmit();
            }}
          >
            <label className="grid gap-1 text-sm text-slate-700">
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onInput={(event) => setEmail((event.target as HTMLInputElement).value)}
                className="rounded-2xl border border-[var(--border-muted)] px-4 py-3 shadow-sm"
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Password
              <input
                name="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onInput={(event) => setPassword((event.target as HTMLInputElement).value)}
                className="rounded-2xl border border-[var(--border-muted)] px-4 py-3 shadow-sm"
              />
            </label>

            {(formError || workspaceError) && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError ?? workspaceError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Working...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-xs uppercase tracking-[0.18em] text-slate-400">
            After authentication you will be redirected to <Link to={routes.warehouse} className="text-slate-700 underline underline-offset-4">{routes.warehouse}</Link>.
          </div>
        </section>
      </div>
    </div>
  );
}
