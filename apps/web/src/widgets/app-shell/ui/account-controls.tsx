import { LogOut } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/shared/ui/button';

export function AccountControls() {
  const { user, memberships, currentTenantId, signOut } = useAuth();
  const currentMembership =
    memberships.find((membership) => membership.tenantId === currentTenantId) ?? memberships[0] ?? null;

  return (
    <div className="flex h-full items-center gap-3 border-l px-3" style={{ borderColor: 'var(--border-muted)' }}>
      <div className="hidden flex-col items-end xl:flex">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {currentMembership?.role ?? 'user'}
        </div>
        <div className="text-xs text-slate-700">{user?.email ?? ''}</div>
      </div>
      <Button
        variant="ghost"
        onClick={() => void signOut()}
        className="h-8 gap-1.5 rounded-lg border border-[var(--border-muted)] bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign Out
      </Button>
    </div>
  );
}
