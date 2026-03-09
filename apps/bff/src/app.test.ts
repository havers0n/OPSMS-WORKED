import { describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildApp } from './app.js';

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

function createSupabaseStub() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'sites') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [{ id: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d', code: 'MAIN', name: 'Main Site', timezone: 'Asia/Jerusalem' }],
              error: null
            })),
            limit: vi.fn(async () => ({
              data: [],
              error: null
            }))
          })),
          insert: vi.fn((payload: unknown) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: '1f7eec3d-7300-47ff-b5a2-164e31422d22', payload },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === 'layout_versions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({
                    data: [
                      {
                        id: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
                        floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
                        version_no: 3,
                        published_at: '2026-03-07T12:00:00.000Z'
                      }
                    ],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        };
      }

      if (table === 'cells') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    { address: '03-A.01.01.01', address_sort_key: '0003-A-01-01-01' },
                    { address: '03-A.01.01.02', address_sort_key: '0003-A-01-01-02' }
                  ],
                  count: 8,
                  error: null
                }))
              }))
            }))
          }))
        };
      }

      return {
        select: vi.fn(() => ({
          limit: vi.fn(async () => ({ data: [], error: null }))
        }))
      };
    }),
    rpc: vi.fn()
  };
}

describe('buildApp', () => {
  it('exposes liveness metadata', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: '@wos/bff'
    });
    expect(new Date(response.json().time).toString()).not.toBe('Invalid Date');

    await app.close();
  });

  it('returns 401 when bearer token is missing', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/sites'
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.json()).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Missing bearer token.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('returns validated sites for an authenticated request', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sites',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
        code: 'MAIN',
        name: 'Main Site',
        timezone: 'Asia/Jerusalem'
      }
    ]);

    await app.close();
  });

  it('returns the current workspace session contract', async () => {
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => createSupabaseStub() as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: {
        authorization: 'Bearer token'
      }
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

  it('returns the latest published layout summary for a floor', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/floors/5e5236d0-316b-443a-a4d8-f03cdd79f670/published-layout',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
      floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
      versionNo: 3,
      publishedAt: '2026-03-07T12:00:00.000Z',
      cellCount: 8,
      sampleAddresses: ['03-A.01.01.01', '03-A.01.01.02']
    });

    await app.close();
  });

  it('exposes readiness when the db probe succeeds', async () => {
    const healthSupabase = createSupabaseStub();
    const app = buildApp({
      getHealthSupabase: vi.fn(() => healthSupabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ready'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ready',
      service: '@wos/bff',
      checks: {
        supabase: 'ok'
      }
    });

    await app.close();
  });

  it('rejects invalid create-site payloads with a structured error', async () => {
    const app = buildApp({
      getAuthContext: vi.fn(async (_request: FastifyRequest, reply: FastifyReply) => {
        return authContext as never;
      }),
      getUserSupabase: vi.fn(() => createSupabaseStub() as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        code: '',
        name: 'Main Site',
        timezone: 'Asia/Jerusalem'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('maps Supabase constraint errors to stable api codes', async () => {
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint'
              }
            }))
          }))
        }))
      }))
    };

    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        code: 'MAIN',
        name: 'Main Site',
        timezone: 'Asia/Jerusalem'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'CONFLICT',
      message: 'Resource already exists.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('creates a site inside the active tenant workspace', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/sites',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        code: 'MAIN',
        name: 'Main Site',
        timezone: 'Asia/Jerusalem'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: '1f7eec3d-7300-47ff-b5a2-164e31422d22'
    });

    const siteApi = supabase.from.mock.results.find((result) => typeof result.value?.insert === 'function')?.value;
    expect(siteApi.insert).toHaveBeenCalledWith({
      tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      code: 'MAIN',
      name: 'Main Site',
      timezone: 'Asia/Jerusalem'
    });

    await app.close();
  });

  it('accepts save-layout payloads that match the web RPC contract', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'save_layout_draft') {
        return {
          data: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
          error: null
        };
      }

      return { data: null, error: null };
    });

    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/layout-drafts/save',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        layoutDraft: {
          layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
          racks: [
            {
              id: 'f38510b5-d5c5-4657-8d7e-a4154cb74951',
              displayCode: 'R01',
              kind: 'single',
              axis: 'horizontal',
              x: 10,
              y: 20,
              totalLength: 2700,
              depth: 1100,
              rotationDeg: 0,
              faces: [
                {
                  id: 'c4873dd5-bb30-48b9-9558-4effcab5cf8d',
                  side: 'A',
                  enabled: true,
                  anchor: 'left',
                  slotNumberingDirection: 'asc',
                  isMirrored: false,
                  mirrorSourceFaceId: null,
                  sections: [
                    {
                      id: 'd208453f-555a-40d0-b4bf-f1e6a93a7752',
                      ordinal: 1,
                      length: 2700,
                      levels: [
                        {
                          id: '342d905f-2a71-4812-828f-4b0d1acc4a53',
                          ordinal: 1,
                          slotCount: 2
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d'
    });
    expect(supabase.rpc).toHaveBeenCalledWith('save_layout_draft', {
      layout_payload: {
        layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
        racks: [
          expect.objectContaining({
            id: 'f38510b5-d5c5-4657-8d7e-a4154cb74951'
          })
        ]
      },
      actor_uuid: authContext.user.id
    });

    await app.close();
  });
});
