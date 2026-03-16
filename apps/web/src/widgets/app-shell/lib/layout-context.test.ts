import { describe, expect, it, vi } from 'vitest';
import { getLayoutActionState, shouldProceedWithContextSwitch } from './layout-context';

const layoutDraft = {
  layoutVersionId: 'draft-1',
  floorId: 'floor-1',
  state: 'draft' as const,
  versionNo: 1,
  rackIds: [],
  racks: {}
};

describe('layout-context helpers', () => {
  it('allows context switch without confirmation when draft is clean', () => {
    const confirmDiscard = vi.fn(() => false);

    expect(shouldProceedWithContextSwitch(false, confirmDiscard)).toBe(true);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it('delegates dirty context switch to confirmation callback', () => {
    const confirmDiscard = vi.fn(() => true);

    expect(shouldProceedWithContextSwitch(true, confirmDiscard)).toBe(true);
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
  });

  it('disables publish while local draft is dirty', () => {
    const state = getLayoutActionState({
      activeFloorId: 'floor-1',
      workspaceIsLoading: false,
      workspaceIsError: false,
      workspace: {
        floorId: 'floor-1',
        activeDraft: layoutDraft,
        latestPublished: null
      },
      localDraft: layoutDraft,
      isDraftDirty: true
    });

    expect(state.canSaveDraft).toBe(true);
    expect(state.canPublishDraft).toBe(false);
  });

  it('keeps all draft actions disabled when no live draft is loaded', () => {
    const state = getLayoutActionState({
      activeFloorId: 'floor-1',
      workspaceIsLoading: false,
      workspaceIsError: false,
      workspace: {
        floorId: 'floor-1',
        activeDraft: null,
        latestPublished: null
      },
      localDraft: null,
      isDraftDirty: false
    });

    expect(state.canCreateDraft).toBe(true);
    expect(state.canSaveDraft).toBe(false);
    expect(state.canValidateDraft).toBe(false);
    expect(state.canPublishDraft).toBe(false);
  });
});
