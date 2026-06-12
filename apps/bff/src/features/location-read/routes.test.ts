import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { AuthenticatedRequestContext } from '../../auth.js';

// ── Mock repo ─────────────────────────────────────────────────────────────────
let mockRepo: ReturnType<typeof createMockRepo>;

function createMockRepo() {
  return {
    locationExists: vi.fn(),
    listLocationContainers: vi.fn(),
    listLocationStorage: vi.fn(),
    getLocationByCell: vi.fn(),
    listFloorLocationOccupancy: vi.fn(),
    listFloorCellStorage: vi.fn(),
    listFloorCellsByProduct: vi.fn(),
    listFloorNonRackLocations: vi.fn(),
    updateLocationGeometry: vi.fn(),
  };
}

vi.mock('./location-read-repo.js', () => ({
  createLocationReadRepo: vi.fn(() => mockRepo)
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
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

const ids = {
  location: 'f1000000-0000-4000-8000-000000000001',
  cell:     'f2000000-0000-4000-8000-000000000002',
  floor:    'f3000000-0000-4000-8000-000000000003',
  container:'f4000000-0000-4000-8000-000000000004',
  product:  'f5000000-0000-4000-8000-000000000005',
};

const occupancyRow = {
  tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
  floor_id: ids.floor,
  location_id: ids.location,
  location_code: '03-A.01.02.01',
  location_type: 'rack_slot' as const,
  cell_id: ids.cell,
  container_id: ids.container,
  external_code: 'PALLET-001',
  container_type: 'pallet',
  container_status: 'active' as const,
  placed_at: '2026-03-13T09:15:00.000Z',
};

const productRow = {
  id: ids.product,
  source: 'internal',
  external_product_id: 'PROD-001',
  sku: 'SKU-001',
  name: 'Test Product',
  permalink: null,
  image_urls: null,
  image_files: null,
  is_active: true,
  category: 'test',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const storageRow = {
  tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
  floor_id: ids.floor,
  location_id: ids.location,
  location_code: '03-A.01.02.01',
  location_type: 'rack_slot' as const,
  cell_id: ids.cell,
  container_id: ids.container,
  system_code: 'CNT-000101',
  external_code: 'PALLET-001',
  container_type: 'pallet',
  container_status: 'active' as const,
  placed_at: '2026-03-13T09:15:00.000Z',
  inventory_unit_id: 'e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c',
  item_ref: null,
  product_id: ids.product,
  quantity: 5,
  uom: 'pcs',
  inventory_status: 'available' as const,
  packaging_state: null,
  product_packaging_level_id: null,
  pack_count: null,
  container_packaging_profile_id: null,
  container_is_standard_pack: null,
  preferred_packaging_profile_id: null,
  preset_usage_status: 'unknown' as const,
  preset_materialization_status: 'unknown' as const,
};

const nonRackRow = {
  id: ids.location,
  code: 'STG-001',
  location_type: 'staging' as const,
  floor_x: 10.5,
  floor_y: 20.3,
  status: 'active' as const,
};

// ── Supabase stub for product enrichment ──────────────────────────────────────
function createProductsSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'products') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: [productRow], error: null })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            order: vi.fn(async () => ({ data: [], error: null })),
          })),
          in: vi.fn(async () => ({ data: [], error: null })),
          neq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      };
    }),
  } as never;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('location read routes', () => {
  beforeEach(() => {
    mockRepo = createMockRepo();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /api/locations/:locationId/containers ─────────────────────────────
  describe('GET /api/locations/:locationId/containers', () => {
    it('returns occupancy rows when authenticated', async () => {
      mockRepo.locationExists.mockResolvedValue(true);
      mockRepo.listLocationContainers.mockResolvedValue([occupancyRow]);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/locations/${ids.location}/containers`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
        locationId: ids.location,
        containerId: ids.container,
      });
      expect(mockRepo.locationExists).toHaveBeenCalledWith(ids.location);
      expect(mockRepo.listLocationContainers).toHaveBeenCalledWith(ids.location);
      await app.close();
    });

    it('returns 400 when locationId is not a valid UUID', async () => {
      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/locations/not-a-uuid/containers',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('VALIDATION_ERROR');
      await app.close();
    });

    it('does not call getUserSupabase when unauthenticated', async () => {
      const getUserSupabase = vi.fn();
      const app = buildApp({ getUserSupabase });

      const response = await app.inject({
        method: 'GET',
        url: `/api/locations/${ids.location}/containers`,
      });

      expect(response.statusCode).toBe(401);
      expect(getUserSupabase).not.toHaveBeenCalled();
      await app.close();
    });

    it('returns 404 when location does not exist', async () => {
      mockRepo.locationExists.mockResolvedValue(false);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/locations/${ids.location}/containers`,
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe('LOCATION_NOT_FOUND');
      await app.close();
    });
  });

  // ── GET /api/locations/:locationId/storage ───────────────────────────────
  describe('GET /api/locations/:locationId/storage', () => {
    it('returns storage snapshot with product enrichment when authenticated', async () => {
      mockRepo.locationExists.mockResolvedValue(true);
      mockRepo.listLocationStorage.mockResolvedValue([storageRow]);
      const supabase = createProductsSupabase();

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn(() => supabase),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/locations/${ids.location}/storage`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].product).toBeDefined();
      expect(body[0].product.id).toBe(ids.product);
      expect(body[0].product.name).toBe('Test Product');
      expect(body[0].systemCode).toBe('CNT-000101');
      expect(mockRepo.locationExists).toHaveBeenCalledWith(ids.location);
      expect(mockRepo.listLocationStorage).toHaveBeenCalledWith(ids.location);
      await app.close();
    });
  });

  // ── GET /api/locations/by-cell/:cellId ──────────────────────────────────
  describe('GET /api/locations/by-cell/:cellId', () => {
    it('returns location reference when authenticated', async () => {
      const locationRef = {
        locationId: ids.location,
        locationCode: '03-A.01.02.01',
        locationType: 'rack_slot' as const,
        cellId: ids.cell,
      };
      mockRepo.getLocationByCell.mockResolvedValue(locationRef);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/locations/by-cell/${ids.cell}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(locationRef);
      expect(mockRepo.getLocationByCell).toHaveBeenCalledWith(ids.cell);
      await app.close();
    });

    it('returns 404 when no active location for cell', async () => {
      mockRepo.getLocationByCell.mockResolvedValue(null);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/locations/by-cell/${ids.cell}`,
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe('LOCATION_NOT_FOUND');
      await app.close();
    });
  });

  // ── GET /api/floors/:floorId/location-occupancy ──────────────────────────
  describe('GET /api/floors/:floorId/location-occupancy', () => {
    it('returns floor occupancy rows when authenticated', async () => {
      mockRepo.listFloorLocationOccupancy.mockResolvedValue([occupancyRow]);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/location-occupancy`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        floorId: ids.floor,
        locationId: ids.location,
      });
      expect(mockRepo.listFloorLocationOccupancy).toHaveBeenCalledWith(ids.floor);
      await app.close();
    });

    it('returns empty array when no occupancy data', async () => {
      mockRepo.listFloorLocationOccupancy.mockResolvedValue([]);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/location-occupancy`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
      await app.close();
    });
  });

  // ── GET /api/floors/:floorId/storage ─────────────────────────────────────
  describe('GET /api/floors/:floorId/storage', () => {
    it('returns floor storage rows with product enrichment when authenticated', async () => {
      mockRepo.listFloorCellStorage.mockResolvedValue([storageRow]);
      const supabase = createProductsSupabase();

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn(() => supabase),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/storage`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].product).toBeDefined();
      expect(body[0].product.id).toBe(ids.product);
      expect(body[0].product.name).toBe('Test Product');
      expect(mockRepo.listFloorCellStorage).toHaveBeenCalledWith(ids.floor);
      await app.close();
    });
  });

  // ── GET /api/floors/:floorId/cells-by-product ────────────────────────────
  describe('GET /api/floors/:floorId/cells-by-product', () => {
    it('returns cell ID list when authenticated', async () => {
      mockRepo.listFloorCellsByProduct.mockResolvedValue([ids.cell]);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/cells-by-product?productId=${ids.product}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([ids.cell]);
      expect(mockRepo.listFloorCellsByProduct).toHaveBeenCalledWith(ids.floor, ids.product);
      await app.close();
    });

    it('returns 400 when productId query is not a valid UUID', async () => {
      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/cells-by-product?productId=not-a-uuid`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('VALIDATION_ERROR');
      await app.close();
    });
  });

  // ── GET /api/floors/:floorId/non-rack-locations ──────────────────────────
  describe('GET /api/floors/:floorId/non-rack-locations', () => {
    it('returns non-rack locations when authenticated', async () => {
      mockRepo.listFloorNonRackLocations.mockResolvedValue([nonRackRow]);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/non-rack-locations`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual({
        id: ids.location,
        code: 'STG-001',
        locationType: 'staging',
        floorX: 10.5,
        floorY: 20.3,
        status: 'active',
      });
      expect(mockRepo.listFloorNonRackLocations).toHaveBeenCalledWith(ids.floor);
      await app.close();
    });

    it('returns empty array when no non-rack locations', async () => {
      mockRepo.listFloorNonRackLocations.mockResolvedValue([]);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/non-rack-locations`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
      await app.close();
    });
  });

  // ── PATCH /api/locations/:locationId/geometry ────────────────────────────
  describe('PATCH /api/locations/:locationId/geometry', () => {
    it('updates geometry and returns updated location when authenticated', async () => {
      const updatedRow = {
        ...nonRackRow,
        floor_x: 15.0,
        floor_y: 25.0,
      };
      mockRepo.updateLocationGeometry.mockResolvedValue(updatedRow);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/locations/${ids.location}/geometry`,
        payload: { floorX: 15.0, floorY: 25.0 },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        id: ids.location,
        code: 'STG-001',
        locationType: 'staging',
        floorX: 15.0,
        floorY: 25.0,
        status: 'active',
      });
      expect(mockRepo.updateLocationGeometry).toHaveBeenCalledWith(ids.location, 15.0, 25.0);
      await app.close();
    });

    it('returns 404 when location not found or is a rack slot', async () => {
      mockRepo.updateLocationGeometry.mockResolvedValue(null);

      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/locations/${ids.location}/geometry`,
        payload: { floorX: 10.0, floorY: 20.0 },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ code: 'NOT_FOUND', message: 'Location not found or is a rack slot' });
      await app.close();
    });

    it('returns 400 for invalid body', async () => {
      const app = buildApp({
        getAuthContext: async () => authContext,
        getUserSupabase: vi.fn() as never,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/locations/${ids.location}/geometry`,
        payload: { floorX: 'not-a-number' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('VALIDATION_ERROR');
      await app.close();
    });

    it('does not call getUserSupabase when unauthenticated', async () => {
      const getUserSupabase = vi.fn();
      const app = buildApp({ getUserSupabase });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/locations/${ids.location}/geometry`,
        payload: { floorX: 10.0, floorY: 20.0 },
      });

      expect(response.statusCode).toBe(401);
      expect(getUserSupabase).not.toHaveBeenCalled();
      await app.close();
    });
  });
});
