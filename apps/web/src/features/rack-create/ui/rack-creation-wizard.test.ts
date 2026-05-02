import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import { createLayoutDraftFixture } from '@/warehouse/editor/model/__fixtures__/layout-draft.fixture';
import {
  getWarehouseDraftSnapshot,
  warehouseLayoutDraftActions
} from '@/warehouse/state/layout-draft';
import {
  getWarehouseSelectionSnapshot,
  warehouseInteractionActions
} from '@/warehouse/state/interaction';
import {
  getWarehouseActiveLayoutTaskSnapshot,
  warehouseRackLayoutActions
} from '@/warehouse/state/rack-layout-actions';
import { warehouseViewModeActions } from '@/warehouse/state/view-mode';
import { RackCreationWizard } from './rack-creation-wizard';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function resetStores() {
  warehouseViewModeActions.reset();
  warehouseInteractionActions.resetAll();
  warehouseLayoutDraftActions.resetDraft();
}

function findButtonByText(root: TestRenderer.ReactTestInstance, text: string) {
  return root.findAll(
    (node) =>
      node.type === 'button' &&
      node.children.some((child) => typeof child === 'string' && child.includes(text))
  )[0];
}

afterEach(() => {
  resetStores();
});

describe('RackCreationWizard', () => {
  it('finish clears the active rack_creation task and keeps the rack selected', () => {
    const draft = createLayoutDraftFixture();
    warehouseLayoutDraftActions.initializeDraft(draft);
    warehouseRackLayoutActions.createRack(80, 120);

    const activeTask = getWarehouseActiveLayoutTaskSnapshot();
    expect(activeTask?.type).toBe('rack_creation');
    const rackId = activeTask?.type === 'rack_creation' ? activeTask.rackId : '';
    const rack = getWarehouseDraftSnapshot()!.racks[rackId];
    if (!rack) throw new Error('Expected created rack in draft.');

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(RackCreationWizard, { rack }));
    });

    act(() => {
      findButtonByText(renderer.root, 'Next: Configure sections').props.onClick();
    });
    act(() => {
      findButtonByText(renderer.root, 'Finish setup').props.onClick();
    });
    act(() => {
      findButtonByText(renderer.root, 'Open in inspector').props.onClick();
    });

    expect(getWarehouseActiveLayoutTaskSnapshot()).toBeNull();
    expect(getWarehouseSelectionSnapshot()).toEqual({
      type: 'rack',
      rackIds: [rackId],
      focus: { type: 'body' }
    });
  });

  it('cancel clears the active rack_creation task and removes the rack', () => {
    const draft = createLayoutDraftFixture();
    warehouseLayoutDraftActions.initializeDraft(draft);
    warehouseRackLayoutActions.createRack(80, 120);

    const activeTask = getWarehouseActiveLayoutTaskSnapshot();
    expect(activeTask?.type).toBe('rack_creation');
    const rackId = activeTask?.type === 'rack_creation' ? activeTask.rackId : '';
    const rack = getWarehouseDraftSnapshot()!.racks[rackId];
    if (!rack) throw new Error('Expected created rack in draft.');

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(RackCreationWizard, { rack }));
    });

    act(() => {
      findButtonByText(renderer.root, 'Cancel').props.onClick();
    });

    expect(getWarehouseActiveLayoutTaskSnapshot()).toBeNull();
    expect(getWarehouseDraftSnapshot()?.racks[rackId]).toBeUndefined();
    expect(getWarehouseDraftSnapshot()?.rackIds).not.toContain(rackId);
    expect(getWarehouseSelectionSnapshot()).toEqual({ type: 'none' });
  });
});
