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

const cellOccupancyRows = [
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    cell_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    external_code: 'PALLET-001',
    container_type: 'pallet',
    container_status: 'active',
    placed_at: '2026-03-13T09:15:00.000Z'
  },
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    cell_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    container_id: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
    external_code: null,
    container_type: 'tote',
    container_status: 'quarantined',
    placed_at: '2026-03-13T10:15:00.000Z'
  }
];

const inventoryItemRows = [
  {
    id: 'e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c',
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    item_ref: 'ITEM-001',
    quantity: 5,
    uom: 'pcs',
    created_at: '2026-03-13T11:15:00.000Z',
    created_by: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d'
  }
];

const containerStorageSnapshotRows = [
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    external_code: 'PALLET-001',
    container_type: 'pallet',
    container_status: 'active',
    item_ref: 'ITEM-001',
    quantity: 5,
    uom: 'pcs'
  },
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    external_code: 'PALLET-001',
    container_type: 'pallet',
    container_status: 'active',
    item_ref: 'ITEM-002',
    quantity: 3,
    uom: 'pcs'
  },
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    container_id: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
    external_code: null,
    container_type: 'tote',
    container_status: 'quarantined',
    item_ref: null,
    quantity: null,
    uom: null
  }
];

const cellStorageSnapshotRows = [
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    cell_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    external_code: 'PALLET-001',
    container_type: 'pallet',
    container_status: 'active',
    placed_at: '2026-03-13T09:15:00.000Z',
    item_ref: 'ITEM-001',
    quantity: 5,
    uom: 'pcs'
  },
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    cell_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    container_id: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
    external_code: null,
    container_type: 'tote',
    container_status: 'quarantined',
    placed_at: '2026-03-13T10:15:00.000Z',
    item_ref: null,
    quantity: null,
    uom: null
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
            eq: vi.fn(async () => ({
              data: [
                {
                  id: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
                  floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
                  version_no: 3,
                  state: 'published',
                  published_at: '2026-03-07T12:00:00.000Z'
                }
              ],
              error: null
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

      if (table === 'cell_occupancy_v') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_column: string, value: string) => ({
              order: vi.fn(async () => ({
                data: cellOccupancyRows.filter((row) => row.cell_id === value),
                error: null
              }))
            }))
          }))
        };
      }

      if (table === 'container_storage_snapshot_v') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_column: string, value: string) => Promise.resolve({
              data: containerStorageSnapshotRows.filter((row) => row.container_id === value),
              error: null
            }))
          }))
        };
      }

      if (table === 'cell_storage_snapshot_v') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_column: string, value: string) => ({
              order: vi.fn(async () => ({
                data: cellStorageSnapshotRows.filter((row) => row.cell_id === value),
                error: null
              }))
            }))
          }))
        };
      }

      if (table === 'inventory_items') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_column: string, value: string) => ({
              order: vi.fn(async () => ({
                data: inventoryItemRows.filter((row) => row.container_id === value),
                error: null
              }))
            }))
          })),
          insert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'cbb1e2b2-c41a-42ec-9a17-4555cfe2cb85',
                  tenant_id: payload.tenant_id,
                  container_id: payload.container_id,
                  item_ref: payload.item_ref,
                  quantity: payload.quantity,
                  uom: payload.uom,
                  created_at: '2026-03-13T12:30:00.000Z',
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
          eq: vi.fn(async () => ({ data: [], error: null })),
          in: vi.fn(async () => ({ data: [], error: null })),
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

function createFloorWorkspaceSupabaseStub() {
  const draftVersionId = '11111111-1111-4111-8111-111111111111';
  const publishedVersionId = '22222222-2222-4222-8222-222222222222';
  const draftRackId = '33333333-3333-4333-8333-333333333333';
  const publishedRackId = '44444444-4444-4444-8444-444444444444';
  const draftFaceId = '55555555-5555-4555-8555-555555555555';
  const publishedFaceId = '66666666-6666-4666-8666-666666666666';
  const draftSectionId = '77777777-7777-4777-8777-777777777777';
  const publishedSectionId = '88888888-8888-4888-8888-888888888888';

  return {
    from: vi.fn((table: string) => {
      if (table === 'layout_versions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                {
                  id: draftVersionId,
                  floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
                  version_no: 4,
                  state: 'draft',
                  published_at: null
                },
                {
                  id: publishedVersionId,
                  floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
                  version_no: 3,
                  state: 'published',
                  published_at: '2026-03-08T12:00:00.000Z'
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
            eq: vi.fn((_column: string, layoutVersionId: string) =>
              Promise.resolve({
                data:
                  layoutVersionId === draftVersionId
                    ? [
                        {
                          id: draftRackId,
                          layout_version_id: draftVersionId,
                          display_code: 'D01',
                          kind: 'single',
                          axis: 'NS',
                          x: 10,
                          y: 20,
                          total_length: 12,
                          depth: 1.2,
                          rotation_deg: 0
                        }
                      ]
                    : [
                        {
                          id: publishedRackId,
                          layout_version_id: publishedVersionId,
                          display_code: 'P01',
                          kind: 'single',
                          axis: 'WE',
                          x: 30,
                          y: 40,
                          total_length: 14,
                          depth: 1.4,
                          rotation_deg: 90
                        }
                      ],
                error: null
              })
            )
          }))
        };
      }

      if (table === 'rack_faces') {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_column: string, rackIds: string[]) =>
              Promise.resolve({
                data: rackIds.includes(draftRackId)
                  ? [
                      {
                        id: draftFaceId,
                        rack_id: draftRackId,
                        side: 'A',
                        enabled: true,
                        slot_numbering_direction: 'ltr',
                        is_mirrored: false,
                        mirror_source_face_id: null,
                        face_length: null
                      }
                    ]
                  : [
                      {
                        id: publishedFaceId,
                        rack_id: publishedRackId,
                        side: 'A',
                        enabled: true,
                        slot_numbering_direction: 'ltr',
                        is_mirrored: false,
                        mirror_source_face_id: null,
                        face_length: null
                      }
                    ],
                error: null
              })
            )
          }))
        };
      }

      if (table === 'rack_sections') {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_column: string, faceIds: string[]) =>
              Promise.resolve({
                data: faceIds.includes(draftFaceId)
                  ? [
                      {
                        id: draftSectionId,
                        rack_face_id: draftFaceId,
                        ordinal: 1,
                        length: 12
                      }
                    ]
                  : [
                      {
                        id: publishedSectionId,
                        rack_face_id: publishedFaceId,
                        ordinal: 1,
                        length: 14
                      }
                    ],
                error: null
              })
            )
          }))
        };
      }

      if (table === 'rack_levels') {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_column: string, sectionIds: string[]) =>
              Promise.resolve({
                data: sectionIds.includes(draftSectionId)
                  ? [
                      {
                        id: '99999999-9999-4999-8999-999999999999',
                        rack_section_id: draftSectionId,
                        ordinal: 1,
                        slot_count: 2
                      }
                    ]
                  : [
                      {
                        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                        rack_section_id: publishedSectionId,
                        ordinal: 1,
                        slot_count: 3
                      }
                    ],
                error: null
              })
            )
          }))
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
          in: vi.fn(async () => ({ data: [], error: null })),
          limit: vi.fn(async () => ({ data: [], error: null }))
        }))
      };
    }),
    rpc: vi.fn()
  };
}

function createRackSectionSlotStorageSupabaseStub() {
  const cellIds = [
    '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce'
  ];

  return {
    from: vi.fn((table: string) => {
      if (table === 'cells') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_column: string, value: string) => ({
              eq: vi.fn((_nextColumn: string, slotNo: number) => Promise.resolve({
                data: value === 'd208453f-555a-40d0-b4bf-f1e6a93a7752' && slotNo === 1
                  ? cellIds.map((id) => ({ id }))
                  : [],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === 'cell_storage_snapshot_v') {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_column: string, ids: string[]) => ({
              order: vi.fn(async () => ({
                data: cellStorageSnapshotRows.filter((row) => ids.includes(row.cell_id)),
                error: null
              }))
            }))
          }))
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
          in: vi.fn(async () => ({ data: [], error: null })),
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

  it('returns active container occupancy for a cell', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/cells/216f2dd6-8f17-4de4-aaba-657f9e0e1398/containers',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-03-13T09:15:00.000Z'
      },
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        containerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
        externalCode: null,
        containerType: 'tote',
        containerStatus: 'quarantined',
        placedAt: '2026-03-13T10:15:00.000Z'
      }
    ]);

    await app.close();
  });

  it('returns resolved storage snapshot for a container with multiple items', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/storage',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        itemRef: 'ITEM-001',
        quantity: 5,
        uom: 'pcs'
      },
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        itemRef: 'ITEM-002',
        quantity: 3,
        uom: 'pcs'
      }
    ]);

    await app.close();
  });

  it('keeps empty containers representable in the storage snapshot', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/containers/4f8a33c1-c803-4515-b8d4-0144f788e5d2/storage',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        containerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
        externalCode: null,
        containerType: 'tote',
        containerStatus: 'quarantined',
        itemRef: null,
        quantity: null,
        uom: null
      }
    ]);

    await app.close();
  });

  it('returns resolved storage snapshot for a cell', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/cells/216f2dd6-8f17-4de4-aaba-657f9e0e1398/storage',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-03-13T09:15:00.000Z',
        itemRef: 'ITEM-001',
        quantity: 5,
        uom: 'pcs'
      },
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        containerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
        externalCode: null,
        containerType: 'tote',
        containerStatus: 'quarantined',
        placedAt: '2026-03-13T10:15:00.000Z',
        itemRef: null,
        quantity: null,
        uom: null
      }
    ]);

    await app.close();
  });

  it('returns [] for a valid empty cell storage snapshot', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/cells/00000000-0000-0000-0000-000000000000/storage',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);

    await app.close();
  });

  it('treats non-uuid rack section ids as unpublished slot storage', async () => {
    const supabase = createRackSectionSlotStorageSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/rack-sections/sec-a-1-216f2dd6-8f17-4de4-aaba-657f9e0e1398/slots/1/storage',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      published: false,
      rows: []
    });
    expect(supabase.from).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns slot storage rows for a published rack section slot', async () => {
    const supabase = createRackSectionSlotStorageSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/rack-sections/d208453f-555a-40d0-b4bf-f1e6a93a7752/slots/1/storage',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      published: true,
      rows: [
        {
          tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
          cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
          containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
          externalCode: 'PALLET-001',
          containerType: 'pallet',
          containerStatus: 'active',
          placedAt: '2026-03-13T09:15:00.000Z',
          itemRef: 'ITEM-001',
          quantity: 5,
          uom: 'pcs'
        },
        {
          tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
          cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
          containerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
          externalCode: null,
          containerType: 'tote',
          containerStatus: 'quarantined',
          placedAt: '2026-03-13T10:15:00.000Z',
          itemRef: null,
          quantity: null,
          uom: null
        }
      ]
    });

    await app.close();
  });

  it('returns current inventory content for a container', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/inventory',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: 'e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c',
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        itemRef: 'ITEM-001',
        quantity: 5,
        uom: 'pcs',
        createdAt: '2026-03-13T11:15:00.000Z',
        createdBy: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d'
      }
    ]);

    await app.close();
  });

  it('creates current inventory content inside a container', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/inventory',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        itemRef: 'ITEM-002',
        quantity: 3,
        uom: 'pcs'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      itemRef: 'ITEM-002',
      quantity: 3,
      uom: 'pcs'
    });

    await app.close();
  });

  it('rejects invalid current inventory content payloads before insert', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/inventory',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        itemRef: 'ITEM-002',
        quantity: -1,
        uom: 'pcs'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });

    await app.close();
  });

  it('maps duplicate current inventory content to conflict', async () => {
    const supabase = createSupabaseStub();
    supabase.from = vi.fn((table: string) => {
      if (table === 'inventory_items') {
        return {
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
        };
      }

      return createSupabaseStub().from(table);
    });

    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/inventory',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        itemRef: 'ITEM-001',
        quantity: 7,
        uom: 'pcs'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'CONFLICT'
    });

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

  it('returns a floor workspace with both active draft and latest published layout', async () => {
    const supabase = createFloorWorkspaceSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/floors/5e5236d0-316b-443a-a4d8-f03cdd79f670/workspace',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
      activeDraft: {
        layoutVersionId: '11111111-1111-4111-8111-111111111111',
        floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
        state: 'draft',
        rackIds: ['33333333-3333-4333-8333-333333333333'],
        racks: expect.any(Object)
      },
      latestPublished: {
        layoutVersionId: '22222222-2222-4222-8222-222222222222',
        floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
        state: 'published',
        rackIds: ['44444444-4444-4444-8444-444444444444'],
        racks: expect.any(Object)
      }
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

  it('returns a floor workspace with null draft when only published layout exists', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/floors/5e5236d0-316b-443a-a4d8-f03cdd79f670/workspace',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
      activeDraft: null,
      latestPublished: {
        layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
        floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
        state: 'published',
        rackIds: [],
        racks: {}
      }
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

  it('returns an empty active draft when the draft has no racks yet', async () => {
    const supabase = {
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
      }),
      rpc: vi.fn()
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
    expect(response.json()).toEqual({
      layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
      floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
      state: 'draft',
      rackIds: [],
      racks: {}
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

  it('places a container into a published cell', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'place_container') {
        return {
          data: {
            action: 'placed',
            containerId: args.container_uuid,
            cellId: args.cell_uuid,
            placementId: '2c6f2861-9e5c-4ef8-abfa-c17709cf9194',
            occurredAt: '2026-03-13T12:15:00.000Z'
          },
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
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/place',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      action: 'placed',
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
      placementId: '2c6f2861-9e5c-4ef8-abfa-c17709cf9194',
      occurredAt: '2026-03-13T12:15:00.000Z'
    });
    expect(supabase.rpc).toHaveBeenCalledWith('place_container', {
      container_uuid: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      cell_uuid: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
      actor_uuid: authContext.user.id
    });

    await app.close();
  });

  it('maps place-container conflicts clearly', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'place_container') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'CONTAINER_ALREADY_PLACED'
          }
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
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/place',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'PLACEMENT_CONFLICT',
      message: 'Container is already placed.'
    });

    await app.close();
  });

  it('removes a currently placed container', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'remove_container') {
        return {
          data: {
            action: 'removed',
            containerId: args.container_uuid,
            cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
            placementId: '2c6f2861-9e5c-4ef8-abfa-c17709cf9194',
            occurredAt: '2026-03-13T12:30:00.000Z'
          },
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
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/remove',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      action: 'removed',
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
      placementId: '2c6f2861-9e5c-4ef8-abfa-c17709cf9194',
      occurredAt: '2026-03-13T12:30:00.000Z'
    });

    await app.close();
  });

  it('maps remove-container not-placed conflicts clearly', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'remove_container') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'CONTAINER_NOT_PLACED'
          }
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
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/remove',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'PLACEMENT_CONFLICT',
      message: 'Container is not currently placed.'
    });

    await app.close();
  });

  it('moves a container atomically between cells', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'move_container') {
        return {
          data: {
            action: 'moved',
            containerId: args.container_uuid,
            fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
            toCellId: args.target_cell_uuid,
            previousPlacementId: '7f43dfa8-6691-4477-8c30-e53452df8f5f',
            placementId: '2c6f2861-9e5c-4ef8-abfa-c17709cf9194',
            occurredAt: '2026-03-13T12:45:00.000Z'
          },
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
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/move',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        targetCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      action: 'moved',
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
      toCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce',
      previousPlacementId: '7f43dfa8-6691-4477-8c30-e53452df8f5f',
      placementId: '2c6f2861-9e5c-4ef8-abfa-c17709cf9194',
      occurredAt: '2026-03-13T12:45:00.000Z'
    });
    expect(supabase.rpc).toHaveBeenCalledWith('move_container', {
      container_uuid: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      target_cell_uuid: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce',
      actor_uuid: authContext.user.id
    });

    await app.close();
  });

  it.each([
    ['not placed', 'CONTAINER_NOT_PLACED', 'PLACEMENT_CONFLICT', 'Container is not currently placed.'],
    ['invalid cell', 'TARGET_CELL_NOT_PUBLISHED', 'INVALID_TARGET_CELL', 'Target cell is not in a published layout.'],
    ['same target cell', 'CONTAINER_ALREADY_IN_TARGET_CELL', 'PLACEMENT_CONFLICT', 'Container is already in the target cell.']
  ])('maps move-container errors clearly when %s', async (_label, dbMessage, apiCode, apiMessage) => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'move_container') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: dbMessage
          }
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
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/move',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        targetCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: apiCode,
      message: apiMessage
    });

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
