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

  it('renders fallback Arrow for an unroutable segment', () => {
    const solvedSegments: SolvedRouteSegment[] = [
      {
        status: 'unroutable',
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

  it('omits a segment entirely when unroutable with no canvas points', () => {
    const solvedSegments: SolvedRouteSegment[] = [
      {
        status: 'unroutable',
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
