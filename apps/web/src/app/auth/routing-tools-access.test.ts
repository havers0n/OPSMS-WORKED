import { describe, expect, it } from 'vitest';
import type { TenantMembership } from '@/shared/api/bff/use-workspace-session';
import { canAccessRoutingTools } from './routing-tools-access';

function membership(
  role: TenantMembership['role'],
  tenantId = 'tenant-1'
): TenantMembership {
  return {
    tenantId,
    tenantCode: tenantId,
    tenantName: tenantId,
    role
  };
}

describe('canAccessRoutingTools', () => {
  it('denies normal operators', () => {
    expect(
      canAccessRoutingTools({
        currentTenantId: 'tenant-1',
        memberships: [membership('operator')]
      })
    ).toBe(false);
  });

  it('allows tenant and platform admins for the current tenant', () => {
    expect(
      canAccessRoutingTools({
        currentTenantId: 'tenant-1',
        memberships: [membership('tenant_admin')]
      })
    ).toBe(true);

    expect(
      canAccessRoutingTools({
        currentTenantId: 'tenant-1',
        memberships: [membership('platform_admin')]
      })
    ).toBe(true);
  });

  it('uses the current tenant membership when multiple memberships exist', () => {
    expect(
      canAccessRoutingTools({
        currentTenantId: 'tenant-1',
        memberships: [
          membership('operator', 'tenant-1'),
          membership('tenant_admin', 'tenant-2')
        ]
      })
    ).toBe(false);
  });

  it('allows dev mode and the explicit routing tools flag', () => {
    expect(
      canAccessRoutingTools({
        currentTenantId: 'tenant-1',
        memberships: [membership('operator')],
        isDev: true
      })
    ).toBe(true);

    expect(
      canAccessRoutingTools({
        currentTenantId: 'tenant-1',
        memberships: [membership('operator')],
        enableRoutingTools: true
      })
    ).toBe(true);
  });
});
