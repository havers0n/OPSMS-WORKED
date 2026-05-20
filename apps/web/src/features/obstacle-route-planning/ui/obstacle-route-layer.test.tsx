import { createElement } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { ObstacleRouteLayer } from './obstacle-route-layer';

vi.mock('react-konva', () => ({
  Circle: ({ children, ...props }: { children?: ReactNode }) =>
    createElement('Circle', props, children),
  Layer: ({ children, ...props }: { children?: ReactNode }) =>
    createElement('Layer', props, children),
  Line: ({ children, ...props }: { children?: ReactNode }) =>
    createElement('Line', props, children),
  Text: ({ children, ...props }: { children?: ReactNode }) =>
    createElement('Text', props, children)
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function findByTestId(renderer: TestRenderer.ReactTestRenderer, testId: string) {
  return renderer.root.find(
    (node) => typeof node.type === 'string' && node.props['data-testid'] === testId
  );
}

function renderLayer(props: ComponentProps<typeof ObstacleRouteLayer>) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(ObstacleRouteLayer, props));
  });
  return renderer;
}

describe('ObstacleRouteLayer', () => {
  it('renders the solved route in canvas pixels', () => {
    const renderer = renderLayer({
      start: { x: 1, y: 2 },
      end: { x: 3, y: 4 },
      result: {
        status: 'ok',
        points: [
          { x: 1, y: 2 },
          { x: 2, y: 2 },
          { x: 3, y: 4 }
        ],
        cost: 4
      },
      onStartDragEnd: () => undefined,
      onEndDragEnd: () => undefined
    });

    expect(findByTestId(renderer, 'obstacle-route-line').props.points).toEqual([
      40,
      80,
      80,
      80,
      120,
      160
    ]);
  });

  it.each([
    ['no_path', 'No path (grid_guard:1000)'],
    ['start_blocked', 'Start blocked'],
    ['end_blocked', 'End blocked']
  ] as const)('renders %s status text', (status, text) => {
    const renderer = renderLayer({
      start: { x: 1, y: 2 },
      end: { x: 3, y: 4 },
      result: {
        status,
        points: [],
        cost: 0,
        ...(status === 'no_path' ? { debugReason: 'grid_guard:1000' } : {})
      },
      onStartDragEnd: () => undefined,
      onEndDragEnd: () => undefined
    });

    expect(findByTestId(renderer, 'obstacle-route-status').props.text).toBe(text);
  });

  it('updates marker world point on drag end without drag-move recompute wiring', () => {
    const onStartDragEnd = vi.fn();
    const renderer = renderLayer({
      start: { x: 1, y: 2 },
      end: null,
      result: null,
      onStartDragEnd,
      onEndDragEnd: () => undefined
    });
    const marker = findByTestId(renderer, 'obstacle-route-start');

    expect(marker.props.onDragMove).toBeUndefined();
    act(() => {
      marker.props.onDragEnd({
        cancelBubble: false,
        target: {
          x: () => 84,
          y: () => 126
        }
      });
    });

    expect(onStartDragEnd).toHaveBeenCalledWith({ x: 2.1, y: 3.2 });
  });
});
