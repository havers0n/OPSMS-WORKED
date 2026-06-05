import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { Cell } from '@wos/domain';
import { createLayoutDraftFixture } from '@/warehouse/editor/model/__fixtures__/layout-draft.fixture';
import { PickingRouteOverlayLayer } from '@/features/picking-planning-canvas/ui/picking-route-overlay-layer';
import { resolveRouteStepAnchors, solvePickingRoute } from '@/features/picking-planning-canvas/model/route-step-geometry';
import { buildPickingRouteDebugSummary } from './picking-route-debug-summary';

vi.mock('react-konva', () => ({
  Arrow: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Arrow', props, children),
  Circle: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Circle', props, children),
  Line: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Line', props, children),
  Rect: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Rect', props, children),
  Text: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Text', props, children)
}));

const baseStep = {
  sequence: 1,
  skuId: 'sku-1',
  qtyToPick: 1,
  allocations: []
};

function createCell(cellId: string, rackId: string, slotNo: number): Cell {
  return {
    id: cellId,
    layoutVersionId: 'layout-version-1',
    rackId,
    rackFaceId: 'face-a-1',
    rackSectionId: 'section-a-1',
    rackLevelId: 'level-a-1',
    slotNo,
    address: {
      raw: `01-A.01.01.0${slotNo}`,
      parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: slotNo },
      sortKey: `0001-A-01-01-0${slotNo}`
    },
    cellCode: `CELL-${slotNo}`,
    status: 'active'
  };
}

function renderFallbackArrowCount(anchors: ReturnType<typeof resolveRouteStepAnchors>, segments: ReturnType<typeof solvePickingRoute>) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(PickingRouteOverlayLayer, { anchors, solvedSegments: segments })
    );
  });
  return renderer.root.findAll((node) => String(node.type) === 'Arrow').length;
}

describe('picking route debug summary scenarios', () => {
  const layout = createLayoutDraftFixture();
  const rackId = layout.rackIds[0] as string;
  const cell1 = createCell('cell-1', rackId, 1);
  const cell2 = createCell('cell-2', rackId, 2);
  const cell3 = createCell('cell-3', rackId, 3);

  it('Case A: preview available while published cells are still pending', () => {
    const steps = [
      { ...baseStep, taskId: 'task-1', fromLocationId: 'loc-1' },
      { ...baseStep, taskId: 'task-2', fromLocationId: 'loc-2' }
    ];
    const locationsById = {
      'loc-1': { id: 'loc-1', warehouseId: 'warehouse-1', addressLabel: 'A-01', cellId: cell1.id },
      'loc-2': { id: 'loc-2', warehouseId: 'warehouse-1', addressLabel: 'A-02', cellId: cell2.id }
    };
    const anchors = resolveRouteStepAnchors({
      steps,
      locationsById,
      layout,
      publishedCellsById: new Map()
    });
    const segments = solvePickingRoute(anchors, []);
    const debug = buildPickingRouteDebugSummary({
      routeSteps: steps,
      locationsById,
      publishedCellsById: new Map(),
      publishedCellsQueryStatus: 'pending',
      aisleTopologyQueryStatus: 'pending',
      faceAccessByFaceId: undefined,
      anchors,
      segments
    });

    expect(debug.publishedCellsQueryStatus).toBe('pending');
    expect(debug.requiredCellIdsCount).toBe(2);
    expect(debug.missingRequiredCellIds).toEqual(['cell-1', 'cell-2']);
    expect(debug.anchorsResolvedCount).toBe(0);
    expect(debug.anchorsUnresolvedCount).toBe(2);
    expect(debug.segments.map((segment) => segment.status)).toEqual(['skipped']);
    expect(renderFallbackArrowCount(anchors, segments)).toBe(0);
  });

  it('Case B: preview and cells ready while aisle topology is still pending', () => {
    const steps = [
      { ...baseStep, taskId: 'task-1', fromLocationId: 'loc-1' },
      { ...baseStep, taskId: 'task-2', fromLocationId: 'loc-2' }
    ];
    const locationsById = {
      'loc-1': { id: 'loc-1', warehouseId: 'warehouse-1', addressLabel: 'A-01', cellId: cell1.id },
      'loc-2': { id: 'loc-2', warehouseId: 'warehouse-1', addressLabel: 'A-02', cellId: cell2.id }
    };
    const anchors = resolveRouteStepAnchors({
      steps,
      locationsById,
      layout,
      publishedCellsById: new Map([
        [cell1.id, cell1],
        [cell2.id, cell2]
      ])
    });
    const segments = solvePickingRoute(anchors, []);
    const debug = buildPickingRouteDebugSummary({
      routeSteps: steps,
      locationsById,
      publishedCellsById: new Map([
        [cell1.id, cell1],
        [cell2.id, cell2]
      ]),
      publishedCellsQueryStatus: 'success',
      aisleTopologyQueryStatus: 'pending',
      faceAccessByFaceId: undefined,
      anchors,
      segments
    });

    expect(anchors.every((anchor) => anchor.status === 'resolved')).toBe(true);
    expect(anchors.every((anchor) => anchor.status !== 'resolved' || anchor.source === 'pick-point')).toBe(true);
    expect(debug.aisleTopologyQueryStatus).toBe('pending');
    expect(debug.faceAccessByFaceIdSize).toBe(0);
    expect(debug.anchorsResolvedCount).toBe(2);
    expect(debug.segments.map((segment) => segment.status)).toEqual(['ok']);
  });

  it('Case C: cells ready but one required published cell is missing', () => {
    const steps = [
      { ...baseStep, taskId: 'task-1', fromLocationId: 'loc-1' },
      { ...baseStep, taskId: 'task-2', fromLocationId: 'loc-2' }
    ];
    const locationsById = {
      'loc-1': { id: 'loc-1', warehouseId: 'warehouse-1', addressLabel: 'A-01', cellId: cell1.id },
      'loc-2': { id: 'loc-2', warehouseId: 'warehouse-1', addressLabel: 'A-02', cellId: cell2.id }
    };
    const publishedCellsById = new Map([[cell1.id, cell1]]);
    const anchors = resolveRouteStepAnchors({
      steps,
      locationsById,
      layout,
      publishedCellsById
    });
    const segments = solvePickingRoute(anchors, []);
    const debug = buildPickingRouteDebugSummary({
      routeSteps: steps,
      locationsById,
      publishedCellsById,
      publishedCellsQueryStatus: 'success',
      aisleTopologyQueryStatus: 'success',
      faceAccessByFaceId: new Map(),
      anchors,
      segments
    });

    expect(anchors.map((anchor) => anchor.status)).toEqual(['resolved', 'unresolved']);
    expect(anchors[1]).toMatchObject({ status: 'unresolved', reason: 'missing-published-cell' });
    expect(debug.missingRequiredCellIds).toEqual(['cell-2']);
    expect(debug.segments.map((segment) => segment.status)).toEqual(['skipped']);
  });

  it('Case D: preview, cells, and topology ready solves normally', () => {
    const steps = [
      { ...baseStep, taskId: 'task-1', fromLocationId: 'loc-1' },
      { ...baseStep, taskId: 'task-2', fromLocationId: 'loc-2' },
      { ...baseStep, taskId: 'task-3', fromLocationId: 'loc-3' }
    ];
    const locationsById = {
      'loc-1': { id: 'loc-1', warehouseId: 'warehouse-1', addressLabel: 'A-01', cellId: cell1.id },
      'loc-2': { id: 'loc-2', warehouseId: 'warehouse-1', addressLabel: 'A-02', cellId: cell2.id },
      'loc-3': { id: 'loc-3', warehouseId: 'warehouse-1', addressLabel: 'A-03', cellId: cell3.id }
    };
    const publishedCellsById = new Map([
      [cell1.id, cell1],
      [cell2.id, cell2],
      [cell3.id, cell3]
    ]);
    const anchors = resolveRouteStepAnchors({
      steps,
      locationsById,
      layout,
      publishedCellsById,
      faceAccessByFaceId: new Map([[cell1.rackFaceId, { faceId: cell1.rackFaceId, normalX: 0, normalY: -1 }]])
    });
    const segments = solvePickingRoute(anchors, []);
    const debug = buildPickingRouteDebugSummary({
      routeSteps: steps,
      locationsById,
      publishedCellsById,
      publishedCellsQueryStatus: 'success',
      aisleTopologyQueryStatus: 'success',
      faceAccessByFaceId: new Map([[cell1.rackFaceId, { faceId: cell1.rackFaceId, normalX: 0, normalY: -1 }]]),
      anchors,
      segments
    });

    expect(debug.missingRequiredCellIds).toEqual([]);
    expect(debug.anchorsResolvedCount).toBe(3);
    expect(debug.segments.map((segment) => segment.status)).toEqual(['ok', 'ok']);
  });
});
