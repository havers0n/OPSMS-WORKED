import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePickingPlanningOverlayStore } from '@/entities/picking-planning/model/overlay-store';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';
import { useOpenPickingPlan } from './use-open-picking-plan';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function Harness() {
  const { openForOrder, openForWave } = useOpenPickingPlan();

  return React.createElement(
    'div',
    null,
    React.createElement(
      'button',
      { type: 'button', onClick: () => openForOrder('order-1') },
      'Open order'
    ),
    React.createElement(
      'button',
      { type: 'button', onClick: () => openForWave('wave-1') },
      'Open wave'
    )
  );
}

function resetStores() {
  usePickingPlanningOverlayStore.setState({
    source: { kind: 'none' },
    preview: null,
    isLoading: false,
    errorMessage: null,
    activePackageId: null,
    selectedStepId: null,
    reorderedStepIdsByPackageId: {}
  });
  useModeStore.setState({
    viewMode: 'layout',
    viewStage: 'map',
    editorMode: 'select'
  });
}

describe('useOpenPickingPlan', () => {
  beforeEach(() => {
    resetStores();
    navigate.mockClear();
  });

  afterEach(() => {
    if (!renderer) return;
    act(() => {
      renderer?.unmount();
      renderer = null;
    });
  });

  it('opens a picking plan preview for an order', () => {
    act(() => {
      renderer = TestRenderer.create(React.createElement(Harness));
    });

    const orderButton = renderer!.root.findByProps({ children: 'Open order' });

    act(() => {
      orderButton.props.onClick();
    });

    expect(usePickingPlanningOverlayStore.getState().source).toEqual({
      kind: 'orders',
      orderIds: ['order-1']
    });
    expect(useModeStore.getState().viewMode).toBe('view');
    expect(useModeStore.getState().viewStage).toBe('picking-plan');
    expect(navigate).toHaveBeenCalledWith('/warehouse/view');
  });

  it('opens a picking plan preview for a wave', () => {
    act(() => {
      renderer = TestRenderer.create(React.createElement(Harness));
    });

    const waveButton = renderer!.root.findByProps({ children: 'Open wave' });

    act(() => {
      waveButton.props.onClick();
    });

    expect(usePickingPlanningOverlayStore.getState().source).toEqual({
      kind: 'wave',
      waveId: 'wave-1'
    });
    expect(useModeStore.getState().viewMode).toBe('view');
    expect(useModeStore.getState().viewStage).toBe('picking-plan');
    expect(navigate).toHaveBeenCalledWith('/warehouse/view');
  });
});
