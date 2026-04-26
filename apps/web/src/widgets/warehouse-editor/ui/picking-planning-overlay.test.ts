import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { PickingPlanningOverlay } from './picking-planning-overlay';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function collectText(
  node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null
): string {
  if (node === null) return '';
  if (Array.isArray(node)) {
    return node.map((child) => collectText(child)).join(' ');
  }

  return (node.children ?? [])
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

describe('PickingPlanningOverlay', () => {
  it('collapses and expands without unmounting the stage entry point', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
    });

    expect(
      renderer.root.findAllByProps({
        'data-testid': 'picking-planning-overlay'
      })
    ).toHaveLength(1);

    const collapseButton = renderer.root.find(
      (instance) =>
        instance.type === 'button' &&
        instance.props.title === 'Collapse picking plan'
    );

    act(() => {
      collapseButton.props.onClick();
    });

    expect(
      renderer.root.findAllByProps({
        'data-testid': 'picking-planning-overlay'
      })
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({
        'data-testid': 'picking-planning-overlay-expand'
      })
    ).toHaveLength(1);
  });

  it('moves picking priority dimensions up and down', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
    });

    expect(normalizeText(collectText(renderer.toJSON()))).toContain(
      'Picking order: Zone > Aisle > Route sequence'
    );

    const moveAisleUp = renderer.root.find(
      (instance) =>
        instance.type === 'button' && instance.props.title === 'Move Aisle up'
    );

    act(() => {
      moveAisleUp.props.onClick();
    });

    expect(normalizeText(collectText(renderer.toJSON()))).toContain(
      'Picking order: Aisle > Zone > Route sequence'
    );
  });
});
