import { ChevronDown, LogOut, UserCircle2 } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';

function formatRole(role: string | null | undefined): string {
  if (!role) return 'User';
  return role
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function AccountControls() {
  const { user, memberships, currentTenantId, signOut } = useAuth();
  const currentMembership =
    memberships.find((membership) => membership.tenantId === currentTenantId) ?? memberships[0] ?? null;
  const roleLabel = formatRole(currentMembership?.role);
  const email = user?.email ?? '';

  return (
    <div className="relative flex h-full items-center pl-2">
      <details className="group relative">
        <summary
          className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md px-2.5 text-left text-slate-700 transition-colors hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
          aria-label="Account menu"
        >
          <UserCircle2 className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="hidden min-w-0 flex-col leading-tight lg:flex">
            <span className="max-w-36 truncate text-[11px] font-semibold text-slate-800">{roleLabel}</span>
            <span className="max-w-36 truncate text-[11px] text-slate-500">{email}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border bg-white p-1.5 shadow-lg"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <div className="border-b px-2 py-2" style={{ borderColor: 'var(--border-muted)' }}>
            <div className="text-xs font-semibold text-slate-800">{roleLabel}</div>
            <div className="truncate text-xs text-slate-500">{email}</div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-1 flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <LogOut className="h-3.5 w-3.5 text-slate-500" />
            Sign Out
          </button>
        </div>
      </details>
    </div>
  );
}
