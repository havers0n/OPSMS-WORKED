import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { PickingRouteOverlayLayer } from './picking-route-overlay-layer';
import type { PickingRouteAnchor } from '../model/route-step-geometry';

vi.mock('react-konva', () => ({
  Arrow: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Arrow', props, children),
  Circle: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Circle', props, children),
  Layer: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Layer', props, children),
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
