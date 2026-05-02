import { describe, expect, it } from 'vitest';
import type { Cell } from '@wos/domain';
import { createLayoutDraftFixture } from '@/warehouse/editor/model/__fixtures__/layout-draft.fixture';
import { resolveRouteStepAnchors } from './route-step-geometry';

const step = {
  sequence: 1,
  taskId: 'task-1',
  fromLocationId: 'loc-1',
  skuId: 'sku-1',
  qtyToPick: 1,
  allocations: []
};

function createCell(rackId: string): Cell {
  return {
    id: 'cell-1',
    layoutVersionId: 'layout-version-1',
    rackId,
    rackFaceId: 'face-a-1',
    rackSectionId: 'section-a-1',
    rackLevelId: 'level-a-1',
    slotNo: 1,
    address: {
      raw: '01-A.01.01.01',
      parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: 1 },
      sortKey: '0001-A-01-01-01'
    },
    cellCode: 'CELL-1',
    status: 'active'
  };
}

describe('resolveRouteStepAnchors', () => {
  it('resolves anchors through locationsById cellId', () => {
    const layout = createLayoutDraftFixture();
    const rackId = layout.rackIds[0] as string;
    const anchors = resolveRouteStepAnchors({
      steps: [step],
      locationsById: {
        'loc-1': {
          id: 'loc-1',
          warehouseId: 'warehouse-1',
          addressLabel: 'A-01',
          cellId: 'cell-1'
        }
      },
      layout,
      publishedCellsById: new Map([['cell-1', createCell(rackId)]])
    });

    expect(anchors[0]).toMatchObject({
      status: 'resolved',
      stepId: 'task-1',
      source: 'cell'
    });
  });

  it('resolves anchors from direct finite projection coordinates', () => {
    const anchors = resolveRouteStepAnchors({
      steps: [step],
      locationsById: {
        'loc-1': {
          id: 'loc-1',
          warehouseId: 'warehouse-1',
          addressLabel: 'STAGE',
          x: 2,
          y: 3
        }
      },
      layout: null,
      publishedCellsById: new Map()
    });

    expect(anchors[0]).toMatchObject({
      status: 'resolved',
      point: { x: 80, y: 120 },
      source: 'projection'
    });
  });

  it('reports unresolved anchors for missing and invalid geometry', () => {
    expect(
      resolveRouteStepAnchors({
        steps: [step],
        locationsById: {},
        layout: null,
        publishedCellsById: new Map()
      })[0]
    ).toMatchObject({ status: 'unresolved', reason: 'missing-location-projection' });

    expect(
      resolveRouteStepAnchors({
        steps: [step],
        locationsById: {
          'loc-1': {
            id: 'loc-1',
            warehouseId: 'warehouse-1',
            addressLabel: 'BAD',
            x: Number.NaN,
            y: 1
          }
        },
        layout: null,
        publishedCellsById: new Map()
      })[0]
    ).toMatchObject({ status: 'unresolved', reason: 'invalid-projection-geometry' });
  });
});
