import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';

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

const validMoveResult = {
  containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
  sourceLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
  targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
  movementId: 'a8c1ab0f-2917-4ae0-b332-fd50f39db123',
  occurredAt: '2026-03-16T08:00:00.000Z'
};

const validSwapResult = {
  sourceContainerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
  targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
  sourceContainerNewLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
  targetContainerNewLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
  sourceMovementId: 'a8c1ab0f-2917-4ae0-b332-fd50f39db123',
  targetMovementId: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
  occurredAt: '2026-03-16T08:02:00.000Z'
};

const validTransferResult = {
  sourceInventoryUnitId: 'e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c',
  targetInventoryUnitId: '4173ae09-8e9d-4bb3-bb15-d32a8f95b041',
  sourceContainerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
  targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
  sourceLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
  targetLocationId: null,
  quantity: 1,
  uom: 'pcs',
  mergeApplied: false,
  sourceQuantity: 7,
  targetQuantity: 1,
  movementId: 'a8c1ab0f-2917-4ae0-b332-fd50f39db123',
  splitMovementId: 'a8c1ab0f-2917-4ae0-b332-fd50f39db123',
  transferMovementId: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
  occurredAt: '2026-03-16T08:10:00.000Z'
};

function createRpcMock() {
  return vi.fn<(fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code: string; message: string } | null }>>();
}

function createSupabaseStub(rpc: ReturnType<typeof createRpcMock>) {
  return {
    from: vi.fn(),
    rpc
  };
}

describe('execution routes', () => {
  describe('POST /api/containers/:containerId/move-to-location', () => {
    it('authenticated happy path forwards containerId and body unchanged', async () => {
      const rpc = createRpcMock();
      rpc.mockResolvedValue({ data: validMoveResult, error: null });
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/move-to-location',
        headers: { authorization: 'Bearer token' },
        payload: { targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(validMoveResult);
      expect(rpc).toHaveBeenCalledWith('move_container_canonical', {
        container_uuid: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        target_location_uuid: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
        actor_uuid: authContext.user.id
      });

      await app.close();
    });

    it('representative execution error preserves existing mapped status and code', async () => {
      const rpc = createRpcMock();
      rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'CONTAINER_NOT_FOUND' } });
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/move-to-location',
        headers: { authorization: 'Bearer token' },
        payload: { targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64' }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        code: 'CONTAINER_NOT_FOUND',
        message: 'Container was not found.'
      });

      await app.close();
    });

    it('invalid containerId returns existing validation error', async () => {
      const rpc = createRpcMock();
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/not-a-uuid/move-to-location',
        headers: { authorization: 'Bearer token' },
        payload: { targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64' }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: 'VALIDATION_ERROR'
      });
      expect(rpc).not.toHaveBeenCalled();

      await app.close();
    });
  });

  describe('POST /api/containers/:containerId/swap', () => {
    it('authenticated happy path forwards arguments unchanged', async () => {
      const rpc = createRpcMock();
      rpc.mockResolvedValue({ data: validSwapResult, error: null });
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/swap',
        headers: { authorization: 'Bearer token' },
        payload: { targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(validSwapResult);
      expect(rpc).toHaveBeenCalledWith('swap_containers_canonical', {
        source_container_uuid: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        target_container_uuid: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
        actor_uuid: authContext.user.id
      });

      await app.close();
    });

    it('representative swap error preserves existing mapped status and code', async () => {
      const rpc = createRpcMock();
      rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'TARGET_CONTAINER_NOT_FOUND' } });
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/swap',
        headers: { authorization: 'Bearer token' },
        payload: { targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2' }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        code: 'TARGET_CONTAINER_NOT_FOUND',
        message: 'Target container was not found.'
      });

      await app.close();
    });

    it('invalid body returns existing validation error', async () => {
      const rpc = createRpcMock();
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/swap',
        headers: { authorization: 'Bearer token' },
        payload: { targetContainerId: 'not-a-uuid' }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: 'VALIDATION_ERROR'
      });
      expect(rpc).not.toHaveBeenCalled();

      await app.close();
    });
  });

  describe('POST /api/inventory/:inventoryUnitId/transfer', () => {
    it('authenticated happy path forwards inventoryUnitId and body unchanged', async () => {
      const rpc = createRpcMock();
      rpc.mockResolvedValue({ data: validTransferResult, error: null });
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/inventory/e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c/transfer',
        headers: { authorization: 'Bearer token' },
        payload: { quantity: 1, targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(validTransferResult);
      expect(rpc).toHaveBeenCalledWith('transfer_inventory_unit', {
        source_inventory_unit_uuid: 'e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c',
        quantity: 1,
        target_container_uuid: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
        actor_uuid: authContext.user.id
      });

      await app.close();
    });

    it('representative transfer error preserves existing mapped status and code', async () => {
      const rpc = createRpcMock();
      rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'SOURCE_INVENTORY_UNIT_NOT_FOUND' } });
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/inventory/e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c/transfer',
        headers: { authorization: 'Bearer token' },
        payload: { quantity: 1, targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2' }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        code: 'INVENTORY_UNIT_NOT_FOUND',
        message: 'Inventory unit was not found.'
      });

      await app.close();
    });

    it('invalid inventoryUnitId returns existing validation error', async () => {
      const rpc = createRpcMock();
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/inventory/not-a-uuid/transfer',
        headers: { authorization: 'Bearer token' },
        payload: { quantity: 1, targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2' }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: 'VALIDATION_ERROR'
      });
      expect(rpc).not.toHaveBeenCalled();

      await app.close();
    });
  });

  describe('POST /api/inventory/:inventoryUnitId/pick-partial', () => {
    it('authenticated happy path forwards inventoryUnitId and body unchanged', async () => {
      const rpc = createRpcMock();
      rpc.mockResolvedValue({ data: validTransferResult, error: null });
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/inventory/e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c/pick-partial',
        headers: { authorization: 'Bearer token' },
        payload: { quantity: 1, pickContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(validTransferResult);
      expect(rpc).toHaveBeenCalledWith('pick_partial_inventory_unit', {
        source_inventory_unit_uuid: 'e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c',
        quantity: 1,
        pick_container_uuid: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
        actor_uuid: authContext.user.id
      });

      await app.close();
    });

    it('representative invalid split quantity error preserves existing mapped status and code', async () => {
      const rpc = createRpcMock();
      rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'INVALID_SPLIT_QUANTITY' } });
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/inventory/e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c/pick-partial',
        headers: { authorization: 'Bearer token' },
        payload: { quantity: 1, pickContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2' }
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        code: 'INVALID_SPLIT_QUANTITY',
        message: 'Split quantity must be greater than zero and less than the source quantity.'
      });

      await app.close();
    });

    it('invalid body returns existing validation error', async () => {
      const rpc = createRpcMock();
      const getUserSupabase = vi.fn(() => createSupabaseStub(rpc) as never);

      const app = buildApp({
        getAuthContext: vi.fn(async () => authContext as never),
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/inventory/e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c/pick-partial',
        headers: { authorization: 'Bearer token' },
        payload: { quantity: -1, pickContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2' }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: 'VALIDATION_ERROR'
      });
      expect(rpc).not.toHaveBeenCalled();

      await app.close();
    });
  });

  describe('cross-cutting', () => {
    it('unauthenticated request does not call getUserSupabase', async () => {
      const getUserSupabase = vi.fn();
      const app = buildApp({
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/move-to-location',
        payload: { targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64' }
      });

      expect(response.statusCode).toBe(401);
      expect(getUserSupabase).not.toHaveBeenCalled();

      await app.close();
    });

    it('unauthenticated request does not create execution service', async () => {
      const getUserSupabase = vi.fn();
      const app = buildApp({
        getUserSupabase
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/inventory/e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c/transfer',
        payload: { quantity: 1, targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2' }
      });

      expect(response.statusCode).toBe(401);
      expect(getUserSupabase).not.toHaveBeenCalled();

      await app.close();
    });
  });
});
