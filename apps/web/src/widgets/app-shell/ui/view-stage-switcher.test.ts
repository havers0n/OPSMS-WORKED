import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';
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
    useModeStore.setState({
      viewMode: 'layout',
      viewStage: 'map',
      editorMode: 'select'
    });
  });

  afterEach(() => {
    if (!renderer) return;
    act(() => {
      renderer?.unmount();
      renderer = null;
    });
  });

  it('renders picking plan as a View-only substage', () => {
    act(() => {
      renderer = TestRenderer.create(createElement(ViewModeSwitcher));
    });

    expect(collectText(renderer!.toJSON())).not.toContain('Picking plan');

    act(() => {
      useModeStore.getState().setViewMode('view');
    });

    expect(collectText(renderer!.toJSON())).toContain('Picking plan');
  });

  it('updates the active View stage without changing the top-level mode', () => {
    act(() => {
      useModeStore.setState({
        viewMode: 'view',
        viewStage: 'map',
        editorMode: 'select'
      });
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

    expect(useModeStore.getState().viewMode).toBe('view');
    expect(useModeStore.getState().viewStage).toBe('picking-plan');
  });

  it('resets View stage to map when switching away from View mode', () => {
    act(() => {
      useModeStore.setState({
        viewMode: 'view',
        viewStage: 'picking-plan',
        editorMode: 'select'
      });
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

    expect(useModeStore.getState().viewMode).toBe('storage');
    expect(useModeStore.getState().viewStage).toBe('map');
  });
});
