import { useAuth } from '@/app/providers/auth-provider';
import type { TenantMembership } from '@/shared/api/bff/use-workspace-session';
import { env } from '@/shared/config/env';

type RoutingToolsAccessParams = {
  currentTenantId: string | null;
  memberships: TenantMembership[];
  isDev?: boolean;
  enableRoutingTools?: boolean;
};

const ROUTING_TOOL_ROLES = new Set<TenantMembership['role']>([
  'platform_admin',
  'tenant_admin'
]);

function resolveCurrentMembership({
  currentTenantId,
  memberships
}: Pick<RoutingToolsAccessParams, 'currentTenantId' | 'memberships'>) {
  if (currentTenantId) {
    return (
      memberships.find((membership) => membership.tenantId === currentTenantId) ??
      null
    );
  }

  return memberships[0] ?? null;
}

export function canAccessRoutingTools({
  currentTenantId,
  memberships,
  isDev = false,
  enableRoutingTools = false
}: RoutingToolsAccessParams) {
  if (isDev || enableRoutingTools) {
    return true;
  }

  const currentMembership = resolveCurrentMembership({
    currentTenantId,
    memberships
  });

  return currentMembership
    ? ROUTING_TOOL_ROLES.has(currentMembership.role)
    : false;
}

export function useCanAccessRoutingTools() {
  const { currentTenantId, memberships } = useAuth();

  return canAccessRoutingTools({
    currentTenantId,
    memberships,
    isDev: import.meta.env.DEV,
    enableRoutingTools: env.enableRoutingTools
  });
}
