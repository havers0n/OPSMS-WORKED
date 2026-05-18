import type { Cell, OperationsCellRuntime } from '@wos/domain';
import { generateRackCells } from '@wos/domain';
import { describe, expect, it } from 'vitest';
import { createLayoutDraftFixture } from '@/warehouse/editor/model/__fixtures__/layout-draft.fixture';
import { buildRackViewSummary, getRackStructureSummary } from './rack-view-inspector-logic';

function publishedCellsForFixture(): Cell[] {
  const draft = createLayoutDraftFixture();
  const rack = draft.racks[draft.rackIds[0]];
  return generateRackCells(draft.layoutVersionId, rack).map((cell) => ({
    ...cell,
    cellCode: cell.previewCellKey
  }));
}

function runtimeCell(input: {
  cellId: string;
  status: OperationsCellRuntime['status'];
  containerId: string;
  quantity: number;
  sku: string;
  itemName: string;
}): OperationsCellRuntime {
  return {
    cellId: input.cellId,
    cellAddress: input.cellId,
    status: input.status,
    pickActive: input.status === 'pick_active',
    reserved: input.status === 'reserved',
    quarantined: input.status === 'quarantined',
    stocked: input.status === 'stocked',
    containerCount: 1,
    totalQuantity: input.quantity,
    containers: [
      {
        containerId: input.containerId,
        externalCode: `EXT-${input.containerId}`,
        containerType: 'pallet',
        containerStatus: 'active',
        totalQuantity: input.quantity,
        itemCount: 1,
        items: [
          {
            itemRef: input.sku,
            productId: null,
            sku: input.sku,
            name: input.itemName,
            quantity: input.quantity,
            uom: 'ea',
            inventoryStatus: 'available'
          }
        ]
      }
    ]
  };
}

describe('rack view inspector summary', () => {
  it('counts published rack cells and treats missing runtime as empty', () => {
    const draft = createLayoutDraftFixture();
    const rack = draft.racks[draft.rackIds[0]];
    const cells = publishedCellsForFixture();
    const summary = buildRackViewSummary({
      rack,
      publishedCells: cells,
      operationsCells: [
        runtimeCell({
          cellId: cells[0].id,
          status: 'stocked',
          containerId: 'container-1',
          quantity: 12,
          sku: 'SKU-1',
          itemName: 'Pick face item'
        }),
        runtimeCell({
          cellId: cells[1].id,
          status: 'reserved',
          containerId: 'container-2',
          quantity: 5,
          sku: 'SKU-2',
          itemName: 'Reserve item'
        })
      ]
    });

    expect(summary.cellCount).toBe(3);
    expect(summary.occupiedCellCount).toBe(2);
    expect(summary.emptyCellCount).toBe(1);
    expect(summary.statusCounts.stocked).toBe(1);
    expect(summary.statusCounts.reserved).toBe(1);
    expect(summary.activeWorkCellCount).toBe(1);
    expect(summary.containerCount).toBe(2);
    expect(summary.totalQuantity).toBe(17);
    expect(summary.inventoryItems.map((item) => item.title)).toEqual([
      'Pick face item',
      'Reserve item'
    ]);
  });

  it('falls back to structural slot count when published cells are not available yet', () => {
    const draft = createLayoutDraftFixture();
    const rack = draft.racks[draft.rackIds[0]];
    const structure = getRackStructureSummary(rack);
    const summary = buildRackViewSummary({
      rack,
      publishedCells: [],
      operationsCells: []
    });

    expect(summary.cellCount).toBe(structure.slotCount);
    expect(summary.emptyCellCount).toBe(structure.slotCount);
    expect(summary.utilizationPercent).toBe(0);
  });
});
