// @vitest-environment jsdom
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace, LocationOccupancyRow } from '@wos/domain';
import { useFloorSceneData } from './use-floor-scene-data';
import { locationKeys } from '@/entities/location/api/queries';
import { invalidatePlacementQueries } from '@/features/placement-actions/model/invalidation';
import {
  reconcileFloorOccupancyAfterPlacementMutation,
  type FloorOccupancyReconciliation
} from '@/features/placement-actions/model/floor-occupancy-reconciliation';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: () => ({
    data: [],
    isLoading: false
  })
}));

vi.mock('@/entities/location/api/use-floor-operations-cells', () => ({
  useFloorOperationsCells: () => ({
    data: [],
    isLoading: false
  })
}));

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

function createWorkspace(): FloorWorkspace {
  return {
    floorId: 'floor-1',
    activeDraft: null,
    latestPublished: null
  };
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeOccupancyRow(input: {
  cellId: string;
  containerId: string;
  locationId: string;
  locationCode: string;
}): LocationOccupancyRow {
  return {
    tenantId: 'tenant-1',
    floorId: 'floor-1',
    locationId: input.locationId,
    locationCode: input.locationCode,
    locationType: 'rack_slot',
    cellId: input.cellId,
    containerId: input.containerId,
    externalCode: null,
    containerType: 'pallet',
    containerStatus: 'active',
    placedAt: '2026-06-03T12:00:00.000Z'
  };
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false }
    }
  });
}

async function runReconciliationLifecycle(
  queryClient: QueryClient,
  reconciliation: FloorOccupancyReconciliation
) {
  await reconcileFloorOccupancyAfterPlacementMutation(queryClient, {
    floorId: 'floor-1',
    reconciliation,
    invalidate: () =>
      invalidatePlacementQueries(queryClient, {
        floorId: 'floor-1',
        containerId:
          reconciliation.kind === 'remove'
            ? reconciliation.containerId
            : reconciliation.kind === 'move'
              ? reconciliation.containerId
              : reconciliation.target.containerId
      })
  });
}

describe('useFloorSceneData placement runtime chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('move: stale refetch returns source row, but final cache and occupiedCellIds remain on target', async () => {
    const initialRows = [
      makeOccupancyRow({ cellId: 'cell-1', containerId: 'c-1', locationId: 'loc-source', locationCode: 'LOC-SRC' })
    ];
    const staleRefetchRows = [
      makeOccupancyRow({ cellId: 'cell-1', containerId: 'c-1', locationId: 'loc-source', locationCode: 'LOC-SRC' })
    ];
    const servedResponses: LocationOccupancyRow[][] = [];

    mockedBffRequest.mockImplementation(async (path: string) => {
      if (path !== '/api/floors/floor-1/location-occupancy') {
        throw new Error(`Unexpected BFF request: ${path}`);
      }
      const response = servedResponses.length === 0 ? initialRows : staleRefetchRows;
      servedResponses.push(response);
      return response;
    });

    const queryClient = makeQueryClient();
    const occupancyKey = locationKeys.occupancyByFloor('floor-1');
    const { result } = renderHook(
      () => useFloorSceneData({ viewMode: 'storage', workspace: createWorkspace() }),
      { wrapper: makeWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.occupiedCellIds.has('cell-1')).toBe(true));

    await act(async () => {
      await runReconciliationLifecycle(queryClient, {
        kind: 'move',
        containerId: 'c-1',
        target: {
          floorId: 'floor-1',
          cellId: 'cell-2',
          containerId: 'c-1',
          locationId: 'loc-target',
          locationCode: 'LOC-TGT',
          locationType: 'rack_slot'
        }
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(occupancyKey)).toEqual([
        makeOccupancyRow({ cellId: 'cell-2', containerId: 'c-1', locationId: 'loc-target', locationCode: 'LOC-TGT' })
      ]);
      expect(result.current.occupiedCellIds.has('cell-2')).toBe(true);
      expect(result.current.occupiedCellIds.has('cell-1')).toBe(false);
    });

    expect(servedResponses[1]).toEqual(staleRefetchRows);
  });

  it('move: fresh refetch returns target row, final cache remains correct with no duplicate', async () => {
    const initialRows = [
      makeOccupancyRow({ cellId: 'cell-1', containerId: 'c-1', locationId: 'loc-source', locationCode: 'LOC-SRC' })
    ];
    const freshRefetchRows = [
      makeOccupancyRow({ cellId: 'cell-2', containerId: 'c-1', locationId: 'loc-target', locationCode: 'LOC-TGT' })
    ];
    let callCount = 0;

    mockedBffRequest.mockImplementation(async (path: string) => {
      if (path !== '/api/floors/floor-1/location-occupancy') {
        throw new Error(`Unexpected BFF request: ${path}`);
      }
      callCount += 1;
      return callCount === 1 ? initialRows : freshRefetchRows;
    });

    const queryClient = makeQueryClient();
    const occupancyKey = locationKeys.occupancyByFloor('floor-1');
    renderHook(() => useFloorSceneData({ viewMode: 'storage', workspace: createWorkspace() }), {
      wrapper: makeWrapper(queryClient)
    });

    await waitFor(() => {
      expect((queryClient.getQueryData(occupancyKey) as LocationOccupancyRow[] | undefined)?.[0]?.cellId).toBe('cell-1');
    });

    await act(async () => {
      await runReconciliationLifecycle(queryClient, {
        kind: 'move',
        containerId: 'c-1',
        target: {
          floorId: 'floor-1',
          cellId: 'cell-2',
          containerId: 'c-1',
          locationId: 'loc-target',
          locationCode: 'LOC-TGT',
          locationType: 'rack_slot'
        }
      });
    });

    const finalRows = queryClient.getQueryData(occupancyKey) as LocationOccupancyRow[];
    expect(finalRows).toEqual(freshRefetchRows);
    expect(finalRows.filter((row) => row.containerId === 'c-1')).toHaveLength(1);
  });

  it('remove: stale refetch restores source row, but final cache remains cleared', async () => {
    const initialRows = [
      makeOccupancyRow({ cellId: 'cell-1', containerId: 'c-1', locationId: 'loc-source', locationCode: 'LOC-SRC' })
    ];
    const staleRefetchRows = [
      makeOccupancyRow({ cellId: 'cell-1', containerId: 'c-1', locationId: 'loc-source', locationCode: 'LOC-SRC' })
    ];
    let callCount = 0;

    mockedBffRequest.mockImplementation(async (path: string) => {
      if (path !== '/api/floors/floor-1/location-occupancy') {
        throw new Error(`Unexpected BFF request: ${path}`);
      }
      callCount += 1;
      return callCount === 1 ? initialRows : staleRefetchRows;
    });

    const queryClient = makeQueryClient();
    const occupancyKey = locationKeys.occupancyByFloor('floor-1');
    renderHook(() => useFloorSceneData({ viewMode: 'storage', workspace: createWorkspace() }), {
      wrapper: makeWrapper(queryClient)
    });

    await waitFor(() => {
      expect((queryClient.getQueryData(occupancyKey) as LocationOccupancyRow[] | undefined)?.[0]?.cellId).toBe('cell-1');
    });

    await act(async () => {
      await runReconciliationLifecycle(queryClient, {
        kind: 'remove',
        containerId: 'c-1'
      });
    });

    expect(queryClient.getQueryData(occupancyKey)).toEqual([]);
  });

  it('create + product: stale refetch omits target row, but final cache remains occupied', async () => {
    const initialRows: LocationOccupancyRow[] = [];
    const staleRefetchRows: LocationOccupancyRow[] = [];
    let callCount = 0;

    mockedBffRequest.mockImplementation(async (path: string) => {
      if (path !== '/api/floors/floor-1/location-occupancy') {
        throw new Error(`Unexpected BFF request: ${path}`);
      }
      callCount += 1;
      return callCount === 1 ? initialRows : staleRefetchRows;
    });

    const queryClient = makeQueryClient();
    const occupancyKey = locationKeys.occupancyByFloor('floor-1');
    renderHook(() => useFloorSceneData({ viewMode: 'storage', workspace: createWorkspace() }), {
      wrapper: makeWrapper(queryClient)
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(occupancyKey)).toEqual(initialRows);
    });

    await act(async () => {
      await runReconciliationLifecycle(queryClient, {
        kind: 'add',
        target: {
          floorId: 'floor-1',
          cellId: 'cell-2',
          containerId: 'c-1',
          locationId: 'loc-target',
          locationCode: 'LOC-TGT',
          locationType: 'rack_slot',
          containerType: 'pallet'
        }
      });
    });

    expect(queryClient.getQueryData(occupancyKey)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cellId: 'cell-2',
          containerId: 'c-1',
          locationId: 'loc-target',
          locationCode: 'LOC-TGT',
          locationType: 'rack_slot'
        })
      ])
    );
  });
});
