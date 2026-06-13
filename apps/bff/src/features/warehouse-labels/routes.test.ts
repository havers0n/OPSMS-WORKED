import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { AuthenticatedRequestContext } from '../../auth.js';

let previewLabels: ReturnType<typeof vi.fn>;

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
  });

  afterEach(() => {
    vi.clearAllMocks();
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
