import { beforeEach, describe, expect, it } from 'vitest';
import { resetPickingRunStore, usePickingRunStore } from './picking-run-store';

describe('picking run store', () => {
  beforeEach(() => {
    resetPickingRunStore();
  });

  it('startRun initializes first step', () => {
    usePickingRunStore.getState().startRun('pkg-1', ['step-1', 'step-2']);

    const state = usePickingRunStore.getState();
    expect(state.activePackageId).toBe('pkg-1');
    expect(state.activeStepIndex).toBe(0);
    expect(state.status).toBe('in_progress');
  });

  it('confirmCurrentStep marks picked and advances', () => {
    usePickingRunStore.getState().startRun('pkg-1', ['step-1', 'step-2']);
    usePickingRunStore.getState().confirmCurrentStep();

    const state = usePickingRunStore.getState();
    expect(state.pickedStepIds).toEqual(['step-1']);
    expect(state.activeStepIndex).toBe(1);
  });

  it('final confirm sets completed', () => {
    usePickingRunStore.getState().startRun('pkg-1', ['step-1']);
    usePickingRunStore.getState().confirmCurrentStep();

    const state = usePickingRunStore.getState();
    expect(state.pickedStepIds).toEqual(['step-1']);
    expect(state.status).toBe('completed');
  });

  it('previous/next work', () => {
    usePickingRunStore.getState().startRun('pkg-1', ['step-1', 'step-2', 'step-3']);
    usePickingRunStore.getState().goNext();
    usePickingRunStore.getState().goPrevious();

    expect(usePickingRunStore.getState().activeStepIndex).toBe(0);
  });

  it('focusedLocationId set by where-is-it action', () => {
    usePickingRunStore.getState().setFocusedLocation('loc-1');

    expect(usePickingRunStore.getState().focusedLocationId).toBe('loc-1');
  });
});
