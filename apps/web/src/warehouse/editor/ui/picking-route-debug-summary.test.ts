import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { Cell } from '@wos/domain';
import { createLayoutDraftFixture } from '@/warehouse/editor/model/__fixtures__/layout-draft.fixture';
import { PickingRouteOverlayLayer } from '@/features/picking-planning-canvas/ui/picking-route-overlay-layer';
import { resolveRouteStepAnchors, solvePickingRoute } from '@/features/picking-planning-canvas/model/route-step-geometry';
import type { PickingRouteAnchor, SolvedRouteSegment } from '@/features/picking-planning-canvas/model/route-step-geometry';
import type { RouteObstacle } from '@/features/obstacle-route-planning/model/obstacle-types';
import {
  buildAnchorSignature,
  buildObstacleSignature,
  buildPickingRouteDebugSummary,
  buildPickingRouteDetailedDiagnostics,
  isPickingRouteDetailedDiagnosticsEnabled
} from './picking-route-debug-summary';

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
  qtyEach: null,
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

function renderFallbackArrowCount(
  anchors: ReturnType<typeof resolveRouteStepAnchors>,
  segments: ReturnType<typeof solvePickingRoute>
) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(PickingRouteOverlayLayer, { anchors, solvedSegments: segments })
    );
  });
  return renderer.root.findAll((node) => String(node.type) === 'Arrow').length;
}

describe('picking route detailed diagnostics authorization', () => {
  const tenantAdmin = [
    {
      tenantId: 'tenant-1',
      tenantCode: 'tenant-1',
      tenantName: 'Tenant 1',
      role: 'tenant_admin' as const
    }
  ];

  it('DEV mode exposes detailed diagnostics', () => {
    expect(
      isPickingRouteDetailedDiagnosticsEnabled({
        isDev: true,
        currentTenantId: 'tenant-1',
        memberships: [],
        search: ''
      })
    ).toBe(true);
  });

  it('production mode plus tenant admin and query parameter exposes diagnostics', () => {
    expect(
      isPickingRouteDetailedDiagnosticsEnabled({
        isDev: false,
        currentTenantId: 'tenant-1',
        memberships: tenantAdmin,
        search: '?pickingRouteDebug=1'
      })
    ).toBe(true);
  });

  it('production mode plus tenant admin without query parameter does not expose diagnostics', () => {
    expect(
      isPickingRouteDetailedDiagnosticsEnabled({
        isDev: false,
        currentTenantId: 'tenant-1',
        memberships: tenantAdmin,
        search: ''
      })
    ).toBe(false);
  });

  it('production mode plus non-admin with query parameter does not expose diagnostics', () => {
    expect(
      isPickingRouteDetailedDiagnosticsEnabled({
        isDev: false,
        currentTenantId: 'tenant-1',
        memberships: [
          {
            tenantId: 'tenant-1',
            tenantCode: 'tenant-1',
            tenantName: 'Tenant 1',
            role: 'operator'
          }
        ],
        search: '?pickingRouteDebug=1'
      })
    ).toBe(false);
  });
});

describe('picking route detailed diagnostics signatures', () => {
  it('obstacle signature is deterministic regardless of input order', () => {
    const left: RouteObstacle[] = [
      { type: 'rack', id: 'rack-2', x: 6, y: 1, width: 2, height: 3 },
      { type: 'wall', id: 'wall-1', x1: 0, y1: 0, x2: 0, y2: 5 }
    ];
    const right: RouteObstacle[] = [...left].reverse();

    expect(buildObstacleSignature(left)).toBe(buildObstacleSignature(right));
  });

  it('obstacle signature changes when geometry changes', () => {
    const base: RouteObstacle[] = [
      { type: 'rack', id: 'rack-1', x: 1, y: 2, width: 3, height: 4 }
    ];
    const changed: RouteObstacle[] = [
      { type: 'rack', id: 'rack-1', x: 1, y: 2, width: 3.5, height: 4 }
    ];

    expect(buildObstacleSignature(base)).not.toBe(buildObstacleSignature(changed));
  });

  it('anchor signature is deterministic', () => {
    const anchors: PickingRouteAnchor[] = [
      {
        status: 'resolved',
        stepId: 'task-1',
        step: { ...baseStep, taskId: 'task-1', fromLocationId: 'loc-1' },
        point: { x: 40, y: 80 },
        source: 'pick-point'
      },
      {
        status: 'unresolved',
        stepId: 'task-2',
        step: { ...baseStep, taskId: 'task-2', fromLocationId: 'loc-2' },
        reason: 'missing-published-cell'
      }
    ];

    expect(buildAnchorSignature(anchors)).toBe(buildAnchorSignature(anchors));
  });

  it('numeric precision normalization prevents meaningless float-noise changes', () => {
    const obstacleA: RouteObstacle[] = [
      { type: 'rack', id: 'rack-1', x: 1.000001, y: 2.000001, width: 3, height: 4 }
    ];
    const obstacleB: RouteObstacle[] = [
      { type: 'rack', id: 'rack-1', x: 1.000002, y: 2.000002, width: 3, height: 4 }
    ];
    const anchorsA: PickingRouteAnchor[] = [
      {
        status: 'resolved',
        stepId: 'task-1',
        step: { ...baseStep, taskId: 'task-1', fromLocationId: 'loc-1' },
        point: { x: 40.00001, y: 79.99999 },
        source: 'pick-point'
      }
    ];
    const anchorsB: PickingRouteAnchor[] = [
      {
        status: 'resolved',
        stepId: 'task-1',
        step: { ...baseStep, taskId: 'task-1', fromLocationId: 'loc-1' },
        point: { x: 40.00002, y: 80.00001 },
        source: 'pick-point'
      }
    ];

    expect(buildObstacleSignature(obstacleA)).toBe(buildObstacleSignature(obstacleB));
    expect(buildAnchorSignature(anchorsA)).toBe(buildAnchorSignature(anchorsB));
  });
});

describe('picking route detailed diagnostics payload', () => {
  it('includes build metadata, readiness, solver config, signatures, and segment detail', () => {
    const routeSteps = [
      { ...baseStep, taskId: 'task-1', fromLocationId: 'loc-1' },
      { ...baseStep, taskId: 'task-2', fromLocationId: 'loc-2' },
      { ...baseStep, taskId: 'task-3', fromLocationId: 'loc-3' }
    ];
    const locationsById = {
      'loc-1': { id: 'loc-1', warehouseId: 'warehouse-1', addressLabel: 'A-01', cellId: 'cell-1' },
      'loc-2': { id: 'loc-2', warehouseId: 'warehouse-1', addressLabel: 'A-02', cellId: 'cell-2' },
      'loc-3': { id: 'loc-3', warehouseId: 'warehouse-1', addressLabel: 'A-03', cellId: 'cell-3' }
    };
    const publishedCellsById = new Map([
      ['cell-1', createCell('cell-1', 'rack-1', 1)],
      ['cell-2', createCell('cell-2', 'rack-1', 2)]
    ]);
    const anchors: PickingRouteAnchor[] = [
      {
        status: 'resolved',
        stepId: 'task-1',
        step: routeSteps[0]!,
        point: { x: 40, y: 80 },
        source: 'pick-point'
      },
      {
        status: 'resolved',
        stepId: 'task-2',
        step: routeSteps[1]!,
        point: { x: 120, y: 80 },
        source: 'projection'
      },
      {
        status: 'unresolved',
        stepId: 'task-3',
        step: routeSteps[2]!,
        reason: 'missing-published-cell'
      }
    ];
    const segments: SolvedRouteSegment[] = [
      {
        status: 'ok',
        fromStepId: 'task-1',
        toStepId: 'task-2',
        costMetres: 2,
        canvasPoints: [
          { x: 40, y: 80 },
          { x: 120, y: 80 }
        ],
        diagnostics: {
          fromStepId: 'task-1',
          toStepId: 'task-2',
          fromCanvasPoint: { x: 40, y: 80 },
          toCanvasPoint: { x: 120, y: 80 },
          fromWorldPoint: { x: 1, y: 2 },
          toWorldPoint: { x: 3, y: 2 },
          grid: { minX: 0, minY: 0, resolutionM: 0.5 },
          originalStartCell: { x: 1, y: 2 },
          originalEndCell: { x: 6, y: 2 },
          snappedStartCell: { x: 1, y: 2 },
          snappedEndCell: { x: 6, y: 2 },
          solverBounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          obstacleCount: 2,
          blockedGridCellCount: 3,
          blockedGridCells: [],
          solverStatus: 'ok',
          pathGridCells: [{ x: 1, y: 2 }, { x: 6, y: 2 }],
          pathWorldPoints: [{ x: 1, y: 2 }, { x: 3, y: 2 }]
        }
      },
      {
        status: 'unroutable',
        fromStepId: 'task-2',
        toStepId: 'task-3',
        solverStatus: 'no_path',
        debugReason: 'no_path_after_snap',
        fromCanvasPoint: { x: 120, y: 80 },
        toCanvasPoint: { x: 200, y: 80 },
        diagnostics: {
          fromStepId: 'task-2',
          toStepId: 'task-3',
          fromCanvasPoint: { x: 120, y: 80 },
          toCanvasPoint: { x: 200, y: 80 },
          fromWorldPoint: { x: 3, y: 2 },
          toWorldPoint: { x: 5, y: 2 },
          grid: { minX: 0, minY: 0, resolutionM: 0.5 },
          originalStartCell: { x: 6, y: 2 },
          originalEndCell: { x: 10, y: 2 },
          snappedStartCell: { x: 6, y: 2 },
          snappedEndCell: { x: 9, y: 2 },
          solverBounds: { minX: 0, minY: 0, maxX: 12, maxY: 12 },
          obstacleCount: 2,
          blockedGridCellCount: 6,
          blockedGridCells: [],
          solverStatus: 'no_path',
          debugReason: 'no_path_after_snap',
          pathGridCells: [],
          pathWorldPoints: []
        }
      },
      {
        status: 'skipped',
        reason: 'unresolved_anchor',
        fromStepId: 'task-3',
        toStepId: 'task-4',
        fromCanvasPoint: undefined,
        toCanvasPoint: undefined,
        diagnostics: {
          fromStepId: 'task-3',
          toStepId: 'task-4',
          blockedGridCells: [],
          pathGridCells: [],
          pathWorldPoints: [],
          solverStatus: 'skipped',
          debugReason: 'unresolved_anchor'
        }
      }
    ];
    const obstacles: RouteObstacle[] = [
      { type: 'rack', id: 'rack-1', x: 1, y: 2, width: 3, height: 4 },
      { type: 'wall', id: 'wall-1', x1: 0, y1: 0, x2: 0, y2: 5 }
    ];

    const diagnostics = buildPickingRouteDetailedDiagnostics({
      routeSteps,
      locationsById: locationsById as never,
      publishedCellsById,
      publishedCellsQueryStatus: 'success',
      aisleTopologyQueryStatus: 'pending',
      faceAccessByFaceId: new Map(),
      anchors,
      segments,
      obstacles,
      floorId: 'floor-1',
      layoutVersionId: 'layout-version-1',
      packageId: 'pkg-1',
      activeRouteMode: 'original',
      tenantId: 'tenant-1'
    });

    expect(diagnostics.build).toEqual({
      sha: 'unknown',
      timestamp: 'unknown',
      mode: import.meta.env.MODE
    });
    expect(diagnostics.readiness).toMatchObject({
      publishedCellsQueryStatus: 'success',
      publishedCellsByIdSize: 2,
      requiredCellIds: ['cell-1', 'cell-2', 'cell-3'],
      missingRequiredCellIds: ['cell-3'],
      aisleTopologyQueryStatus: 'pending',
      faceAccessByFaceIdSize: 0,
      anchorCount: 3,
      resolvedAnchorCount: 2,
      unresolvedAnchorCount: 1
    });
    expect(diagnostics.solverConfig).toEqual({
      gridCellSizeM: 0.5,
      obstaclePaddingM: 0.4,
      boundsMarginM: 5,
      maxEndpointSnapCells: 2
    });
    expect(diagnostics.obstacles.totalCount).toBe(2);
    expect(diagnostics.obstacles.signature.length).toBeGreaterThan(0);
    expect(diagnostics.anchors.signature.length).toBeGreaterThan(0);
    expect(diagnostics.segments[0]).toMatchObject({
      status: 'ok',
      fromStepId: 'task-1',
      toStepId: 'task-2'
    });
    expect(diagnostics.segments[1]).toMatchObject({
      status: 'unroutable',
      solverStatus: 'no_path',
      debugReason: 'no_path_after_snap'
    });
    expect(diagnostics.segments[2]).toMatchObject({
      status: 'skipped',
      skippedReason: 'unresolved_anchor',
      debugReason: 'unresolved_anchor'
    });

    const summary = buildPickingRouteDebugSummary({
      routeSteps,
      locationsById: locationsById as never,
      publishedCellsById,
      publishedCellsQueryStatus: 'success',
      aisleTopologyQueryStatus: 'pending',
      faceAccessByFaceId: new Map(),
      anchors,
      segments,
      detailedDiagnostics: diagnostics
    });
    expect(summary.detailedDiagnostics).toEqual(diagnostics);
  });
});

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
