import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getWarehouseViewModeSnapshot,
  warehouseViewModeActions
} from '@/warehouse/state/view-mode';
import { ViewModeSwitcher } from './view-mode-switcher';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

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

describe('ViewModeSwitcher view stages', () => {
  beforeEach(() => {
    warehouseViewModeActions.reset();
  });

  afterEach(() => {
    if (!renderer) return;
    act(() => {
      renderer?.unmount();
      renderer = null;
    });
  });

  it('renders picking plan as a View-only substage without old direct planning actions', () => {
    act(() => {
      renderer = TestRenderer.create(createElement(ViewModeSwitcher));
    });

    let text = collectText(renderer!.toJSON());
    expect(text).not.toContain('Picking plan');
    expect(text).not.toContain('Plan picking');
    expect(text).not.toContain('Plan wave');

    act(() => {
      warehouseViewModeActions.setViewMode('view');
    });

    text = collectText(renderer!.toJSON());
    expect(text).toContain('Picking plan');
    expect(text).not.toContain('Plan picking');
    expect(text).not.toContain('Plan wave');
  });

  it('updates the active View stage without changing the top-level mode', () => {
    act(() => {
      warehouseViewModeActions.reset();
      warehouseViewModeActions.setViewMode('view');
    });

    act(() => {
      renderer = TestRenderer.create(createElement(ViewModeSwitcher));
    });

    const pickingPlanButton = renderer!.root.find(
      (instance) =>
        instance.type === 'button' && instance.props.title === 'Picking plan'
    );

    act(() => {
      pickingPlanButton.props.onClick();
    });

    expect(getWarehouseViewModeSnapshot().viewMode).toBe('view');
    expect(getWarehouseViewModeSnapshot().viewStage).toBe('picking-plan');
  });

  it('resets View stage to map when switching away from View mode', () => {
    act(() => {
      warehouseViewModeActions.reset();
      warehouseViewModeActions.setViewMode('view');
      warehouseViewModeActions.setViewStage('picking-plan');
    });

    act(() => {
      renderer = TestRenderer.create(createElement(ViewModeSwitcher));
    });

    const storageButton = renderer!.root.find(
      (instance) =>
        instance.type === 'button' && instance.children.includes('Storage')
    );

    act(() => {
      storageButton.props.onClick();
    });

    expect(getWarehouseViewModeSnapshot().viewMode).toBe('storage');
    expect(getWarehouseViewModeSnapshot().viewStage).toBe('map');
  });
});
