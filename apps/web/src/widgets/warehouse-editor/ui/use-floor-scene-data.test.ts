import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cell, FloorWorkspace, OperationsCellRuntime } from '@wos/domain';
import { useFloorSceneData } from './use-floor-scene-data';

let mockOccupancyRows: Array<{ cellId: string | null }> = [];
let mockOperationsCells: OperationsCellRuntime[] = [];
let mockPublishedCells: Cell[] = [];

const occupancySpy = vi.fn<(floorId: string | null) => { data: Array<{ cellId: string | null }> }>();
const operationsSpy = vi.fn<(floorId: string | null) => { data: OperationsCellRuntime[] }>();
const publishedSpy = vi.fn<(floorId: string | null) => { data: Cell[] }>();

vi.mock('@/entities/location/api/use-floor-location-occupancy', () => ({
  useFloorLocationOccupancy: (floorId: string | null) => occupancySpy(floorId)
}));

vi.mock('@/entities/location/api/use-floor-operations-cells', () => ({
  useFloorOperationsCells: (floorId: string | null) => operationsSpy(floorId)
}));

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: (floorId: string | null) => publishedSpy(floorId)
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type SceneDataResult = ReturnType<typeof useFloorSceneData>;

function createWorkspace(): FloorWorkspace {
  return {
    id: 'workspace-1',
    floorId: 'floor-1',
    name: 'Floor 1',
    draftLayoutVersionId: null,
    publishedLayoutVersionId: null
  };
}

function createCell(id: string, slotNo: number): Cell {
  return {
    id,
    layoutVersionId: 'layout-version-1',
    rackId: 'rack-1',
    rackFaceId: 'face-a',
    rackSectionId: 'section-a',
    rackLevelId: 'level-1',
    slotNo,
    cellCode: `CELL-${slotNo}`,
    address: {
      raw: `R-01-A.01.01.0${slotNo}`,
      parts: {
        rackCode: 'R-01',
        face: 'A',
        section: 1,
        level: 1,
        slot: slotNo
      },
      sortKey: `0001-A-01-01-0${slotNo}`
    },
    status: 'active'
  };
}

function createOperationsCell(cellId: string, status: OperationsCellRuntime['status']): OperationsCellRuntime {
  return {
    cellId,
    cellAddress: 'R-01-A.01.01.01',
    status,
    pickActive: status === 'pick_active',
    reserved: status === 'reserved',
    quarantined: status === 'quarantined',
    stocked: status === 'stocked',
    containerCount: status === 'empty' ? 0 : 1,
    totalQuantity: status === 'empty' ? 0 : 5,
    containers: []
  };
}

function renderSceneData(params: { viewMode: 'layout' | 'view' | 'storage'; workspace: FloorWorkspace | null }) {
  let result!: SceneDataResult;

  function Harness() {
    result = useFloorSceneData(params);
    return null;
  }

  act(() => {
    TestRenderer.create(createElement(Harness));
  });

  return result;
}

describe('useFloorSceneData characterization', () => {
  beforeEach(() => {
    mockOccupancyRows = [];
    mockOperationsCells = [];
    mockPublishedCells = [];
    occupancySpy.mockReset();
    operationsSpy.mockReset();
    publishedSpy.mockReset();
    occupancySpy.mockImplementation((floorId) => {
      return { data: floorId ? mockOccupancyRows : [] };
    });
    operationsSpy.mockImplementation((floorId) => {
      return { data: floorId ? mockOperationsCells : [] };
    });
    publishedSpy.mockImplementation((floorId) => {
      return { data: floorId ? mockPublishedCells : [] };
    });
  });

  it('uses occupancy, published cells, and runtime truth in view mode', () => {
    mockOccupancyRows = [{ cellId: 'cell-1' }];
    mockOperationsCells = [createOperationsCell('cell-1', 'reserved')];
    mockPublishedCells = [createCell('cell-1', 1)];

    const result = renderSceneData({ viewMode: 'view', workspace: createWorkspace() });

    expect(occupancySpy).toHaveBeenCalledWith('floor-1');
    expect(operationsSpy).toHaveBeenCalledWith('floor-1');
    expect(publishedSpy).toHaveBeenCalledWith('floor-1');
    expect(result.occupiedCellIds.has('cell-1')).toBe(true);
    expect(result.floorOperationsCellsById.get('cell-1')?.status).toBe('reserved');
    expect(result.publishedCellsById.get('cell-1')?.id).toBe('cell-1');
    expect(result.publishedCellsByStructure.size).toBe(1);
  });

  it('uses occupancy and published cells in storage mode but does not load runtime truth', () => {
    mockOccupancyRows = [{ cellId: 'cell-2' }];
    mockOperationsCells = [createOperationsCell('cell-2', 'pick_active')];
    mockPublishedCells = [createCell('cell-2', 2)];

    const result = renderSceneData({ viewMode: 'storage', workspace: createWorkspace() });

    expect(occupancySpy).toHaveBeenCalledWith('floor-1');
    expect(operationsSpy).toHaveBeenCalledWith(null);
    expect(publishedSpy).toHaveBeenCalledWith('floor-1');
    expect(result.occupiedCellIds.has('cell-2')).toBe(true);
    expect(result.floorOperationsCellsById.size).toBe(0);
    expect(result.publishedCellsById.get('cell-2')?.id).toBe('cell-2');
  });

  it('does not consume storage truth in layout mode', () => {
    mockOccupancyRows = [{ cellId: 'cell-1' }];
    mockOperationsCells = [createOperationsCell('cell-1', 'stocked')];
    mockPublishedCells = [createCell('cell-1', 1)];

    const result = renderSceneData({ viewMode: 'layout', workspace: createWorkspace() });

    expect(occupancySpy).toHaveBeenCalledWith(null);
    expect(operationsSpy).toHaveBeenCalledWith(null);
    expect(publishedSpy).toHaveBeenCalledWith(null);
    expect(result.occupiedCellIds.size).toBe(0);
    expect(result.floorOperationsCellsById.size).toBe(0);
    expect(result.publishedCells).toEqual([]);
  });

  it.todo('will align view and storage base + fill data inputs once PR2 lands');
});

