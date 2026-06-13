import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../errors.js';
import { createWarehouseLabelsService } from './service.js';
import type {
  WarehouseLabelCellRow,
  WarehouseLabelLayoutVersionRow,
  WarehouseLabelLocationRow,
  WarehouseLabelsRepo
} from './repo.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  floor: '22222222-2222-4222-8222-222222222222',
  otherFloor: '33333333-3333-4333-8333-333333333333',
  locationA: '44444444-4444-4444-8444-444444444444',
  locationB: '55555555-5555-4555-8555-555555555555',
  locationC: '66666666-6666-4666-8666-666666666666',
  cellA: '77777777-7777-4777-8777-777777777777',
  cellB: '88888888-8888-4888-8888-888888888888',
  cellC: '99999999-9999-4999-8999-999999999999',
  layoutPublished: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  layoutDraft: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
};

function createRepoStub(overrides?: Partial<WarehouseLabelsRepo>): WarehouseLabelsRepo {
  return {
    listTenantFloorRackSlotLocations: vi.fn().mockResolvedValue([]),
    listTenantLocationsByIds: vi.fn().mockResolvedValue([]),
    listCellsByIds: vi.fn().mockResolvedValue([]),
    listLayoutVersionsByIds: vi.fn().mockResolvedValue([]),
    ...overrides
  };
}

function createLocation(overrides: Partial<WarehouseLabelLocationRow> = {}): WarehouseLabelLocationRow {
  return {
    id: ids.locationA,
    tenant_id: ids.tenant,
    floor_id: ids.floor,
    code: '03-A.02.03.04',
    location_type: 'rack_slot',
    geometry_slot_id: ids.cellA,
    status: 'active',
    ...overrides
  };
}

function createCell(overrides: Partial<WarehouseLabelCellRow> = {}): WarehouseLabelCellRow {
  return {
    id: ids.cellA,
    address_sort_key: '0003-A-02-03-04',
    status: 'active',
    layout_version_id: ids.layoutPublished,
    ...overrides
  };
}

function createLayoutVersion(overrides: Partial<WarehouseLabelLayoutVersionRow> = {}): WarehouseLabelLayoutVersionRow {
  return {
    id: ids.layoutPublished,
    state: 'published',
    ...overrides
  };
}

describe('warehouse label preview service', () => {
  it('resolves entire-floor previews and uses locations.code for address and barcode', async () => {
    const repo = createRepoStub({
      listTenantFloorRackSlotLocations: vi.fn().mockResolvedValue([createLocation()]),
      listCellsByIds: vi.fn().mockResolvedValue([createCell()]),
      listLayoutVersionsByIds: vi.fn().mockResolvedValue([createLayoutVersion()])
    });
    const service = createWarehouseLabelsService(repo);

    const result = await service.previewLabels({
      tenantId: ids.tenant,
      request: {
        floorId: ids.floor,
        selection: { mode: 'entire-floor' },
        labelPreset: 'rack-slot-100x50',
        layout: { mode: 'single-label-page' },
        sort: 'address'
      }
    });

    expect(result).toMatchObject({
      labelCount: 1,
      pageCount: 1,
      sampleLabels: [
        {
          locationId: ids.locationA,
          address: '03-A.02.03.04',
          barcodeValue: '03-A.02.03.04'
        }
      ]
    });
  });

  it('resolves explicit location ids, deduplicates requests, and preserves deterministic order', async () => {
    const repo = createRepoStub({
      listTenantLocationsByIds: vi.fn().mockResolvedValue([
        createLocation({
          id: ids.locationB,
          code: '03-A.02.03.05',
          geometry_slot_id: ids.cellB
        }),
        createLocation({
          id: ids.locationA,
          code: '03-A.02.03.04',
          geometry_slot_id: ids.cellA
        }),
        createLocation({
          id: ids.locationC,
          code: '03-A.02.03.04',
          geometry_slot_id: ids.cellC
        })
      ]),
      listCellsByIds: vi.fn().mockResolvedValue([
        createCell({
          id: ids.cellA,
          address_sort_key: '0003-A-02-03-04'
        }),
        createCell({
          id: ids.cellB,
          address_sort_key: '0003-A-02-03-05'
        }),
        createCell({
          id: ids.cellC,
          address_sort_key: '0003-A-02-03-04'
        })
      ]),
      listLayoutVersionsByIds: vi.fn().mockResolvedValue([createLayoutVersion()])
    });
    const service = createWarehouseLabelsService(repo);

    const result = await service.previewLabels({
      tenantId: ids.tenant,
      request: {
        floorId: ids.floor,
        selection: {
          mode: 'location-ids',
          locationIds: [ids.locationB, ids.locationA, ids.locationA, ids.locationC]
        },
        labelPreset: 'rack-slot-100x50',
        layout: { mode: 'single-label-page' },
        sort: 'address'
      }
    });

    expect(repo.listTenantLocationsByIds).toHaveBeenCalledWith(ids.tenant, [ids.locationB, ids.locationA, ids.locationC]);
    expect(result.sampleLabels.map((label) => label.locationId)).toEqual([
      ids.locationA,
      ids.locationC,
      ids.locationB
    ]);
  });

  it('rejects missing requested ids', async () => {
    const service = createWarehouseLabelsService(
      createRepoStub({
        listTenantLocationsByIds: vi.fn().mockResolvedValue([createLocation()])
      })
    );

    await expect(
      service.previewLabels({
        tenantId: ids.tenant,
        request: {
          floorId: ids.floor,
          selection: {
            mode: 'location-ids',
            locationIds: [ids.locationA, ids.locationB]
          },
          labelPreset: 'rack-slot-100x50',
          layout: { mode: 'single-label-page' },
          sort: 'address'
        }
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'LOCATION_NOT_FOUND'
    });
  });

  it('rejects a requested location from another floor', async () => {
    const service = createWarehouseLabelsService(
      createRepoStub({
        listTenantLocationsByIds: vi.fn().mockResolvedValue([
          createLocation({
            floor_id: ids.otherFloor
          })
        ])
      })
    );

    await expect(
      service.previewLabels({
        tenantId: ids.tenant,
        request: {
          floorId: ids.floor,
          selection: {
            mode: 'location-ids',
            locationIds: [ids.locationA]
          },
          labelPreset: 'rack-slot-100x50',
          layout: { mode: 'single-label-page' },
          sort: 'address'
        }
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'LOCATION_FLOOR_MISMATCH'
    });
  });

  it('rejects a requested non-rack_slot location', async () => {
    const service = createWarehouseLabelsService(
      createRepoStub({
        listTenantLocationsByIds: vi.fn().mockResolvedValue([
          createLocation({
            location_type: 'staging',
            geometry_slot_id: null
          })
        ])
      })
    );

    await expect(
      service.previewLabels({
        tenantId: ids.tenant,
        request: {
          floorId: ids.floor,
          selection: {
            mode: 'location-ids',
            locationIds: [ids.locationA]
          },
          labelPreset: 'rack-slot-100x50',
          layout: { mode: 'single-label-page' },
          sort: 'address'
        }
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'LOCATION_TYPE_INVALID'
    });
  });

  it('treats cross-tenant access as not found via tenant-scoped repo reads', async () => {
    const service = createWarehouseLabelsService(
      createRepoStub({
        listTenantLocationsByIds: vi.fn().mockResolvedValue([])
      })
    );

    await expect(
      service.previewLabels({
        tenantId: ids.tenant,
        request: {
          floorId: ids.floor,
          selection: {
            mode: 'location-ids',
            locationIds: [ids.locationA]
          },
          labelPreset: 'rack-slot-100x50',
          layout: { mode: 'single-label-page' },
          sort: 'address'
        }
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'LOCATION_NOT_FOUND'
    });
  });

  it('rejects disabled or invalid geometry-linked locations', async () => {
    const service = createWarehouseLabelsService(
      createRepoStub({
        listTenantLocationsByIds: vi.fn().mockResolvedValue([
          createLocation({
            status: 'disabled'
          })
        ])
      })
    );

    await expect(
      service.previewLabels({
        tenantId: ids.tenant,
        request: {
          floorId: ids.floor,
          selection: {
            mode: 'location-ids',
            locationIds: [ids.locationA]
          },
          labelPreset: 'rack-slot-100x50',
          layout: { mode: 'single-label-page' },
          sort: 'address'
        }
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'LOCATION_NOT_PRINTABLE'
    });
  });

  it('rejects geometry cells that are inactive or not published', async () => {
    const repo = createRepoStub({
      listTenantLocationsByIds: vi.fn().mockResolvedValue([createLocation()]),
      listCellsByIds: vi.fn().mockResolvedValue([
        createCell({
          status: 'inactive',
          layout_version_id: ids.layoutDraft
        })
      ]),
      listLayoutVersionsByIds: vi.fn().mockResolvedValue([
        createLayoutVersion({
          id: ids.layoutDraft,
          state: 'draft'
        })
      ])
    });
    const service = createWarehouseLabelsService(repo);

    await expect(
      service.previewLabels({
        tenantId: ids.tenant,
        request: {
          floorId: ids.floor,
          selection: {
            mode: 'location-ids',
            locationIds: [ids.locationA]
          },
          labelPreset: 'rack-slot-100x50',
          layout: { mode: 'single-label-page' },
          sort: 'address'
        }
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'LOCATION_NOT_PRINTABLE'
    });
  });

  it('rejects entire-floor batches that exceed the resolved label limit', async () => {
    const manyLocations = Array.from({ length: 1001 }, (_, index) =>
      createLocation({
        id: `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        geometry_slot_id: `71000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        code: `03-A.02.03.${String(index + 1).padStart(2, '0')}`
      })
    );
    const manyCells = manyLocations.map((location, index) =>
      createCell({
        id: location.geometry_slot_id as string,
        address_sort_key: `0003-A-02-03-${String(index + 1).padStart(2, '0')}`
      })
    );
    const service = createWarehouseLabelsService(
      createRepoStub({
        listTenantFloorRackSlotLocations: vi.fn().mockResolvedValue(manyLocations),
        listCellsByIds: vi.fn().mockResolvedValue(manyCells),
        listLayoutVersionsByIds: vi.fn().mockResolvedValue([createLayoutVersion()])
      })
    );

    await expect(
      service.previewLabels({
        tenantId: ids.tenant,
        request: {
          floorId: ids.floor,
          selection: { mode: 'entire-floor' },
          labelPreset: 'rack-slot-100x50',
          layout: { mode: 'single-label-page' },
          sort: 'address'
        }
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'WAREHOUSE_LABEL_LIMIT_EXCEEDED'
    });
  });

  it('calculates A4 grid dimensions and page count', async () => {
    const repo = createRepoStub({
      listTenantFloorRackSlotLocations: vi.fn().mockResolvedValue([
        createLocation(),
        createLocation({
          id: ids.locationB,
          code: '03-A.02.03.05',
          geometry_slot_id: ids.cellB
        }),
        createLocation({
          id: ids.locationC,
          code: '03-A.02.03.06',
          geometry_slot_id: ids.cellC
        })
      ]),
      listCellsByIds: vi.fn().mockResolvedValue([
        createCell({
          id: ids.cellA,
          address_sort_key: '0003-A-02-03-04'
        }),
        createCell({
          id: ids.cellB,
          address_sort_key: '0003-A-02-03-05'
        }),
        createCell({
          id: ids.cellC,
          address_sort_key: '0003-A-02-03-06'
        })
      ]),
      listLayoutVersionsByIds: vi.fn().mockResolvedValue([createLayoutVersion()])
    });
    const service = createWarehouseLabelsService(repo);

    const result = await service.previewLabels({
      tenantId: ids.tenant,
      request: {
        floorId: ids.floor,
        selection: { mode: 'entire-floor' },
        labelPreset: 'rack-slot-100x50',
        layout: {
          mode: 'a4-sheet',
          marginMm: 5,
          gapMm: 2
        },
        sort: 'address'
      }
    });

    expect(result.resolvedLayout).toEqual({
      mode: 'a4-sheet',
      pageWidthMm: 210,
      pageHeightMm: 297,
      marginMm: 5,
      gapMm: 2,
      columns: 1,
      rows: 5,
      labelsPerPage: 5
    });
    expect(result.pageCount).toBe(1);
  });

  it('rejects impossible A4 layouts', async () => {
    const repo = createRepoStub({
      listTenantFloorRackSlotLocations: vi.fn().mockResolvedValue([createLocation()]),
      listCellsByIds: vi.fn().mockResolvedValue([createCell()]),
      listLayoutVersionsByIds: vi.fn().mockResolvedValue([createLayoutVersion()])
    });
    const service = createWarehouseLabelsService(repo);

    await expect(
      service.previewLabels({
        tenantId: ids.tenant,
        request: {
          floorId: ids.floor,
          selection: { mode: 'entire-floor' },
          labelPreset: 'rack-slot-100x50',
          layout: {
            mode: 'a4-sheet',
            marginMm: 60,
            gapMm: 2
          },
          sort: 'address'
        }
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  });

  it('limits sample labels to the first 10 resolved rows', async () => {
    const locations = Array.from({ length: 12 }, (_, index) =>
      createLocation({
        id: `72000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        geometry_slot_id: `73000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        code: `03-A.02.03.${String(index + 1).padStart(2, '0')}`
      })
    );
    const cells = locations.map((location, index) =>
      createCell({
        id: location.geometry_slot_id as string,
        address_sort_key: `0003-A-02-03-${String(index + 1).padStart(2, '0')}`
      })
    );
    const repo = createRepoStub({
      listTenantFloorRackSlotLocations: vi.fn().mockResolvedValue(locations),
      listCellsByIds: vi.fn().mockResolvedValue(cells),
      listLayoutVersionsByIds: vi.fn().mockResolvedValue([createLayoutVersion()])
    });
    const service = createWarehouseLabelsService(repo);

    const result = await service.previewLabels({
      tenantId: ids.tenant,
      request: {
        floorId: ids.floor,
        selection: { mode: 'entire-floor' },
        labelPreset: 'rack-slot-100x50',
        layout: { mode: 'single-label-page' },
        sort: 'address'
      }
    });

    expect(result.sampleLabels).toHaveLength(10);
    expect(result.labelCount).toBe(12);
    expect(result.pageCount).toBe(12);
  });

  it('emits a warning for overlong addresses', async () => {
    const repo = createRepoStub({
      listTenantFloorRackSlotLocations: vi.fn().mockResolvedValue([
        createLocation({
          code: '03-A.02.03.04-LONG'
        })
      ]),
      listCellsByIds: vi.fn().mockResolvedValue([createCell()]),
      listLayoutVersionsByIds: vi.fn().mockResolvedValue([createLayoutVersion()])
    });
    const service = createWarehouseLabelsService(repo);

    const result = await service.previewLabels({
      tenantId: ids.tenant,
      request: {
        floorId: ids.floor,
        selection: { mode: 'entire-floor' },
        labelPreset: 'rack-slot-70x40',
        layout: { mode: 'single-label-page' },
        sort: 'address'
      }
    });

    expect(result.warnings).toEqual([
      '1 label address exceeds recommended length 14 for preset rack-slot-70x40.'
    ]);
  });
});
