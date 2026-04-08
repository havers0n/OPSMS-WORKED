import { describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildApp } from './app.js';
import { LocationNotFoundError } from './features/placement/errors.js';

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
    description: 'Storage bin',
    supports_storage: true,
    supports_picking: true
  },
  {
    id: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
    code: 'pallet',
    description: 'Standard pallet',
    supports_storage: true,
    supports_picking: true
  },
  // tote: pick-only, used to test CONTAINER_TYPE_NOT_STORAGE_CAPABLE
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    code: 'tote',
    description: 'Reusable tote',
    supports_storage: false,
    supports_picking: true
  },
  // storage-only type (hypothetical): used to test CONTAINER_TYPE_NOT_PICK_CAPABLE
  {
    id: 'c0000000-0000-4000-8000-000000000002',
    code: 'rack_pallet',
    description: 'Fixed rack pallet',
    supports_storage: true,
    supports_picking: false
  }
];

const containerRows = [
  {
    id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    system_code: 'CNT-000101',
    external_code: 'PALLET-001',
    container_type_id: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
    status: 'active',
    operational_role: 'storage',
    created_at: '2026-03-13T09:15:00.000Z',
    created_by: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d'
  },
  // pick-role container for filtering tests
  {
    id: 'f0000000-0000-4000-8000-000000000001',
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    system_code: 'CNT-000102',
    external_code: 'TOTE-001',
    container_type_id: 'c0000000-0000-4000-8000-000000000001',
    status: 'active',
    operational_role: 'pick',
    created_at: '2026-03-14T08:00:00.000Z',
    created_by: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d'
  }
];

const cellOccupancyRows = [
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
    location_id: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
    location_code: '03-A.01.02.01',
    location_type: 'rack_slot',
    capacity_mode: 'single_container',
    location_status: 'active',
    cell_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    external_code: 'PALLET-001',
    container_type: 'pallet',
    container_status: 'active',
    placed_at: '2026-03-13T09:15:00.000Z'
  },
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
    location_id: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
    location_code: '03-A.01.02.01',
    location_type: 'rack_slot',
    capacity_mode: 'single_container',
    location_status: 'active',
    cell_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    container_id: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
    external_code: null,
    container_type: 'tote',
    container_status: 'quarantined',
    placed_at: '2026-03-13T10:15:00.000Z'
  }
];

const productRows = [
  {
    id: '8c393d26-d4d8-4e84-b772-c1f7b9d8c111',
    source: 'artos.co.il',
    external_product_id: '19917',
    sku: '7290122461749',
    name: 'USB-C Wired Earbuds',
    permalink: 'https://artos.co.il/product/19917',
    image_urls: ['https://artos.co.il/wp-content/uploads/2026/01/in-ear-soumd-pic@4x-8-scaled.png'],
    image_files: ['artos_assets/images/19917_00_07a809fd58.png'],
    is_active: true,
    created_at: '2026-01-16T16:19:05.000Z',
    updated_at: '2026-01-16T16:19:05.000Z'
  },
  {
    id: '9f4d6839-c1a9-4820-b057-f0da8e92c222',
    source: 'artos.co.il',
    external_product_id: '19898',
    sku: '7290122462302',
    name: 'Poker Set 300 Chips',
    permalink: 'https://artos.co.il/product/19898',
    image_urls: ['https://artos.co.il/wp-content/uploads/2026/01/poker-set-1.png'],
    image_files: ['artos_assets/images/19898_00_72ebdbaba2.png'],
    is_active: true,
    created_at: '2026-01-16T16:19:05.000Z',
    updated_at: '2026-01-16T16:19:05.000Z'
  }
];

const productResponses = productRows.map((row) => ({
  id: row.id,
  source: row.source,
  externalProductId: row.external_product_id,
  sku: row.sku,
  name: row.name,
  permalink: row.permalink,
  imageUrls: row.image_urls,
  imageFiles: row.image_files,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at
}));

const sortedProductResponses = [...productResponses].sort((left, right) => left.name.localeCompare(right.name));

const locationRows = [
  {
    id: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
    code: '03-A.01.02.01',
    floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
    geometry_slot_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    location_type: 'rack_slot',
    capacity_mode: 'single_container',
    status: 'active'
  },
  {
    id: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
    code: '03-A.01.02.02',
    floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
    geometry_slot_id: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce',
    location_type: 'rack_slot',
    capacity_mode: 'single_container',
    status: 'active'
  }
];

const activePlacementRows = [
  {
    id: '7f43dfa8-6691-4477-8c30-e53452df8f5f',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    cell_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
  }
];

const inventoryUnitRows = [
  {
    id: 'e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c',
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    product_id: productRows[0].id,
    quantity: 5,
    uom: 'pcs',
    lot_code: null,
    serial_no: null,
    expiry_date: null,
    status: 'available' as const,
    created_at: '2026-03-13T11:15:00.000Z',
    updated_at: '2026-03-13T11:15:00.000Z',
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
    item_ref: `product:${productRows[0].id}`,
    product_id: productRows[0].id,
    quantity: 5,
    uom: 'pcs'
  },
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    external_code: 'PALLET-001',
    container_type: 'pallet',
    container_status: 'active',
    item_ref: `product:${productRows[1].id}`,
    product_id: productRows[1].id,
    quantity: 3,
    uom: 'pcs'
  },
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    external_code: 'PALLET-001',
    container_type: 'pallet',
    container_status: 'active',
    item_ref: 'LEGACY-REF-42',
    product_id: null,
    quantity: 2,
    uom: 'pcs'
  },
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    container_id: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
    external_code: null,
    container_type: 'tote',
    container_status: 'quarantined',
    item_ref: null,
    product_id: null,
    quantity: null,
    uom: null
  }
];

const cellStorageSnapshotRows = [
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
    location_id: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
    location_code: '03-A.01.02.01',
    location_type: 'rack_slot',
    capacity_mode: 'single_container',
    location_status: 'active',
    cell_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    external_code: 'PALLET-001',
    container_type: 'pallet',
    container_status: 'active',
    placed_at: '2026-03-13T09:15:00.000Z',
    item_ref: `product:${productRows[0].id}`,
    product_id: productRows[0].id,
    quantity: 5,
    uom: 'pcs'
  },
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
    location_id: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
    location_code: '03-A.01.02.01',
    location_type: 'rack_slot',
    capacity_mode: 'single_container',
    location_status: 'active',
    cell_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    external_code: 'PALLET-001',
    container_type: 'pallet',
    container_status: 'active',
    placed_at: '2026-03-13T09:15:00.000Z',
    item_ref: 'LEGACY-REF-42',
    product_id: null,
    quantity: 2,
    uom: 'pcs'
  },
  {
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
    location_id: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
    location_code: '03-A.01.02.01',
    location_type: 'rack_slot',
    capacity_mode: 'single_container',
    location_status: 'active',
    cell_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    container_id: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
    external_code: null,
    container_type: 'tote',
    container_status: 'quarantined',
    placed_at: '2026-03-13T10:15:00.000Z',
    item_ref: null,
    product_id: null,
    quantity: null,
    uom: null
  }
];

const publishedCellRows = [
  {
    id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
    layout_version_id: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
    rack_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    rack_face_id: 'a18c3f84-8b5e-4458-a90f-f7ce15c80110',
    rack_section_id: 'd208453f-555a-40d0-b4bf-f1e6a93a7752',
    rack_level_id: '6f684566-01dc-4c36-b1ea-5c795edbd82c',
    slot_no: 1,
    address: '03-A.01.01.01',
    address_sort_key: '0003-A-01-01-01',
    cell_code: '03-A.01.01.01',
    x: 10,
    y: 20,
    status: 'active' as const
  },
  {
    id: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce',
    layout_version_id: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
    rack_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    rack_face_id: 'a18c3f84-8b5e-4458-a90f-f7ce15c80110',
    rack_section_id: 'd208453f-555a-40d0-b4bf-f1e6a93a7752',
    rack_level_id: '7ccdad48-7dc0-4f27-9794-1c7e59d70a40',
    slot_no: 1,
    address: '03-A.01.02.01',
    address_sort_key: '0003-A-01-02-01',
    cell_code: '03-A.01.02.01',
    x: 10,
    y: 30,
    status: 'active' as const
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
            eq: vi.fn((_column: string, value: string) => ({
              data: publishedCellRows.filter((row) => row.layout_version_id === value),
              error: null,
              order: vi.fn(() => {
                const rows = publishedCellRows.filter((row) => row.layout_version_id === value);

                return {
                  data: rows,
                  error: null,
                  limit: vi.fn(async () => ({
                    data: rows
                      .slice(0, 4)
                      .map((row) => ({
                        address: row.address,
                        address_sort_key: row.address_sort_key
                      })),
                    count: 8,
                    error: null
                  }))
                };
              }),
              maybeSingle: vi.fn(async () => ({
                data: publishedCellRows.find((row) => row.id === value) ?? null,
                error: null
              }))
            }))
          }))
        };
      }

      if (table === 'container_types') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_column: string, value: string) => ({
              maybeSingle: vi.fn(async () => ({
                data: containerTypeRows.find((row) => row.id === value) ?? null,
                error: null
              }))
            })),
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
            eq: vi.fn((column: string, value: string) => {
              const firstMatches = containerRows.filter((row) => {
                if (column === 'id') return row.id === value;
                if (column === 'tenant_id') return row.tenant_id === value;
                if (column === 'external_code') return row.external_code === value;
                if (column === 'operational_role') return row.operational_role === value;
                return false;
              });

              return {
                eq: vi.fn((nestedColumn: string, nestedValue: string) => ({
                  maybeSingle: vi.fn(async () => ({
                    data:
                      firstMatches.find((row) => {
                        if (nestedColumn === 'id') return row.id === nestedValue;
                        if (nestedColumn === 'tenant_id') return row.tenant_id === nestedValue;
                        if (nestedColumn === 'external_code') return row.external_code === nestedValue;
                        return false;
                      }) ?? null,
                    error: null
                  }))
                })),
                maybeSingle: vi.fn(async () => ({
                  data: firstMatches[0] ?? null,
                  error: null
                })),
                // Support eq(...).order(...) for filtered listAll
                order: vi.fn(async () => ({
                  data: firstMatches,
                  error: null
                }))
              };
            })
          })),
          insert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'c7d4fed6-5d22-4562-bf6b-d4e863d43d70',
                  tenant_id: payload.tenant_id,
                  system_code: 'CNT-000999',
                  external_code: payload.external_code ?? null,
                  container_type_id: payload.container_type_id,
                  status: 'active',
                  operational_role: payload.operational_role ?? 'storage',
                  created_at: '2026-03-13T12:00:00.000Z',
                  created_by: payload.created_by ?? null
                },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === 'locations') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => ({
              maybeSingle: vi.fn(async () => ({
                data:
                  locationRows.find((row) => {
                    if (column === 'geometry_slot_id') return row.geometry_slot_id === value;
                    if (column === 'id') return row.id === value;
                    return false;
                  }) ?? null,
                error: null
              }))
            }))
          }))
        };
      }

      if (table === 'active_container_locations_v') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_column: string, value: string) => ({
              maybeSingle: vi.fn(async () => ({
                data: cellOccupancyRows.find((row) => row.container_id === value) ?? null,
                error: null
              }))
            }))
          }))
        };
      }

      if (table === 'container_placements') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => ({
              is: vi.fn((_removedColumn: string, _removedValue: null) => ({
                maybeSingle: vi.fn(async () => ({
                  data:
                    activePlacementRows.find((row) => {
                      if (column === 'container_id') {
                        return row.container_id === value;
                      }

                      return false;
                    }) ?? null,
                  error: null
                }))
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
            })),
            in: vi.fn((_column: string, values: string[]) =>
              Promise.resolve({
                data: cellOccupancyRows.filter((row) => values.includes(row.cell_id)),
                error: null
              })
            )
          }))
        };
      }

      if (table === 'location_occupancy_v') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => {
              const filtered = cellOccupancyRows.filter((row) => {
                if (column === 'floor_id') return row.floor_id === value;
                if (column === 'cell_id') return row.cell_id === value;
                if (column === 'location_id') return row.location_id === value;
                return false;
              });

              return {
                order: vi.fn(async () => ({
                  data: filtered,
                  error: null
                }))
              };
            })
          }))
        };
      }

      if (table === 'container_storage_snapshot_v' || table === 'container_storage_canonical_v') {
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

      if (table === 'location_storage_snapshot_v' || table === 'location_storage_canonical_v') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => ({
              order: vi.fn(async () => ({
                data: cellStorageSnapshotRows.filter((row) => {
                  if (column === 'cell_id') return row.cell_id === value;
                  if (column === 'location_id') return row.location_id === value;
                  return false;
                }),
                error: null
              }))
            })),
            in: vi.fn((_column: string, values: string[]) => ({
              order: vi.fn(async () => ({
                data: cellStorageSnapshotRows.filter((row) => values.includes(row.cell_id)),
                error: null
              }))
            }))
          }))
        };
      }

      if (table === 'products') {
        return {
          select: vi.fn((_columns?: string, options?: { count?: string; head?: boolean }) => {
            let matches = [...productRows];

            const builder = {
              eq: vi.fn((column: string, value: string | boolean) => {
                matches = matches.filter((row) => {
                  if (column === 'id') return row.id === value;
                  if (column === 'is_active') return row.is_active === value;
                  return false;
                });

                return builder;
              }),
              or: vi.fn((expression: string) => {
                const needle = expression.match(/%([^%]+)%/)?.[1]?.toLowerCase() ?? '';
                matches = matches.filter((row) => {
                  const name = row.name.toLowerCase();
                  const sku = row.sku?.toLowerCase() ?? '';
                  const externalProductId = row.external_product_id.toLowerCase();
                  return (
                    name.includes(needle) ||
                    sku.includes(needle) ||
                    externalProductId.includes(needle)
                  );
                });

                return builder;
              }),
              order: vi.fn(() => ({
                range: vi.fn(async (from: number, to: number) => ({
                  data: options?.head
                    ? null
                    : [...matches]
                        .sort((left, right) => left.name.localeCompare(right.name))
                        .slice(from, to + 1),
                  count: options?.count === 'exact' ? matches.length : null,
                  error: null
                })),
                limit: vi.fn(async (count: number) => ({
                  data: options?.head
                    ? null
                    : [...matches]
                        .sort((left, right) => left.name.localeCompare(right.name))
                        .slice(0, count),
                  count: options?.count === 'exact' ? matches.length : null,
                  error: null
                }))
              })),
              range: vi.fn(async (from: number, to: number) => ({
                data: options?.head
                  ? null
                  : [...matches]
                      .sort((left, right) => left.name.localeCompare(right.name))
                      .slice(from, to + 1),
                count: options?.count === 'exact' ? matches.length : null,
                error: null
              })),
              limit: vi.fn(async (count: number) => ({
                data: options?.head
                  ? null
                  : [...matches]
                      .sort((left, right) => left.name.localeCompare(right.name))
                      .slice(0, count),
                count: options?.count === 'exact' ? matches.length : null,
                error: null
              })),
              maybeSingle: vi.fn(async () => ({
                data: matches[0] ?? null,
                error: null
              })),
              in: vi.fn((_column: string, values: string[]) =>
                Promise.resolve({
                  data: productRows.filter((row) => values.includes(row.id)),
                  error: null
                })
              )
            };

            return builder;
          })
        };
      }

      if (table === 'inventory_unit') {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'cbb1e2b2-c41a-42ec-9a17-4555cfe2cb85',
                  tenant_id: payload.tenant_id,
                  container_id: payload.container_id,
                  product_id: payload.product_id,
                  quantity: payload.quantity,
                  uom: payload.uom,
                  lot_code: null,
                  serial_no: null,
                  expiry_date: null,
                  status: 'available',
                  created_at: '2026-03-13T12:30:00.000Z',
                  updated_at: '2026-03-13T12:30:00.000Z',
                  created_by: payload.created_by ?? null
                },
                error: null
              }))
            }))
          })),
          select: vi.fn(() => ({
            eq: vi.fn((_column: string, value: string) => ({
              order: vi.fn(async () => ({
                data: inventoryUnitRows.filter((row) => row.container_id === value),
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
    rpc: vi.fn(async (fn: string, args?: Record<string, unknown>) => {
      if (fn === 'receive_inventory_unit') {
        const tenantId = typeof args?.tenant_uuid === 'string' ? args.tenant_uuid : '';
        const containerId = typeof args?.container_uuid === 'string' ? args.container_uuid : '';
        const productId = typeof args?.product_uuid === 'string' ? args.product_uuid : '';
        const quantity = typeof args?.quantity === 'number' ? args.quantity : Number.NaN;
        const uom = typeof args?.uom === 'string' ? args.uom : '';
        const actorId = typeof args?.actor_uuid === 'string' ? args.actor_uuid : null;

        const container = containerRows.find((row) => row.id === containerId && row.tenant_id === tenantId);
        if (!container) {
          return { data: null, error: { code: 'P0001', message: 'CONTAINER_NOT_FOUND' } };
        }

        if (container.status !== 'active') {
          return { data: null, error: { code: 'P0001', message: 'CONTAINER_NOT_RECEIVABLE' } };
        }

        const product = productRows.find((row) => row.id === productId);
        if (!product) {
          return { data: null, error: { code: 'P0001', message: 'PRODUCT_NOT_FOUND' } };
        }

        if (!product.is_active) {
          return { data: null, error: { code: 'P0001', message: 'PRODUCT_INACTIVE' } };
        }

        return {
          data: {
            inventoryUnit: {
              id: 'cbb1e2b2-c41a-42ec-9a17-4555cfe2cb85',
              tenant_id: tenantId,
              container_id: containerId,
              product_id: product.id,
              quantity,
              uom,
              created_at: '2026-03-13T12:30:00.000Z',
              created_by: actorId
            },
            product
          },
          error: null
        };
      }

      return { data: null, error: null };
    }) as any
  };
}

function createValidSaveLayoutDraftPayload() {
  return {
    layoutDraft: {
      layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
      draftVersion: 7,
      zones: [],
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
                  draft_version: 11,
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

      if (table === 'layout_zones') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [],
              error: null
            }))
          }))
        };
      }

      if (table === 'layout_walls') {
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
          eq: vi.fn(async () => ({ data: [], error: null })),
          in: vi.fn(async () => ({ data: [], error: null })),
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
                  draft_version: 5,
                  version_no: 4,
                  state: 'draft',
                  published_at: null
                },
                {
                  id: publishedVersionId,
                  floor_id: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
                  draft_version: null,
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

      if (table === 'layout_zones') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [],
              error: null
            }))
          }))
        };
      }

      if (table === 'layout_walls') {
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
          eq: vi.fn(async () => ({ data: [], error: null })),
          in: vi.fn(async () => ({ data: [], error: null })),
          limit: vi.fn(async () => ({ data: [], error: null }))
        }))
      };
    }),
    rpc: vi.fn(async () => ({ data: null, error: null }))
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
    const json = response.json() as Array<{ code: string; supportsStorage: boolean; supportsPicking: boolean }>;
    expect(json).toHaveLength(containerTypeRows.length);
    // spot-check the capability fields on two known types
    const bin = json.find((t) => t.code === 'bin')!;
    expect(bin.supportsStorage).toBe(true);
    expect(bin.supportsPicking).toBe(true);
    const tote = json.find((t) => t.code === 'tote')!;
    expect(tote.supportsStorage).toBe(false);
    expect(tote.supportsPicking).toBe(true);

    await app.close();
  });

  it('returns active catalog products', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: sortedProductResponses,
      total: productRows.length,
      activeTotal: productRows.filter((row) => row.is_active).length,
      limit: 50,
      offset: 0
    });

    await app.close();
  });

  it('returns paginated catalog products with counts', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/products?limit=1&offset=1',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [sortedProductResponses[1]],
      total: productRows.length,
      activeTotal: productRows.filter((row) => row.is_active).length,
      limit: 1,
      offset: 1
    });

    await app.close();
  });

  it('filters active product search by name, sku, or external id', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const bySku = await app.inject({
      method: 'GET',
      url: `/api/products/search?query=${productRows[0].sku}`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(bySku.statusCode).toBe(200);
    expect(bySku.json()).toEqual([productResponses[0]]);

    const byExternalId = await app.inject({
      method: 'GET',
      url: `/api/products/search?query=${productRows[1].external_product_id}`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(byExternalId.statusCode).toBe(200);
    expect(byExternalId.json()).toEqual([productResponses[1]]);

    await app.close();
  });

  it('returns a single catalog product by id', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/products/${productRows[0].id}`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(productResponses[0]);

    await app.close();
  });

  it('returns tenant-scoped containers (all roles when no filter)', async () => {
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
    const json = response.json() as Array<{ id: string; operationalRole: string }>;
    // Both storage and pick containers returned when no filter applied
    expect(json).toHaveLength(2);
    expect(json.some((c) => c.operationalRole === 'storage')).toBe(true);
    expect(json.some((c) => c.operationalRole === 'pick')).toBe(true);

    await app.close();
  });

  it('filters containers by operationalRole=pick', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/containers?operationalRole=pick',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    const json = response.json() as Array<{ id: string; operationalRole: string }>;
    expect(json).toHaveLength(1);
    expect(json[0].operationalRole).toBe('pick');
    expect(json[0].id).toBe('f0000000-0000-4000-8000-000000000001');

    await app.close();
  });

  it('filters containers by operationalRole=storage', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/containers?operationalRole=storage',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    const json = response.json() as Array<{ id: string; operationalRole: string }>;
    expect(json).toHaveLength(1);
    expect(json[0].operationalRole).toBe('storage');
    expect(json[0].id).toBe('188ed1eb-c44d-47f8-a8b1-94c7e20db85f');

    await app.close();
  });

  it('rejects unknown operationalRole query value', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/containers?operationalRole=staging',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });

    await app.close();
  });

  it('returns canonical current location for a container', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/location',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      currentLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      locationCode: '03-A.01.02.01',
      locationType: 'rack_slot',
      cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
    });

    await app.close();
  });

  it('returns null canonical location fields for an existing container without active location', async () => {
    const supabase = createSupabaseStub();
    const baseFrom = supabase.from;

    supabase.from = vi.fn((table: string) => {
      if (table === 'active_container_locations_v') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: null
              }))
            }))
          }))
        };
      }

      return baseFrom(table);
    });

    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/location',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      currentLocationId: null,
      locationCode: null,
      locationType: null,
      cellId: null
    });

    await app.close();
  });

  it('returns location-native occupancy rows for a location', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/locations/f932d7de-7350-42b9-9dd6-df11e34b3ea1/containers',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
        locationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
        locationCode: '03-A.01.02.01',
        locationType: 'rack_slot',
        cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-03-13T09:15:00.000Z'
      },
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
        locationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
        locationCode: '03-A.01.02.01',
        locationType: 'rack_slot',
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
        itemRef: `product:${productRows[0].id}`,
        product: productResponses[0],
        quantity: 5,
        uom: 'pcs'
      },
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        itemRef: `product:${productRows[1].id}`,
        product: productResponses[1],
        quantity: 3,
        uom: 'pcs'
      },
      {
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        itemRef: 'LEGACY-REF-42',
        product: null,
        quantity: 2,
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
        product: null,
        quantity: null,
        uom: null
      }
    ]);

    await app.close();
  });

  it('returns resolved storage snapshot for a location', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/locations/f932d7de-7350-42b9-9dd6-df11e34b3ea1/storage',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0]).toMatchObject({
      tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
      locationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      locationCode: '03-A.01.02.01',
      locationType: 'rack_slot',
      cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      itemRef: `product:${productRows[0].id}`,
      product: productResponses[0],
      quantity: 5,
      uom: 'pcs'
    });

    await app.close();
  });

  it('returns not found for the removed legacy rack-section slot-storage route', async () => {
    const supabase = createSupabaseStub();
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

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('returns not found for the removed legacy container-inventory route', async () => {
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

    expect(response.statusCode).toBe(404);

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
        productId: productRows[1].id,
        quantity: 3,
        uom: 'pcs'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: 'cbb1e2b2-c41a-42ec-9a17-4555cfe2cb85',
      tenantId: authContext.currentTenant.tenantId,
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      itemRef: `product:${productRows[1].id}`,
      product: productResponses[1],
      quantity: 3,
      uom: 'pcs',
      createdAt: '2026-03-13T12:30:00.000Z',
      createdBy: authContext.user.id
    });
    expect(supabase.rpc).toHaveBeenCalledWith('receive_inventory_unit', {
      tenant_uuid: authContext.currentTenant.tenantId,
      container_uuid: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      product_uuid: productRows[1].id,
      quantity: 3,
      uom: 'pcs',
      actor_uuid: authContext.user.id
    });
    expect(
      supabase.from.mock.calls.some(([table]) => table === 'containers' || table === 'products' || table === 'inventory_unit')
    ).toBe(false);

    await app.close();
  });

  it('rejects invalid current inventory content payloads before RPC invocation', async () => {
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
        productId: 'not-a-uuid',
        quantity: -1,
        uom: 'pcs'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });
    expect(supabase.rpc).not.toHaveBeenCalled();

    await app.close();
  });

  it('allows multiple canonical inventory rows for the same product and container', async () => {
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
        productId: productRows[0].id,
        quantity: 7,
        uom: 'pcs'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: 'cbb1e2b2-c41a-42ec-9a17-4555cfe2cb85',
      tenantId: authContext.currentTenant.tenantId,
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      itemRef: `product:${productRows[0].id}`,
      product: productResponses[0],
      quantity: 7,
      uom: 'pcs',
      createdAt: '2026-03-13T12:30:00.000Z',
      createdBy: authContext.user.id
    });
    expect(supabase.rpc).toHaveBeenCalledWith('receive_inventory_unit', {
      tenant_uuid: authContext.currentTenant.tenantId,
      container_uuid: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      product_uuid: productRows[0].id,
      quantity: 7,
      uom: 'pcs',
      actor_uuid: authContext.user.id
    });
    expect(supabase.from.mock.calls.some(([table]) => table === 'inventory_unit')).toBe(false);

    await app.close();
  });

  it('returns not found when the target container is outside the current tenant scope', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers/00000000-0000-0000-0000-000000000000/inventory',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        productId: productRows[0].id,
        quantity: 1,
        uom: 'pcs'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: 'CONTAINER_NOT_FOUND'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
    expect(supabase.rpc).toHaveBeenCalledWith('receive_inventory_unit', {
      tenant_uuid: authContext.currentTenant.tenantId,
      container_uuid: '00000000-0000-0000-0000-000000000000',
      product_uuid: productRows[0].id,
      quantity: 1,
      uom: 'pcs',
      actor_uuid: authContext.user.id
    });

    await app.close();
  });

  it('maps inactive inventory products to the current not-found contract', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'receive_inventory_unit') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'PRODUCT_INACTIVE'
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
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/inventory',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        productId: productRows[0].id,
        quantity: 1,
        uom: 'pcs'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Product was not found.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
    expect(supabase.from.mock.calls.some(([table]) => table === 'inventory_unit')).toBe(false);
    expect(supabase.rpc).toHaveBeenCalledWith('receive_inventory_unit', {
      tenant_uuid: authContext.currentTenant.tenantId,
      container_uuid: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      product_uuid: productRows[0].id,
      quantity: 1,
      uom: 'pcs',
      actor_uuid: authContext.user.id
    });

    await app.close();
  });

  it('rejects inventory writes when the container status cannot receive inventory', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'receive_inventory_unit') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'CONTAINER_NOT_RECEIVABLE'
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
      url: '/api/containers/4f8a33c1-c803-4515-b8d4-0144f788e5d2/inventory',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        productId: productRows[0].id,
        quantity: 2,
        uom: 'pcs'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'CONTAINER_NOT_RECEIVABLE'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
    expect(supabase.rpc).toHaveBeenCalledWith('receive_inventory_unit', {
      tenant_uuid: authContext.currentTenant.tenantId,
      container_uuid: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
      product_uuid: productRows[0].id,
      quantity: 2,
      uom: 'pcs',
      actor_uuid: authContext.user.id
    });
    expect(
      supabase.from.mock.calls.some(([table]) => table === 'containers' || table === 'products' || table === 'inventory_unit')
    ).toBe(false);

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
      systemCode: 'CNT-000101',
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
      sampleAddresses: ['03-A.01.01.01', '03-A.01.02.01']
    });

    await app.close();
  });

  it('returns published physical cells for a floor', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/floors/5e5236d0-316b-443a-a4d8-f03cdd79f670/published-cells',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        cellCode: '03-A.01.01.01',
        layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
        rackId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        rackFaceId: 'a18c3f84-8b5e-4458-a90f-f7ce15c80110',
        rackSectionId: 'd208453f-555a-40d0-b4bf-f1e6a93a7752',
        rackLevelId: '6f684566-01dc-4c36-b1ea-5c795edbd82c',
        slotNo: 1,
        address: {
          raw: '03-A.01.01.01',
          parts: {
            rackCode: '03',
            face: 'A',
            section: 1,
            level: 1,
            slot: 1
          },
          sortKey: '0003-A-01-01-01'
        },
        x: 10,
        y: 20,
        status: 'active'
      },
      {
        id: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce',
        cellCode: '03-A.01.02.01',
        layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
        rackId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        rackFaceId: 'a18c3f84-8b5e-4458-a90f-f7ce15c80110',
        rackSectionId: 'd208453f-555a-40d0-b4bf-f1e6a93a7752',
        rackLevelId: '7ccdad48-7dc0-4f27-9794-1c7e59d70a40',
        slotNo: 1,
        address: {
          raw: '03-A.01.02.01',
          parts: {
            rackCode: '03',
            face: 'A',
            section: 1,
            level: 2,
            slot: 1
          },
          sortKey: '0003-A-01-02-01'
        },
        x: 10,
        y: 30,
        status: 'active'
      }
    ]);

    await app.close();
  });

  it('returns not found for the removed legacy floor cell-occupancy route', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/floors/5e5236d0-316b-443a-a4d8-f03cdd79f670/cell-occupancy',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('returns floor-level occupancy rows by location', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/floors/5e5236d0-316b-443a-a4d8-f03cdd79f670/location-occupancy',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
    expect(response.json()[0]).toMatchObject({
      floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
      locationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      locationCode: '03-A.01.02.01',
      locationType: 'rack_slot'
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
        draftVersion: 5,
        floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
        state: 'draft',
        rackIds: ['33333333-3333-4333-8333-333333333333'],
        racks: expect.any(Object),
        zoneIds: [],
        zones: {},
        wallIds: [],
        walls: {}
      },
      latestPublished: {
        layoutVersionId: '22222222-2222-4222-8222-222222222222',
        draftVersion: null,
        floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
        state: 'published',
        rackIds: ['44444444-4444-4444-8444-444444444444'],
        racks: expect.any(Object),
        zoneIds: [],
        zones: {},
        wallIds: [],
        walls: {}
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
      draftVersion: 11,
      floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
      state: 'draft',
      rackIds: ['f38510b5-d5c5-4657-8d7e-a4154cb74951'],
      racks: expect.any(Object),
      zoneIds: [],
      zones: {},
      wallIds: [],
      walls: {}
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
        draftVersion: null,
        floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
        state: 'published',
        rackIds: [],
        racks: {},
        zoneIds: [],
        zones: {},
        wallIds: [],
        walls: {}
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

        if (table === 'layout_zones') {
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
            eq: vi.fn(async () => ({ data: [], error: null })),
            in: vi.fn(async () => ({ data: [], error: null })),
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
      draftVersion: null,
      floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
      state: 'draft',
      rackIds: [],
      racks: {},
      zoneIds: [],
      zones: {},
      wallIds: [],
      walls: {}
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
      containerId: 'c7d4fed6-5d22-4562-bf6b-d4e863d43d70',
      systemCode: 'CNT-000999',
      externalCode: 'PALLET-002',
      containerTypeId: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
      status: 'active',
      operationalRole: 'storage'
    });

    const containerCallIndex = supabase.from.mock.calls.reduce(
      (lastIndex, [table], index) => (table === 'containers' ? index : lastIndex),
      -1
    );
    const containerApi = supabase.from.mock.results[containerCallIndex]?.value;
    expect(containerApi.insert).toHaveBeenCalledWith({
      tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      container_type_id: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
      external_code: 'PALLET-002',
      operational_role: 'storage',
      created_by: authContext.user.id
    });

    await app.close();
  });

  it('rejects duplicate container codes with a stable api error', async () => {
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
        externalCode: 'PALLET-001'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'CONTAINER_CODE_ALREADY_EXISTS',
      message: 'Container code already exists in this workspace.'
    });

    const containerCallIndex = supabase.from.mock.calls.reduce(
      (lastIndex, [table], index) => (table === 'containers' ? index : lastIndex),
      -1
    );
    const containerApi = supabase.from.mock.results[containerCallIndex]?.value;
    expect(containerApi.insert).not.toHaveBeenCalled();

    await app.close();
  });

  it('rejects unknown container types with a stable api error', async () => {
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
        containerTypeId: 'c3dddc3e-c486-48d3-b9ac-1cd24d421111',
        externalCode: 'PALLET-404'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'INVALID_CONTAINER_TYPE',
      message: 'Container type was not found.'
    });
    expect(supabase.from.mock.calls.some(([table]) => table === 'containers')).toBe(false);

    await app.close();
  });

  it('creates a pick container when type supports picking', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers',
      headers: { authorization: 'Bearer token' },
      payload: {
        containerTypeId: 'c0000000-0000-4000-8000-000000000001', // tote: pick-capable
        externalCode: 'TOTE-NEW-001',
        operationalRole: 'pick'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ operationalRole: 'pick', systemCode: 'CNT-000999' });

    await app.close();
  });

  it('creates a container without externalCode and returns the generated systemCode', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers',
      headers: { authorization: 'Bearer token' },
      payload: {
        containerTypeId: 'c0000000-0000-4000-8000-000000000001',
        operationalRole: 'pick'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      containerId: 'c7d4fed6-5d22-4562-bf6b-d4e863d43d70',
      systemCode: 'CNT-000999',
      externalCode: null,
      containerTypeId: 'c0000000-0000-4000-8000-000000000001',
      status: 'active',
      operationalRole: 'pick'
    });

    const containerCallIndex = supabase.from.mock.calls.reduce(
      (lastIndex, [table], index) => (table === 'containers' ? index : lastIndex),
      -1
    );
    const containerApi = supabase.from.mock.results[containerCallIndex]?.value;
    expect(containerApi.insert).toHaveBeenCalledWith({
      tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      container_type_id: 'c0000000-0000-4000-8000-000000000001',
      external_code: null,
      operational_role: 'pick',
      created_by: authContext.user.id
    });

    await app.close();
  });

  it('rejects creating a storage container when type does not support storage', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers',
      headers: { authorization: 'Bearer token' },
      payload: {
        containerTypeId: 'c0000000-0000-4000-8000-000000000001', // tote: supports_storage=false
        externalCode: 'TOTE-AS-STORAGE',
        operationalRole: 'storage'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'CONTAINER_TYPE_NOT_STORAGE_CAPABLE' });

    await app.close();
  });

  it('rejects creating a pick container when type does not support picking', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers',
      headers: { authorization: 'Bearer token' },
      payload: {
        containerTypeId: 'c0000000-0000-4000-8000-000000000002', // rack_pallet: supports_picking=false
        externalCode: 'RACK-AS-PICK',
        operationalRole: 'pick'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'CONTAINER_TYPE_NOT_PICK_CAPABLE' });

    await app.close();
  });

  it('defaults operationalRole to storage when omitted from create payload', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/containers',
      headers: { authorization: 'Bearer token' },
      payload: {
        containerTypeId: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe', // pallet: supports_storage=true
        externalCode: 'PALLET-NEW-DEFAULT'
        // operationalRole intentionally omitted
      }
    });

    expect(response.statusCode).toBe(200);

    // Verify the insert was called with the defaulted 'storage' role
    const containerCallIndex = supabase.from.mock.calls.reduce(
      (lastIndex: number, [table]: [string], index: number) => (table === 'containers' ? index : lastIndex),
      -1
    );
    const containerApi = supabase.from.mock.results[containerCallIndex]?.value as { insert: ReturnType<typeof vi.fn> };
    expect(containerApi.insert).toHaveBeenCalledWith(
      expect.objectContaining({ operational_role: 'storage' })
    );

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

  it('creates a floor and returns the id contract', async () => {
    const base = createSupabaseStub();
    const insertFloor = vi.fn((payload: Record<string, unknown>) => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: 'f5d8bc5a-85d2-4f1d-b3dc-90d4d7b3c8fe',
            payload
          },
          error: null
        }))
      }))
    }));
    const supabase = {
      ...base,
      from: vi.fn((table: string) => {
        if (table === 'floors') {
          return {
            insert: insertFloor
          };
        }

        return base.from(table);
      })
    };
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/floors',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        siteId: '1f7eec3d-7300-47ff-b5a2-164e31422d22',
        code: 'F1',
        name: 'Floor 1',
        sortOrder: 0
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: 'f5d8bc5a-85d2-4f1d-b3dc-90d4d7b3c8fe'
    });
    expect(insertFloor).toHaveBeenCalledWith({
      site_id: '1f7eec3d-7300-47ff-b5a2-164e31422d22',
      code: 'F1',
      name: 'Floor 1',
      sort_order: 0
    });

    await app.close();
  });

  it('rejects invalid create-floor payloads with validation error', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/floors',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        siteId: 'not-a-uuid',
        code: '',
        name: 'Floor 1',
        sortOrder: -1
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });
    expect(supabase.from.mock.calls.some(([table]) => table === 'floors')).toBe(false);

    await app.close();
  });

  it('returns not found for the removed legacy place-by-cell route', async () => {
    const supabase = createSupabaseStub();
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

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('places a container through the location-native public endpoint', async () => {
    const supabase = createSupabaseStub();
    const placementService = {
      placeContainerAtLocation: vi.fn(async () => ({
        ok: true,
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        locationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
      }))
    };
    const getPlacementService = vi.fn(() => placementService as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never),
      getPlacementService
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/placement/place-at-location',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        locationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      locationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
    });
    expect(getPlacementService).toHaveBeenCalledTimes(1);
    expect(placementService.placeContainerAtLocation).toHaveBeenCalledWith({
      tenantId: authContext.currentTenant.tenantId,
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      locationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
      actorId: authContext.user.id
    });

    await app.close();
  });

  it('maps placement service location-not-found to stable api contract', async () => {
    const supabase = createSupabaseStub();
    const placementService = {
      placeContainerAtLocation: vi.fn(async () => {
        throw new LocationNotFoundError();
      })
    };
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never),
      getPlacementService: vi.fn(() => placementService as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/placement/place-at-location',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        locationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: 'LOCATION_NOT_FOUND',
      message: 'Location was not found.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

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

  it('removes a container from a non-rack location (null cellId and placementId)', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'remove_container') {
        return {
          data: {
            action: 'removed',
            containerId: args.container_uuid,
            cellId: null,
            placementId: null,
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
      cellId: null,
      placementId: null,
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


  it('returns not found for the removed legacy move-by-cell route', async () => {
    const supabase = createSupabaseStub();
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

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('moves a container through the location-native public endpoint', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'move_container_canonical') {
        return {
          data: {
            containerId: args.container_uuid,
            sourceLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
            targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
            movementId: 'c1411420-4f31-4427-9d8d-e6c779d6cc0f',
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
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/move-to-location',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      sourceLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
      movementId: 'c1411420-4f31-4427-9d8d-e6c779d6cc0f',
      occurredAt: '2026-03-13T12:45:00.000Z'
    });

    await app.close();
  });

  it('maps move-to-location occupancy conflicts to stable api contract', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'move_container_canonical') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'LOCATION_OCCUPIED'
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
      url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/move-to-location',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'LOCATION_OCCUPIED',
      message: 'Target location already has an active container.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('transfers stock through the canonical public endpoint', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'transfer_inventory_unit') {
        return {
          data: {
            sourceInventoryUnitId: args.source_inventory_unit_uuid,
            targetInventoryUnitId: '4173ae09-8e9d-4bb3-bb15-d32a8f95b041',
            sourceContainerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
            targetContainerId: args.target_container_uuid,
            sourceLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
            targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
            quantity: args.quantity,
            uom: 'pcs',
            mergeApplied: false,
            sourceQuantity: 3,
            targetQuantity: 2,
            movementId: 'a3c0ab55-7711-4d03-b6f0-efdf66dffbc3',
            splitMovementId: 'a3c0ab55-7711-4d03-b6f0-efdf66dffbc3',
            transferMovementId: '4cf433cc-d771-4fd6-9042-b23e848f5225',
            occurredAt: '2026-03-13T13:00:00.000Z'
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
      url: '/api/inventory/e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c/transfer',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
        quantity: 2
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sourceInventoryUnitId: 'e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c',
      targetInventoryUnitId: '4173ae09-8e9d-4bb3-bb15-d32a8f95b041',
      sourceContainerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
      sourceLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
      quantity: 2,
      uom: 'pcs',
      mergeApplied: false,
      sourceQuantity: 3,
      targetQuantity: 2,
      movementId: 'a3c0ab55-7711-4d03-b6f0-efdf66dffbc3',
      splitMovementId: 'a3c0ab55-7711-4d03-b6f0-efdf66dffbc3',
      transferMovementId: '4cf433cc-d771-4fd6-9042-b23e848f5225',
      occurredAt: '2026-03-13T13:00:00.000Z'
    });

    await app.close();
  });

  it('maps transfer target-container-not-found to stable api contract', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'transfer_inventory_unit') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'TARGET_CONTAINER_NOT_FOUND'
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
      url: '/api/inventory/e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c/transfer',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
        quantity: 2
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: 'TARGET_CONTAINER_NOT_FOUND',
      message: 'Target container was not found.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('picks partial stock through the canonical public endpoint', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'pick_partial_inventory_unit') {
        return {
          data: {
            sourceInventoryUnitId: args.source_inventory_unit_uuid,
            targetInventoryUnitId: '9f818a19-f1a3-4a18-82b5-87c0a38da459',
            sourceContainerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
            targetContainerId: args.pick_container_uuid,
            sourceLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
            targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
            quantity: args.quantity,
            uom: 'pcs',
            mergeApplied: false,
            sourceQuantity: 4,
            targetQuantity: 1,
            movementId: '7f2d5362-bcc7-4d30-b67d-d8cb154b2fd6',
            splitMovementId: '7f2d5362-bcc7-4d30-b67d-d8cb154b2fd6',
            transferMovementId: '9d35f4c2-184b-4a07-b011-0caec48ba1f9',
            occurredAt: '2026-03-13T13:10:00.000Z'
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
      url: '/api/inventory/e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c/pick-partial',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        pickContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
        quantity: 1
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sourceInventoryUnitId: 'e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c',
      targetInventoryUnitId: '9f818a19-f1a3-4a18-82b5-87c0a38da459',
      sourceContainerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
      sourceLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
      quantity: 1,
      uom: 'pcs',
      mergeApplied: false,
      sourceQuantity: 4,
      targetQuantity: 1,
      movementId: '7f2d5362-bcc7-4d30-b67d-d8cb154b2fd6',
      splitMovementId: '7f2d5362-bcc7-4d30-b67d-d8cb154b2fd6',
      transferMovementId: '9d35f4c2-184b-4a07-b011-0caec48ba1f9',
      occurredAt: '2026-03-13T13:10:00.000Z'
    });

    await app.close();
  });

  it('maps pick-partial invalid split quantity to stable api contract', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'pick_partial_inventory_unit') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'INVALID_SPLIT_QUANTITY'
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
      url: '/api/inventory/e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c/pick-partial',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        pickContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
        quantity: 1
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'INVALID_SPLIT_QUANTITY',
      message: 'Split quantity must be greater than zero and less than the source quantity.'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('creates a layout draft and returns id contract', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'create_layout_draft') {
        return {
          data: '30ad8d7e-15a4-404f-953e-23634eb38769',
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
      url: '/api/layout-drafts',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        floorId: '5e5236d0-316b-443a-a4d8-f03cdd79f670'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: '30ad8d7e-15a4-404f-953e-23634eb38769'
    });
    expect(supabase.rpc).toHaveBeenCalledWith('create_layout_draft', {
      floor_uuid: '5e5236d0-316b-443a-a4d8-f03cdd79f670',
      actor_uuid: authContext.user.id
    });

    await app.close();
  });

  it('rejects invalid create-layout-draft payloads before rpc', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/layout-drafts',
      headers: {
        authorization: 'Bearer token'
      },
      payload: {
        floorId: 'not-a-uuid'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });
    expect(supabase.rpc).not.toHaveBeenCalled();

    await app.close();
  });

  it('validates a layout draft and returns validation contract', async () => {
    const layoutVersionId = '3dbf2a90-b1cb-42f0-afec-57f436a22f5d';
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'validate_layout_version') {
        return {
          data: {
            isValid: false,
            issues: [
              {
                code: 'LAYOUT_OVERLAP',
                severity: 'error',
                message: 'Rack geometry overlaps another rack.',
                entityId: 'f38510b5-d5c5-4657-8d7e-a4154cb74951'
              }
            ]
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
      url: `/api/layout-drafts/${layoutVersionId}/validate`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      isValid: false,
      issues: [
        {
          code: 'LAYOUT_OVERLAP',
          severity: 'error',
          message: 'Rack geometry overlaps another rack.',
          entityId: 'f38510b5-d5c5-4657-8d7e-a4154cb74951'
        }
      ]
    });
    expect(supabase.rpc).toHaveBeenCalledWith('validate_layout_version', {
      layout_version_uuid: layoutVersionId
    });

    await app.close();
  });

  it('keeps validate-layout rpc P0001 fallback mapping as placement-conflict contract', async () => {
    const layoutVersionId = '3dbf2a90-b1cb-42f0-afec-57f436a22f5d';
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'validate_layout_version') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'LAYOUT_VALIDATION_FAILED'
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
      url: `/api/layout-drafts/${layoutVersionId}/validate`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'PLACEMENT_CONFLICT',
      message: 'LAYOUT_VALIDATION_FAILED'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('rejects invalid validate-layout params before rpc', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/layout-drafts/not-a-uuid/validate',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
    expect(supabase.rpc).not.toHaveBeenCalled();

    await app.close();
  });

  it('publishes a layout draft and returns publish contract', async () => {
    const layoutVersionId = '3dbf2a90-b1cb-42f0-afec-57f436a22f5d';
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'publish_layout_version') {
        return {
          data: {
            layoutVersionId,
            publishedAt: '2026-03-21T10:15:00.000Z',
            generatedCells: 8,
            validation: {
              isValid: true,
              issues: []
            }
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
      url: `/api/layout-drafts/${layoutVersionId}/publish`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      layoutVersionId,
      publishedAt: '2026-03-21T10:15:00.000Z',
      generatedCells: 8,
      validation: {
        isValid: true,
        issues: []
      }
    });
    expect(supabase.rpc).toHaveBeenCalledWith('publish_layout_version', {
      layout_version_uuid: layoutVersionId,
      actor_uuid: authContext.user.id
    });

    await app.close();
  });

  it('keeps publish-layout rpc P0001 fallback mapping as placement-conflict contract', async () => {
    const layoutVersionId = '3dbf2a90-b1cb-42f0-afec-57f436a22f5d';
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'publish_layout_version') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'LAYOUT_NOT_VALID'
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
      url: `/api/layout-drafts/${layoutVersionId}/publish`,
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'PLACEMENT_CONFLICT',
      message: 'LAYOUT_NOT_VALID'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();

    await app.close();
  });

  it('rejects invalid publish-layout params before rpc', async () => {
    const supabase = createSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/layout-drafts/not-a-uuid/publish',
      headers: {
        authorization: 'Bearer token'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });
    expect(response.json().requestId).toBeTruthy();
    expect(response.json().errorId).toBeTruthy();
    expect(supabase.rpc).not.toHaveBeenCalled();

    await app.close();
  });

  it('accepts save-layout payloads with optional rack-face faceLength', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'save_layout_draft') {
        return {
          data: {
            layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
            draftVersion: 8
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
      url: '/api/layout-drafts/save',
      headers: {
        authorization: 'Bearer token'
      },
      payload: createValidSaveLayoutDraftPayload()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
      draftVersion: 8
    });
    const savePayload = supabase.rpc.mock.calls[0]?.[1]?.layout_payload as {
      racks: Array<{ faces: Array<Record<string, unknown>> }>;
    };
    expect(savePayload.racks[0]?.faces[0]).not.toHaveProperty('anchor');
    expect(savePayload.racks[0]?.faces[0]).toHaveProperty('faceLength', 4.5);
    expect(supabase.rpc).toHaveBeenCalledWith('save_layout_draft', {
      layout_payload: {
        layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
        draftVersion: 7,
        zones: [],
        walls: [],
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

  it('normalizes legacy string save-layout rpc responses to the current save contract', async () => {
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
      layoutVersionId: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
      draftVersion: null
    });

    await app.close();
  });

  it('maps save-layout draft conflicts to the dedicated draft conflict contract', async () => {
    const supabase = createSupabaseStub();
    supabase.rpc = vi.fn(async (fn: string) => {
      if (fn === 'save_layout_draft') {
        return {
          data: null,
          error: {
            code: 'P0001',
            message: 'DRAFT_CONFLICT'
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
      url: '/api/layout-drafts/save',
      headers: {
        authorization: 'Bearer token'
      },
      payload: createValidSaveLayoutDraftPayload()
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'DRAFT_CONFLICT',
      message: 'Layout draft was changed by another session. Please reload.'
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

// ── GET /api/pick-tasks/:taskId ───────────────────────────────────────────────

const pickTaskDetailIds = {
  task:      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenant:    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  step:      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  order:     'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  orderLine: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  container: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  cell:      '00000000-0000-4000-8000-000000000001',
  product:   '00000000-0000-4000-8000-000000000002'
};

function createPickTaskDetailSupabaseStub(overrides: {
  taskData?: unknown;
  taskError?: unknown;
  stepData?: unknown[];
} = {}) {
  const {
    taskData = {
      id: pickTaskDetailIds.task,
      task_number: 'TSK-000654',
      tenant_id: pickTaskDetailIds.tenant,
      source_type: 'order',
      source_id: pickTaskDetailIds.order,
      status: 'in_progress',
      assigned_to: null,
      started_at: null,
      completed_at: null,
      created_at: '2026-03-01T09:00:00.000Z'
    },
    taskError = null,
    stepData = [
      {
        id: pickTaskDetailIds.step,
        task_id: pickTaskDetailIds.task,
        tenant_id: pickTaskDetailIds.tenant,
        order_id: pickTaskDetailIds.order,
        order_line_id: pickTaskDetailIds.orderLine,
        sequence_no: 1,
        sku: 'SKU-TEST',
        item_name: 'Test Widget',
        qty_required: 4,
        qty_picked: 0,
        status: 'pending',
        source_cell_id: pickTaskDetailIds.cell,
        source_container_id: pickTaskDetailIds.container,
        inventory_unit_id: null,
        pick_container_id: null,
        executed_at: null,
        executed_by: null
      }
    ]
  } = overrides;

  return {
    from: vi.fn((table: string) => {
      if (table === 'pick_tasks') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: taskData, error: taskError }))
            }))
          }))
        };
      }
      if (table === 'pick_steps') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({ data: stepData, error: null }))
            }))
          }))
        };
      }
      if (table === 'containers') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ id: pickTaskDetailIds.container, system_code: 'CNT-000777', external_code: 'CTN-ALPHA' }],
              error: null
            }))
          }))
        };
      }
      if (table === 'cells') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  id: pickTaskDetailIds.cell,
                  address: '03-A.01.01.01',
                  layout_version_id: '00000000-0000-4000-8000-000000000003'
                }
              ],
              error: null
            }))
          }))
        };
      }
      if (table === 'layout_versions') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ id: '00000000-0000-4000-8000-000000000003', floor_id: '00000000-0000-4000-8000-000000000004' }],
              error: null
            }))
          }))
        };
      }
      if (table === 'order_lines') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ id: pickTaskDetailIds.orderLine, product_id: pickTaskDetailIds.product }],
              error: null
            }))
          }))
        };
      }
      if (table === 'products') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ id: pickTaskDetailIds.product, image_urls: ['https://cdn.example.com/img.png'] }],
              error: null
            }))
          }))
        };
      }
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: [], error: null }))
        }))
      };
    }),
    rpc: vi.fn()
  };
}

describe('GET /api/pick-tasks/:taskId', () => {
  it('returns full task detail with enriched step fields', async () => {
    const supabase = createPickTaskDetailSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pick-tasks/${pickTaskDetailIds.task}`,
      headers: { authorization: 'Bearer token' }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(pickTaskDetailIds.task);
    expect(body.taskNumber).toBe('TSK-000654');
    expect(body.status).toBe('in_progress');
    expect(body.totalSteps).toBe(1);
    expect(body.completedSteps).toBe(0);
    expect(body.steps).toHaveLength(1);

    await app.close();
  });

  it('maps enriched step fields in the response', async () => {
    const supabase = createPickTaskDetailSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pick-tasks/${pickTaskDetailIds.task}`,
      headers: { authorization: 'Bearer token' }
    });

    const step = response.json().steps[0];
    expect(step.sourceCellAddress).toBe('03-A.01.01.01');
    expect(step.sourceContainerCode).toBe('CNT-000777');
    expect(step.imageUrl).toBe('https://cdn.example.com/img.png');
    expect(step.sku).toBe('SKU-TEST');
    expect(step.qtyRequired).toBe(4);

    await app.close();
  });

  it('returns 404 when task does not exist', async () => {
    const supabase = createPickTaskDetailSupabaseStub({
      taskData: null,
      taskError: { code: 'PGRST116', message: 'Not Found' }
    });
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never)
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/pick-tasks/${pickTaskDetailIds.task}`,
      headers: { authorization: 'Bearer token' }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'PICK_TASK_NOT_FOUND' });

    await app.close();
  });

  it('returns 401 when authorization header is missing', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/pick-tasks/${pickTaskDetailIds.task}`
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });
});
