import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import {
  ContainerNotFoundError,
  LocationNotActiveError,
  LocationNotFoundError,
  LocationOccupiedError
} from './errors.js';

const authContext = {
  accessToken: 'token',
  user: { id: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d', email: 'operator@wos.local' },
  displayName: 'Local Operator',
  memberships: [
    {
      tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      tenantCode: 'default',
      tenantName: 'Default Tenant',
      role: 'tenant_admin' as const
    }
  ],
  currentTenant: {
    tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin' as const
  }
};

describe('placement routes', () => {
  it('authenticated happy path returns the existing success DTO', async () => {
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
      getPlacementService
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/placement/place-at-location',
      headers: { authorization: 'Bearer token' },
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

    await app.close();
  });

  it('LOCATION_NOT_FOUND maps to the existing 404 response', async () => {
    const placementService = {
      placeContainerAtLocation: vi.fn(async () => {
        throw new LocationNotFoundError();
      })
    };
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getPlacementService: vi.fn(() => placementService as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/placement/place-at-location',
      headers: { authorization: 'Bearer token' },
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

    await app.close();
  });

  it('LOCATION_OCCUPIED maps to the existing placement conflict response', async () => {
    const placementService = {
      placeContainerAtLocation: vi.fn(async () => {
        throw new LocationOccupiedError();
      })
    };
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getPlacementService: vi.fn(() => placementService as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/placement/place-at-location',
      headers: { authorization: 'Bearer token' },
      payload: {
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        locationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'PLACEMENT_CONFLICT'
    });

    await app.close();
  });

  it('LOCATION_NOT_ACTIVE maps to the existing not-writable response', async () => {
    const placementService = {
      placeContainerAtLocation: vi.fn(async () => {
        throw new LocationNotActiveError();
      })
    };
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getPlacementService: vi.fn(() => placementService as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/placement/place-at-location',
      headers: { authorization: 'Bearer token' },
      payload: {
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        locationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'LOCATION_NOT_WRITABLE'
    });

    await app.close();
  });

  it('CONTAINER_NOT_FOUND maps to the existing 404 response', async () => {
    const placementService = {
      placeContainerAtLocation: vi.fn(async () => {
        throw new ContainerNotFoundError();
      })
    };
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getPlacementService: vi.fn(() => placementService as never)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/placement/place-at-location',
      headers: { authorization: 'Bearer token' },
      payload: {
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        locationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: 'CONTAINER_NOT_FOUND'
    });

    await app.close();
  });

  it('unauthenticated request does not call getPlacementService', async () => {
    const getPlacementService = vi.fn();
    const app = buildApp({
      getPlacementService
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/placement/place-at-location',
      payload: {
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        locationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
      }
    });

    expect(response.statusCode).toBe(401);
    expect(getPlacementService).not.toHaveBeenCalled();

    await app.close();
  });

  it('authenticated request without currentTenant returns the existing 403 workspace error and does not call the service', async () => {
    const noTenantAuth = {
      ...authContext,
      currentTenant: null
    };
    const placementService = {
      placeContainerAtLocation: vi.fn()
    };
    const getPlacementService = vi.fn(() => placementService as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => noTenantAuth as never),
      getPlacementService
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/placement/place-at-location',
      headers: { authorization: 'Bearer token' },
      payload: {
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        locationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: 'WORKSPACE_UNAVAILABLE'
    });
    expect(getPlacementService).not.toHaveBeenCalled();

    await app.close();
  });
});
