import { describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildApp } from '../../app.js';

const authContext = {
  accessToken: 'token',
  user: {
    id: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d',
    email: 'operator@wos.local'
  },
  displayName: 'Local Operator',
  memberships: [
    {
      tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      tenantCode: 'default',
      tenantName: 'Default Tenant',
      role: 'tenant_admin'
    }
  ],
  currentTenant: {
    tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin'
  }
};

describe('GET /api/me', () => {
  it('returns the current workspace session response shape when authenticated', async () => {
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer token' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        id: authContext.user.id,
        email: authContext.user.email,
        displayName: authContext.displayName
      },
      currentTenantId: authContext.currentTenant.tenantId,
      memberships: expect.any(Array)
    });

    await app.close();
  });

  it('preserves current workspace and membership fields', async () => {
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer token' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: authContext.user.id,
        email: authContext.user.email,
        displayName: 'Local Operator'
      },
      currentTenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      memberships: [
        {
          tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
          tenantCode: 'default',
          tenantName: 'Default Tenant',
          role: 'tenant_admin'
        }
      ]
    });

    await app.close();
  });

  it('returns 401 when not authenticated', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/me'
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: 'UNAUTHORIZED'
    });

    await app.close();
  });

  it('does not execute authenticated response logic when unauthenticated', async () => {
    const getAuthContext = vi.fn(async () => null);
    const app = buildApp({ getAuthContext });

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer token' }
    });

    expect(getAuthContext).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('');

    await app.close();
  });
});
