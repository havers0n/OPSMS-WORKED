import { ChevronDown, LogOut, UserCircle2 } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { useT } from '@/shared/i18n';

function useRoleLabel(role: string | null | undefined): string {
  const t = useT();
  switch (role) {
    case 'platform_admin':
      return t('auth.role.platformAdmin');
    case 'tenant_admin':
      return t('auth.role.tenantAdmin');
    case 'operator':
      return t('auth.role.operator');
    default:
      return t('auth.role.unknown');
  }
}

export function AccountControls() {
  const t = useT();
  const { user, memberships, currentTenantId, signOut } = useAuth();
  const currentMembership =
    memberships.find((membership) => membership.tenantId === currentTenantId) ?? memberships[0] ?? null;
  const roleLabel = useRoleLabel(currentMembership?.role);
  const email = user?.email ?? '';

  return (
    <div className="relative flex h-full items-center ps-2">
      <details className="group relative">
        <summary
          className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md px-2.5 text-start text-slate-700 transition-colors hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
          aria-label={t('auth.accountMenu')}
        >
          <UserCircle2 className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="hidden min-w-0 flex-col leading-tight lg:flex">
            <span className="max-w-36 truncate text-[11px] font-semibold text-slate-800">{roleLabel}</span>
            <span className="max-w-36 truncate text-[11px] text-slate-500" dir="auto">{email}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div
          className="absolute end-0 top-full z-50 mt-2 w-56 rounded-md border bg-white p-1.5 shadow-lg"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <div className="border-b px-2 py-2" style={{ borderColor: 'var(--border-muted)' }}>
            <div className="text-xs font-semibold text-slate-800">{roleLabel}</div>
            <div className="truncate text-xs text-slate-500" dir="auto">{email}</div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-1 flex h-8 w-full items-center gap-2 rounded-md px-2 text-start text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <LogOut className="h-3.5 w-3.5 text-slate-500" />
            {t('auth.signOut.button')}
          </button>
        </div>
      </details>
    </div>
  );
}
