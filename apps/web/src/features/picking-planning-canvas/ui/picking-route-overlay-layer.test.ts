import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { PickingRouteOverlayLayer } from './picking-route-overlay-layer';
import type { PickingRouteAnchor } from '../model/route-step-geometry';
import type { SolvedRouteSegment } from '../model/route-step-geometry';

vi.mock('react-konva', () => ({
  Arrow: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Arrow', props, children),
  Circle: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Circle', props, children),
  Layer: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Layer', props, children),
  Line: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Line', props, children),
  Rect: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Rect', props, children),
  Text: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Text', props, children)
}));

const step = {
  sequence: 1,
  taskId: 'task-1',
  fromLocationId: 'loc-1',
  skuId: 'sku-1',
  qtyToPick: 1,
  allocations: []
};

const segmentDiagnostics = {
  fromStepId: 'task-1',
  toStepId: 'task-2',
  fromCanvasPoint: { x: 10, y: 20 },
  toCanvasPoint: { x: 30, y: 40 },
  fromWorldPoint: { x: 0.25, y: 0.5 },
  toWorldPoint: { x: 0.75, y: 1 },
  grid: { minX: 0, minY: 0, resolutionM: 0.5 },
  originalStartCell: { x: 1, y: 2 },
  originalEndCell: { x: 3, y: 4 },
  snappedStartCell: { x: 1, y: 1 },
  snappedEndCell: { x: 3, y: 3 },
  solverBounds: { minX: 0, minY: 0, maxX: 2, maxY: 2 },
  obstacleCount: 1,
  blockedGridCellCount: 2,
  blockedGridCells: [
    { x: 1, y: 1 },
    { x: 2, y: 2 }
  ],
  solverStatus: 'ok' as const,
  debugReason: 'start_snap:r1',
  pathGridCells: [
    { x: 1, y: 1 },
    { x: 2, y: 2 }
  ],
  pathWorldPoints: [
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 1 }
  ]
};

describe('PickingRouteOverlayLayer', () => {
  it('draws markers and lines for adjacent resolved anchors', () => {
    const anchors: PickingRouteAnchor[] = [
      {
        status: 'resolved',
        stepId: 'task-1',
        step,
        point: { x: 10, y: 20 },
        source: 'projection'
      },
      {
        status: 'resolved',
        stepId: 'task-2',
        step: { ...step, taskId: 'task-2' },
        point: { x: 30, y: 40 },
        source: 'projection'
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingRouteOverlayLayer, { anchors })
      );
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'Circle')).toHaveLength(2);
    expect(renderer.root.findAll((node) => String(node.type) === 'Arrow')).toHaveLength(1);
  });

  it('renders start marker and label when startCanvasPoint is provided', () => {
    const anchors: PickingRouteAnchor[] = [
      {
        status: 'resolved',
        stepId: 'task-1',
        step,
        point: { x: 10, y: 20 },
        source: 'projection'
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingRouteOverlayLayer, {
          anchors,
          startCanvasPoint: { x: 1, y: 2 }
        })
      );
    });

    const labels = renderer.root.findAll((node) => String(node.type) === 'Text');
    expect(labels.some((node) => node.props.text === 'Start')).toBe(true);
  });

  it('skips unresolved anchors when drawing lines', () => {
    const anchors: PickingRouteAnchor[] = [
      {
        status: 'resolved',
        stepId: 'task-1',
        step,
        point: { x: 10, y: 20 },
        source: 'projection'
      },
      {
        status: 'unresolved',
        stepId: 'task-2',
        step: { ...step, taskId: 'task-2' },
        reason: 'missing-location-projection'
      },
      {
        status: 'resolved',
        stepId: 'task-3',
        step: { ...step, taskId: 'task-3' },
        point: { x: 30, y: 40 },
        source: 'projection'
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingRouteOverlayLayer, { anchors })
      );
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'Circle')).toHaveLength(2);
    expect(renderer.root.findAll((node) => String(node.type) === 'Arrow')).toHaveLength(0);
  });
});

describe('PickingRouteOverlayLayer with solvedSegments', () => {
  const anchors: PickingRouteAnchor[] = [
    {
      status: 'resolved',
      stepId: 'task-1',
      step,
      point: { x: 10, y: 20 },
      source: 'pick-point'
    },
    {
      status: 'resolved',
      stepId: 'task-2',
      step: { ...step, taskId: 'task-2' },
      point: { x: 30, y: 40 },
      source: 'pick-point'
    }
  ];

  it('renders Line for an ok solved segment', () => {
    const solvedSegments: SolvedRouteSegment[] = [
      {
        status: 'ok',
        fromStepId: 'task-1',
        toStepId: 'task-2',
        costMetres: 3,
        canvasPoints: [
          { x: 10, y: 20 },
          { x: 20, y: 20 },
          { x: 30, y: 40 }
        ]
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingRouteOverlayLayer, { anchors, solvedSegments })
      );
    });

    const lines = renderer.root.findAll((node) => String(node.type) === 'Line');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.props.points).toEqual([10, 20, 20, 20, 30, 40]);
    expect(renderer.root.findAll((node) => String(node.type) === 'Arrow')).toHaveLength(0);
  });

  it('preserves old Arrow behavior when solvedSegments is absent', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingRouteOverlayLayer, { anchors })
      );
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'Arrow')).toHaveLength(1);
    expect(renderer.root.findAll((node) => String(node.type) === 'Line')).toHaveLength(0);
  });

  it('renders fallback Arrow for a skipped (unresolved_anchor) segment', () => {
    const solvedSegments: SolvedRouteSegment[] = [
      {
        status: 'skipped',
        reason: 'unresolved_anchor',
        fromStepId: 'task-1',
        toStepId: 'task-2',
        fromCanvasPoint: { x: 10, y: 20 },
        toCanvasPoint: { x: 30, y: 40 }
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingRouteOverlayLayer, { anchors, solvedSegments })
      );
    });

    const arrows = renderer.root.findAll((node) => String(node.type) === 'Arrow');
    expect(arrows).toHaveLength(1);
    expect(arrows[0]?.props.stroke).toContain('234');
    expect(renderer.root.findAll((node) => String(node.type) === 'Line')).toHaveLength(0);
  });

  it('renders fallback Arrow for an unroutable (solver failure) segment', () => {
    const solvedSegments: SolvedRouteSegment[] = [
      {
        status: 'unroutable',
        solverStatus: 'no_path',
        fromStepId: 'task-1',
        toStepId: 'task-2',
        fromCanvasPoint: { x: 10, y: 20 },
        toCanvasPoint: { x: 30, y: 40 }
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingRouteOverlayLayer, { anchors, solvedSegments })
      );
    });

    const arrows = renderer.root.findAll((node) => String(node.type) === 'Arrow');
    expect(arrows).toHaveLength(1);
    expect(arrows[0]?.props.stroke).toContain('234');
    expect(renderer.root.findAll((node) => String(node.type) === 'Line')).toHaveLength(0);
  });

  it('keeps unroutable fallback visually distinct from a solved route in DEV diagnostics', () => {
    const solvedSegments: SolvedRouteSegment[] = [
      {
        status: 'ok',
        fromStepId: 'task-1',
        toStepId: 'task-2',
        costMetres: 3,
        canvasPoints: [
          { x: 10, y: 20 },
          { x: 20, y: 20 },
          { x: 30, y: 40 }
        ],
        diagnostics: segmentDiagnostics
      },
      {
        status: 'unroutable',
        solverStatus: 'no_path',
        debugReason: 'grid_guard:99',
        fromStepId: 'task-2',
        toStepId: 'task-3',
        fromCanvasPoint: { x: 30, y: 40 },
        toCanvasPoint: { x: 50, y: 60 },
        diagnostics: {
          ...segmentDiagnostics,
          fromStepId: 'task-2',
          toStepId: 'task-3',
          fromCanvasPoint: { x: 30, y: 40 },
          toCanvasPoint: { x: 50, y: 60 },
          fromWorldPoint: { x: 0.75, y: 1 },
          toWorldPoint: { x: 1.25, y: 1.5 },
          solverStatus: 'no_path',
          debugReason: 'grid_guard:99',
          pathGridCells: [],
          pathWorldPoints: [],
          blockedGridCells: [{ x: 1, y: 1 }]
        }
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingRouteOverlayLayer, {
          anchors,
          solvedSegments,
          showDiagnostics: true,
          diagnosticObstacles: [
            { type: 'rack', id: 'rack-1', x: 0, y: 0, width: 1, height: 1 }
          ]
        })
      );
    });

    const arrows = renderer.root.findAll((node) => String(node.type) === 'Arrow');
    const labels = renderer.root.findAll((node) => String(node.type) === 'Text');
    const routeLines = renderer.root.findAll(
      (node) =>
        String(node.type) === 'Line' &&
        node.props.stroke === 'rgba(37,99,235,0.72)'
    );

    expect(routeLines).toHaveLength(1);
    expect(arrows).toHaveLength(1);
    expect(labels.some((node) => node.props.text === 'UNROUTABLE: no_path grid_guard:99')).toBe(
      true
    );
  });

  it('does not render diagnostics when disabled outside DEV', () => {
    const solvedSegments: SolvedRouteSegment[] = [
      {
        status: 'ok',
        fromStepId: 'task-1',
        toStepId: 'task-2',
        costMetres: 3,
        canvasPoints: [
          { x: 10, y: 20 },
          { x: 20, y: 20 },
          { x: 30, y: 40 }
        ],
        diagnostics: segmentDiagnostics
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingRouteOverlayLayer, {
          anchors,
          solvedSegments,
          showDiagnostics: false,
          diagnosticObstacles: [
            { type: 'rack', id: 'rack-1', x: 0, y: 0, width: 1, height: 1 }
          ]
        })
      );
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'Rect')).toHaveLength(0);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Text' &&
          typeof node.props.text === 'string' &&
          node.props.text.startsWith('UNROUTABLE:')
      )
    ).toHaveLength(0);
  });

  it('omits a skipped segment when one canvas point is missing', () => {
    const solvedSegments: SolvedRouteSegment[] = [
      {
        status: 'skipped',
        reason: 'unresolved_anchor',
        fromStepId: 'task-1',
        toStepId: 'task-2',
        fromCanvasPoint: { x: 10, y: 20 },
        toCanvasPoint: undefined
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(PickingRouteOverlayLayer, { anchors, solvedSegments })
      );
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'Arrow')).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'Line')).toHaveLength(0);
  });
});
