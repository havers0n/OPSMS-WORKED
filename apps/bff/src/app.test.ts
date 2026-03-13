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

const containerTypeRows = [
  {
    id: 'a8c1ab0f-2917-4ae0-b332-fd50f39db123',
    code: 'bin',
    description: 'Storage bin'
  },
  {
    id: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
    code: 'pallet',
    description: 'Standard pallet'
  }
];

const containerRows = [
  {
    id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    external_code: 'PALLET-001',
    container_type_id: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
    status: 'active',
    created_at: '2026-03-13T09:15:00.000Z',
    created_by: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d'
  }
];

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

      if (table === 'container_types') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: containerTypeRows,
              error: null
            }))
          }))
        };
      }

      if (table === 'containers') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: containerRows,
              error: null
            })),
            eq: vi.fn((_column: string, value: string) => ({
              maybeSingle: vi.fn(async () => ({
                data: containerRows.find((row) => row.id === value) ?? null,
                error: null
              }))
            }))
          })),
          insert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'c7d4fed6-5d22-4562-bf6b-d4e863d43d70',
                  tenant_id: payload.tenant_id,
                  external_code: payload.external_code ?? null,
                  container_type_id: payload.container_type_id,
                  status: 'active',
                  created_at: '2026-03-13T12:00:00.000Z',
                  created_by: payload.created_by ?? null
                },
                error: null
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

function createValidSaveLayoutDraftPayload() {
  return {
    layoutDraft: {
      layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
      racks: [
        {
          id: 'f38510b5-d5c5-4657-8d7e-a4154cb74951',
          displayCode: 'R01',
          kind: 'single',
          axis: 'NS',
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
              faceLength: 4.5,
              slotNumberingDirection: 'ltr',
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
  };
}

function createActiveDraftSupabaseStub() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'layout_versions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                {
                  id: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
                  floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
                  version_no: 3,
                  state: 'draft'
                }
              ],
              error: null
            }))
          }))
        };
      }

      if (table === 'racks') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                {
                  id: 'f38510b5-d5c5-4657-8d7e-a4154cb74951',
                  layout_version_id: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
                  display_code: 'R01',
                  kind: 'single',
                  axis: 'NS',
                  x: 10,
                  y: 20,
                  total_length: 2700,
                  depth: 1100,
                  rotation_deg: 0
                }
              ],
              error: null
            }))
          }))
        };
      }

      if (table === 'rack_faces') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  id: 'c4873dd5-bb30-48b9-9558-4effcab5cf8d',
                  rack_id: 'f38510b5-d5c5-4657-8d7e-a4154cb74951',
                  side: 'A',
                  enabled: true,
                  slot_numbering_direction: 'ltr',
                  is_mirrored: false,
                  mirror_source_face_id: null,
                  face_length: null
                }
              ],
              error: null
            }))
          }))
        };
      }

      if (table === 'rack_sections') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  id: 'd208453f-555a-40d0-b4bf-f1e6a93a7752',
                  rack_face_id: 'c4873dd5-bb30-48b9-9558-4effcab5cf8d',
                  ordinal: 1,
                  length: 2700
                }
              ],
              error: null
            }))
          }))
        };
      }

      if (table === 'rack_levels') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  id: '342d905f-2a71-4812-828f-4b0d1acc4a53',
                  rack_section_id: 'd208453f-555a-40d0-b4bf-f1e6a93a7752',
                  ordinal: 1,
                  slot_count: 2
                }
              ],
              error: null
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

  it('returns supported container types', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/container-types',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: 'a8c1ab0f-2917-4ae0-b332-fd50f39db123',
        code: 'bin',
        description: 'Storage bin'
      },
      {
        id: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
        code: 'pallet',
        description: 'Standard pallet'
      }
    ]);

    await app.close();
  });

  it('returns tenant-scoped containers', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/containers',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        externalCode: 'PALLET-001',
        containerTypeId: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
        status: 'active',
        createdAt: '2026-03-13T09:15:00.000Z',
        createdBy: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d'
      }
    ]);

    await app.close();
  });

  it('returns a single container by id', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      externalCode: 'PALLET-001',
      status: 'active'
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

  it('returns the active draft with explicit lifecycle state', async () => {
    const supabase = createActiveDraftSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/floors/5e5236d0-316b-443a-a4d8-f03cdd79f670/layout-draft',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
      floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
      state: 'draft',
      rackIds: ['f38510b5-d5c5-4657-8d7e-a4154cb74951'],
      racks: expect.any(Object)
    });

    await app.close();
  });

  it('returns null when no active draft exists for the floor', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'layout_versions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [],
                error: null
              }))
            }))
          };
        }

        return {
          select: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [], error: null }))
          }))
        };
      })
    };

    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/floors/5e5236d0-316b-443a-a4d8-f03cdd79f670/layout-draft',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();

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

  it('creates a container inside the active tenant workspace', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        containerTypeId: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
        externalCode: 'PALLET-002'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: 'c7d4fed6-5d22-4562-bf6b-d4e863d43d70',
      tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      externalCode: 'PALLET-002',
      containerTypeId: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
      status: 'active',
      createdAt: '2026-03-13T12:00:00.000Z',
      createdBy: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d'
    });

    const containerApi = supabase.from.mock.results.find((result) => typeof result.value?.insert === 'function')?.value;
    expect(containerApi.insert).toHaveBeenCalledWith({
      tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      container_type_id: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
      external_code: 'PALLET-002',
      created_by: authContext.user.id
    });

    await app.close();
  });

  it('rejects invalid create-container payloads with a structured error', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        containerTypeId: 'not-a-uuid',
        externalCode: ''
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });
    expect(supabase.from).not.toHaveBeenCalledWith('containers');

    await app.close();
  });

  it('accepts save-layout payloads with optional rack-face faceLength', async () => {
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
      payload: createValidSaveLayoutDraftPayload()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d'
    });
    const savePayload = supabase.rpc.mock.calls[0]?.[1]?.layout_payload as {
      racks: Array<{ faces: Array<Record<string, unknown>> }>;
    };
    expect(savePayload.racks[0]?.faces[0]).not.toHaveProperty('anchor');
    expect(savePayload.racks[0]?.faces[0]).toHaveProperty('faceLength', 4.5);
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

  it.each([
    ['kind', (payload: ReturnType<typeof createValidSaveLayoutDraftPayload>) => { payload.layoutDraft.racks[0].kind = 'double'; }],
    ['axis', (payload: ReturnType<typeof createValidSaveLayoutDraftPayload>) => { payload.layoutDraft.racks[0].axis = 'horizontal'; }],
    ['rotationDeg', (payload: ReturnType<typeof createValidSaveLayoutDraftPayload>) => { payload.layoutDraft.racks[0].rotationDeg = 45; }],
    ['side', (payload: ReturnType<typeof createValidSaveLayoutDraftPayload>) => { payload.layoutDraft.racks[0].faces[0].side = 'front'; }],
    ['slotNumberingDirection', (payload: ReturnType<typeof createValidSaveLayoutDraftPayload>) => { payload.layoutDraft.racks[0].faces[0].slotNumberingDirection = 'left-to-right'; }]
  ])('rejects invalid save-layout payload %s before RPC', async (_field, mutatePayload) => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const payload = createValidSaveLayoutDraftPayload();
    mutatePayload(payload);

    const response = await app.inject({
      method: 'POST',
      url: '/api/layout-drafts/save',
      headers: {
        authorization: 'Bearer token'
      },
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });
    expect(supabase.rpc).not.toHaveBeenCalled();

    await app.close();
  });
});
