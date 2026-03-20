import type { FastifyReply, FastifyRequest } from 'fastify';
import type { User } from '@supabase/supabase-js';
import { ApiError, sendApiError } from './errors.js';
import { createAnonClient, createUserClient } from './supabase.js';

export type TenantMembership = {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  role: 'platform_admin' | 'tenant_admin' | 'operator';
};

export type AuthenticatedRequestContext = {
  accessToken: string;
  user: User;
  displayName: string;
  memberships: TenantMembership[];
  currentTenant: TenantMembership | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  tenant_members:
    | Array<{
        tenant_id: string;
        role: TenantMembership['role'];
        tenants: {
          id: string;
          code: string;
          name: string;
        } | null;
      }>
    | null;
};

function getBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length);
}

function pickCurrentTenant(memberships: TenantMembership[]) {
  return memberships.find((membership) => membership.role === 'tenant_admin' || membership.role === 'platform_admin') ?? memberships[0] ?? null;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedRequestContext | null> {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    await sendApiError(reply, new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token.'), request.id);
    return null;
  }

  const anonClient = createAnonClient();
  const {
    data: { user },
    error
  } = await anonClient.auth.getUser(accessToken);

  if (error || !user) {
    await sendApiError(reply, new ApiError(401, 'UNAUTHORIZED', 'Invalid bearer token.'), request.id);
    return null;
  }

  const userClient = createUserClient(accessToken);
  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('id,email,display_name,tenant_members(tenant_id,role,tenants(id,code,name))')
    .eq('id', user.id)
    .single<ProfileRow>();

  if (profileError || !profile) {
    await sendApiError(reply, new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'Authenticated profile is not configured for a tenant workspace.'), request.id);
    return null;
  }

  const memberships = (profile.tenant_members ?? [])
    .map((membership) => {
      if (!membership.tenants) {
        return null;
      }

      return {
        tenantId: membership.tenant_id,
        tenantCode: membership.tenants.code,
        tenantName: membership.tenants.name,
        role: membership.role
      } satisfies TenantMembership;
    })
    .filter((membership): membership is TenantMembership => membership !== null);

  if (memberships.length === 0) {
    await sendApiError(reply, new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'Authenticated profile has no tenant membership.'), request.id);
    return null;
  }

  return {
    accessToken,
    user,
    displayName: profile.display_name ?? user.user_metadata.display_name ?? user.email ?? 'operator',
    memberships,
    currentTenant: pickCurrentTenant(memberships)
  };
}

export function getUserClient(context: AuthenticatedRequestContext) {
  return createUserClient(context.accessToken);
}
