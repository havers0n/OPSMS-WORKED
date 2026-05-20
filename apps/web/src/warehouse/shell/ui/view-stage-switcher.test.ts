import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getWarehouseViewModeSnapshot,
  warehouseViewModeActions
} from '@/warehouse/state/view-mode';
import { translate } from '@/shared/i18n';
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

    const pickingPlanLabel = translate('warehouse.view.stage.pickingPlan');
    const routeGraphLabel = translate('warehouse.view.stage.routeGraph');
    let text = collectText(renderer!.toJSON());
    expect(text).not.toContain(pickingPlanLabel);
    expect(text).not.toContain(routeGraphLabel);
    expect(text).not.toContain('Plan picking');
    expect(text).not.toContain('Plan wave');

    act(() => {
      warehouseViewModeActions.setViewMode('view');
    });

    text = collectText(renderer!.toJSON());
    expect(text).toContain(pickingPlanLabel);
    expect(text).toContain(routeGraphLabel);
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

    const pickingPlanLabel = translate('warehouse.view.stage.pickingPlan');
    const pickingPlanButton = renderer!.root.find(
      (instance) =>
        instance.type === 'button' && instance.props.title === pickingPlanLabel
    );

    act(() => {
      pickingPlanButton.props.onClick();
    });

    expect(getWarehouseViewModeSnapshot().viewMode).toBe('view');
    expect(getWarehouseViewModeSnapshot().viewStage).toBe('picking-plan');
  });

  it('renders Route graph and activates route-graph', () => {
    act(() => {
      warehouseViewModeActions.reset();
      warehouseViewModeActions.setViewMode('view');
    });

    act(() => {
      renderer = TestRenderer.create(createElement(ViewModeSwitcher));
    });

    const routeGraphLabel = translate('warehouse.view.stage.routeGraph');
    const routeGraphButton = renderer!.root.find(
      (instance) =>
        instance.type === 'button' && instance.props.title === routeGraphLabel
    );

    act(() => {
      routeGraphButton.props.onClick();
    });

    expect(getWarehouseViewModeSnapshot().viewMode).toBe('view');
    expect(getWarehouseViewModeSnapshot().viewStage).toBe('route-graph');
  });

  it('resets View stage to map when switching away from View mode', () => {
    act(() => {
      warehouseViewModeActions.reset();
      warehouseViewModeActions.setViewMode('view');
      warehouseViewModeActions.setViewStage('route-graph');
    });

    act(() => {
      renderer = TestRenderer.create(createElement(ViewModeSwitcher));
    });

    const storageLabel = translate('warehouse.view.mode.storage');
    const storageButton = renderer!.root.find(
      (instance) =>
        instance.type === 'button' && instance.children.includes(storageLabel)
    );

    act(() => {
      storageButton.props.onClick();
    });

    expect(getWarehouseViewModeSnapshot().viewMode).toBe('storage');
    expect(getWarehouseViewModeSnapshot().viewStage).toBe('map');
  });
});
