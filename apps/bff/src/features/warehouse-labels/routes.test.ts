import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { ApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';

let previewLabels: ReturnType<typeof vi.fn>;
let getRackSlotLocationRefs: ReturnType<typeof vi.fn>;
let generateLabelsPdf: ReturnType<typeof vi.fn>;

const authContext = {
  accessToken: 'token',
  user: { id: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d', email: 'operator@wos.local' },
  displayName: 'Local Operator',
  memberships: [{
    tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin' as const
  }],
  currentTenant: {
    tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin' as const
  }
} as unknown as AuthenticatedRequestContext;

describe('warehouse label routes', () => {
  beforeEach(() => {
    previewLabels = vi.fn().mockResolvedValue({
      labelCount: 1,
      pageCount: 1,
      resolvedPreset: {
        id: 'rack-slot-100x50',
        widthMm: 100,
        heightMm: 50
      },
      resolvedLayout: {
        mode: 'single-label-page',
        pageWidthMm: 100,
        pageHeightMm: 50,
        labelsPerPage: 1
      },
      sampleLabels: [{
        locationId: 'f1000000-0000-4000-8000-000000000001',
        address: '03-A.02.03.04',
        barcodeValue: '03-A.02.03.04'
      }],
      warnings: []
    });
    getRackSlotLocationRefs = vi.fn().mockResolvedValue([
      {
        locationId: 'f1000000-0000-4000-8000-000000000001',
        cellId: 'f2000000-0000-4000-8000-000000000002'
      }
    ]);
    generateLabelsPdf = vi.fn().mockResolvedValue({
      bytes: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]),
      labelCount: 1
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns rack-slot location refs for a floor', async () => {
    const app = buildApp({
      getAuthContext: async () => authContext,
      getWarehouseLabelsService: () => ({ getRackSlotLocationRefs }) as never
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/floors/f3000000-0000-4000-8000-000000000003/rack-slot-location-refs'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        locationId: 'f1000000-0000-4000-8000-000000000001',
        cellId: 'f2000000-0000-4000-8000-000000000002'
      }
    ]);
    expect(getRackSlotLocationRefs).toHaveBeenCalledWith({
      tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      floorId: 'f3000000-0000-4000-8000-000000000003'
    });
    await app.close();
  });

  it('forwards valid requests to the warehouse labels service', async () => {
    const app = buildApp({
      getAuthContext: async () => authContext,
      getWarehouseLabelsService: () => ({ previewLabels }) as never
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-labels/preview',
      payload: {
        floorId: 'f3000000-0000-4000-8000-000000000003',
        selection: {
          mode: 'entire-floor'
        },
        labelPreset: 'rack-slot-100x50',
        layout: {
          mode: 'single-label-page'
        },
        sort: 'address'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(previewLabels).toHaveBeenCalledWith({
      tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      request: expect.objectContaining({
        floorId: 'f3000000-0000-4000-8000-000000000003',
        labelPreset: 'rack-slot-100x50'
      })
    });
    await app.close();
  });

  it('returns a PDF attachment for valid requests', async () => {
    const app = buildApp({
      getAuthContext: async () => authContext,
      getWarehouseLabelsService: () => ({ previewLabels, generateLabelsPdf }) as never
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-labels/pdf',
      payload: {
        floorId: 'f3000000-0000-4000-8000-000000000003',
        selection: {
          mode: 'location-ids',
          locationIds: ['f1000000-0000-4000-8000-000000000001']
        },
        labelPreset: 'rack-slot-100x50',
        layout: {
          mode: 'single-label-page'
        },
        sort: 'address'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.startsWith('%PDF-')).toBe(true);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="warehouse-labels-f3000000-0000-4000-8000-000000000003.pdf"'
    );
    expect(generateLabelsPdf).toHaveBeenCalledWith({
      tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      request: expect.objectContaining({
        floorId: 'f3000000-0000-4000-8000-000000000003',
        layout: {
          mode: 'single-label-page'
        }
      })
    });
    await app.close();
  });

  it('returns the stable unsupported-layout error for A4 PDF requests', async () => {
    generateLabelsPdf.mockRejectedValue(
      new ApiError(
        422,
        'WAREHOUSE_LABEL_PDF_LAYOUT_UNSUPPORTED',
        'PDF rendering for the selected layout mode is not supported yet.'
      )
    );
    const app = buildApp({
      getAuthContext: async () => authContext,
      getWarehouseLabelsService: () => ({ previewLabels, generateLabelsPdf }) as never
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-labels/pdf',
      payload: {
        floorId: 'f3000000-0000-4000-8000-000000000003',
        selection: {
          mode: 'entire-floor'
        },
        labelPreset: 'rack-slot-100x50',
        layout: {
          mode: 'a4-sheet',
          marginMm: 5,
          gapMm: 2
        },
        sort: 'address'
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('WAREHOUSE_LABEL_PDF_LAYOUT_UNSUPPORTED');
    await app.close();
  });

  it('maps PDF rendering failures to stable client-visible errors', async () => {
    generateLabelsPdf.mockRejectedValue(
      new ApiError(
        422,
        'WAREHOUSE_LABEL_TEXT_OVERFLOW',
        'Warehouse label address does not fit the selected preset.'
      )
    );
    const app = buildApp({
      getAuthContext: async () => authContext,
      getWarehouseLabelsService: () => ({ previewLabels, generateLabelsPdf }) as never
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-labels/pdf',
      payload: {
        floorId: 'f3000000-0000-4000-8000-000000000003',
        selection: {
          mode: 'entire-floor'
        },
        labelPreset: 'rack-slot-70x40',
        layout: {
          mode: 'single-label-page'
        },
        sort: 'address'
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('WAREHOUSE_LABEL_TEXT_OVERFLOW');
    await app.close();
  });

  it('preserves the generic explicit-id not-found error for PDF requests', async () => {
    generateLabelsPdf.mockRejectedValue(new ApiError(404, 'LOCATION_NOT_FOUND', 'One or more requested locations were not found.'));
    const app = buildApp({
      getAuthContext: async () => authContext,
      getWarehouseLabelsService: () => ({ previewLabels, generateLabelsPdf }) as never
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-labels/pdf',
      payload: {
        floorId: 'f3000000-0000-4000-8000-000000000003',
        selection: {
          mode: 'location-ids',
          locationIds: ['f1000000-0000-4000-8000-000000000001']
        },
        labelPreset: 'rack-slot-100x50',
        layout: {
          mode: 'single-label-page'
        },
        sort: 'address'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe('LOCATION_NOT_FOUND');
    await app.close();
  });

  it('returns the PDF limit exceeded error for too many labels', async () => {
    generateLabelsPdf.mockRejectedValue(
      new ApiError(
        422,
        'WAREHOUSE_LABEL_PDF_LIMIT_EXCEEDED',
        'Warehouse label PDF generation is limited to 300 labels per request. 301 labels were selected.'
      )
    );
    const app = buildApp({
      getAuthContext: async () => authContext,
      getWarehouseLabelsService: () => ({ previewLabels, generateLabelsPdf }) as never
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-labels/pdf',
      payload: {
        floorId: 'f3000000-0000-4000-8000-000000000003',
        selection: {
          mode: 'entire-floor'
        },
        labelPreset: 'rack-slot-100x50',
        layout: {
          mode: 'single-label-page'
        },
        sort: 'address'
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('WAREHOUSE_LABEL_PDF_LIMIT_EXCEEDED');
    await app.close();
  });

  it('returns validation error for invalid floorId uuid', async () => {
    const app = buildApp({
      getAuthContext: async () => authContext,
      getWarehouseLabelsService: () => ({ previewLabels }) as never
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-labels/preview',
      payload: {
        floorId: 'not-a-uuid',
        selection: {
          mode: 'entire-floor'
        },
        labelPreset: 'rack-slot-100x50',
        layout: {
          mode: 'single-label-page'
        },
        sort: 'address'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');
    expect(previewLabels).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns validation error for invalid locationIds and unsupported enums', async () => {
    const app = buildApp({
      getAuthContext: async () => authContext,
      getWarehouseLabelsService: () => ({ previewLabels }) as never
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-labels/preview',
      payload: {
        floorId: 'f3000000-0000-4000-8000-000000000003',
        selection: {
          mode: 'location-ids',
          locationIds: ['bad-uuid']
        },
        labelPreset: 'custom-size',
        layout: {
          mode: 'poster'
        },
        sort: 'address'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');
    expect(previewLabels).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns validation error for negative a4 margin or gap', async () => {
    const app = buildApp({
      getAuthContext: async () => authContext,
      getWarehouseLabelsService: () => ({ previewLabels }) as never
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-labels/preview',
      payload: {
        floorId: 'f3000000-0000-4000-8000-000000000003',
        selection: {
          mode: 'entire-floor'
        },
        labelPreset: 'rack-slot-100x50',
        layout: {
          mode: 'a4-sheet',
          marginMm: -1,
          gapMm: -2
        },
        sort: 'address'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');
    expect(previewLabels).not.toHaveBeenCalled();
    await app.close();
  });
});
