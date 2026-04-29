import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listOperationsCellsRuntime } from './service.js';

const mockListPublishedCells = vi.fn();
const mockListFloorLocationOccupancy = vi.fn();
const mockListCellStorageByIds = vi.fn();
const mockAttachProductsToRows = vi.fn();

vi.mock('../layout/repo.js', () => ({
  createLayoutRepo: () => ({
    listPublishedCells: mockListPublishedCells
  })
}));

vi.mock('../location-read/location-read-repo.js', () => ({
  createLocationReadRepo: () => ({
    listFloorLocationOccupancy: mockListFloorLocationOccupancy,
    listCellStorageByIds: mockListCellStorageByIds
  })
}));

vi.mock('../../inventory-product-resolution.js', () => ({
  attachProductsToRows: (...args: unknown[]) => mockAttachProductsToRows(...args)
}));

type PickStep = { source_cell_id: string; status: 'pending' | 'partial' | 'done' };

function createSupabaseStub(pickSteps: PickStep[] = []) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          in: vi.fn(async () => ({ data: pickSteps, error: null }))
        }))
      }))
    }))
  } as unknown as Parameters<typeof listOperationsCellsRuntime>[0]['supabase'];
}

describe('operations cells service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAttachProductsToRows.mockImplementation(async (_supabase, rows) => rows);
  });

  it('returns [] when no published cells exist', async () => {
    mockListPublishedCells.mockResolvedValue([]);
    const supabase = createSupabaseStub();

    const result = await listOperationsCellsRuntime({ supabase }, 'floor-1');

    expect(result).toEqual([]);
    expect(mockListFloorLocationOccupancy).not.toHaveBeenCalled();
    expect(mockListCellStorageByIds).not.toHaveBeenCalled();
  });

  it('resolves stocked status and sums quantities by container', async () => {
    mockListPublishedCells.mockResolvedValue([{ id: 'cell-1', address: { raw: 'A-01' } }]);
    mockListFloorLocationOccupancy.mockResolvedValue([]);
    mockListCellStorageByIds.mockResolvedValue([
      {
        cell_id: 'cell-1',
        container_id: 'container-1',
        external_code: 'C-1',
        container_type: 'tote',
        container_status: 'active',
        item_ref: 'item-1',
        uom: 'ea',
        quantity: 2,
        inventory_status: 'available'
      },
      {
        cell_id: 'cell-1',
        container_id: 'container-1',
        external_code: 'C-1',
        container_type: 'tote',
        container_status: 'active',
        item_ref: 'item-2',
        uom: 'ea',
        quantity: 3,
        inventory_status: 'available'
      }
    ]);

    const result = await listOperationsCellsRuntime({ supabase: createSupabaseStub() }, 'floor-1');

    expect(result[0].status).toBe('stocked');
    expect(result[0].totalQuantity).toBe(5);
    expect(result[0].containers[0].totalQuantity).toBe(5);
  });

  it('resolves reserved for reserved or hold inventory', async () => {
    mockListPublishedCells.mockResolvedValue([
      { id: 'cell-reserved', address: { raw: 'A-01' } },
      { id: 'cell-hold', address: { raw: 'A-02' } }
    ]);
    mockListFloorLocationOccupancy.mockResolvedValue([]);
    mockListCellStorageByIds.mockResolvedValue([
      {
        cell_id: 'cell-reserved', container_id: 'c1', external_code: null, container_type: 'bin', container_status: 'active',
        item_ref: 'i1', uom: 'ea', quantity: 1, inventory_status: 'reserved'
      },
      {
        cell_id: 'cell-hold', container_id: 'c2', external_code: null, container_type: 'bin', container_status: 'active',
        item_ref: 'i2', uom: 'ea', quantity: 1, inventory_status: 'hold'
      }
    ]);

    const result = await listOperationsCellsRuntime({ supabase: createSupabaseStub() }, 'floor-1');

    expect(result.find((c) => c.cellId === 'cell-reserved')?.status).toBe('reserved');
    expect(result.find((c) => c.cellId === 'cell-hold')?.status).toBe('reserved');
  });

  it('resolves pick_active for pending and partial pick steps', async () => {
    mockListPublishedCells.mockResolvedValue([{ id: 'cell-1', address: { raw: 'A-01' } }]);
    mockListFloorLocationOccupancy.mockResolvedValue([]);
    mockListCellStorageByIds.mockResolvedValue([]);

    const pendingResult = await listOperationsCellsRuntime(
      { supabase: createSupabaseStub([{ source_cell_id: 'cell-1', status: 'pending' }]) },
      'floor-1'
    );
    const partialResult = await listOperationsCellsRuntime(
      { supabase: createSupabaseStub([{ source_cell_id: 'cell-1', status: 'partial' }]) },
      'floor-1'
    );

    expect(pendingResult[0].status).toBe('pick_active');
    expect(partialResult[0].status).toBe('pick_active');
  });

  it('resolves quarantined status and applies status priority', async () => {
    mockListPublishedCells.mockResolvedValue([{ id: 'cell-1', address: { raw: 'A-01' } }]);
    mockListFloorLocationOccupancy.mockResolvedValue([]);
    mockListCellStorageByIds.mockResolvedValue([
      {
        cell_id: 'cell-1',
        container_id: 'c1',
        external_code: null,
        container_type: 'bin',
        container_status: 'quarantined',
        item_ref: 'i1',
        uom: 'ea',
        quantity: 5,
        inventory_status: 'reserved'
      }
    ]);

    const result = await listOperationsCellsRuntime(
      { supabase: createSupabaseStub([{ source_cell_id: 'cell-1', status: 'pending' }]) },
      'floor-1'
    );

    expect(result[0]).toMatchObject({
      quarantined: true,
      pickActive: true,
      reserved: true,
      stocked: true,
      status: 'quarantined'
    });
  });

  it('only includes items with both item_ref and uom in itemCount/items', async () => {
    mockListPublishedCells.mockResolvedValue([{ id: 'cell-1', address: { raw: 'A-01' } }]);
    mockListFloorLocationOccupancy.mockResolvedValue([]);
    mockListCellStorageByIds.mockResolvedValue([
      { cell_id: 'cell-1', container_id: 'c1', external_code: null, container_type: 'bin', container_status: 'active', item_ref: 'ok', uom: 'ea', quantity: 1, inventory_status: 'available' },
      { cell_id: 'cell-1', container_id: 'c1', external_code: null, container_type: 'bin', container_status: 'active', item_ref: null, uom: 'ea', quantity: 2, inventory_status: 'available' },
      { cell_id: 'cell-1', container_id: 'c1', external_code: null, container_type: 'bin', container_status: 'active', item_ref: 'no-uom', uom: null, quantity: 3, inventory_status: 'available' }
    ]);

    const result = await listOperationsCellsRuntime({ supabase: createSupabaseStub() }, 'floor-1');
    const container = result[0].containers[0];

    expect(container.itemCount).toBe(1);
    expect(container.items).toHaveLength(1);
    expect(container.items[0]).toMatchObject({ itemRef: 'ok', uom: 'ea' });
    expect(container.totalQuantity).toBe(6);
    expect(result[0].totalQuantity).toBe(6);
  });
});
