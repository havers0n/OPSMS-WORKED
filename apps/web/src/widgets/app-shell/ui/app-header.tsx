import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { useIsDrawerCollapsed, useToggleDrawer } from '@/app/store/ui-selectors';

export function AppHeader() {
  const toggle = useToggleDrawer();
  const isCollapsed = useIsDrawerCollapsed();
  const { user, memberships, currentTenantId, signOut } = useAuth();
  const currentMembership =
    memberships.find((m) => m.tenantId === currentTenantId) ?? memberships[0] ?? null;

  return (
    <header
      className="flex h-11 shrink-0 items-center border-b"
      style={{
        borderColor: 'var(--border-strong)',
        background: 'var(--surface-primary)'
      }}
    >
      {/* Toggle + Logo */}
      <div
        className="flex h-full items-center gap-2 border-r px-3"
        style={{ borderColor: 'var(--border-muted)' }}
      >
        <button
          type="button"
          onClick={toggle}
          title={isCollapsed ? 'Open navigation' : 'Close navigation'}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-[11px] font-black tracking-widest" style={{ color: 'var(--accent)' }}>
          W
        </span>
        <span className="text-sm font-semibold text-slate-700">Warehouse Ops</span>
      </div>

      <div className="flex-1" />

      {/* User + Sign Out */}
      <div
        className="flex h-full items-center gap-3 border-l px-3"
        style={{ borderColor: 'var(--border-muted)' }}
      >
        <div className="hidden flex-col items-end xl:flex">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {currentMembership?.role ?? 'user'}
          </div>
          <div className="text-xs text-slate-700">{user?.email ?? ''}</div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-muted)] bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </header>
  );
}
