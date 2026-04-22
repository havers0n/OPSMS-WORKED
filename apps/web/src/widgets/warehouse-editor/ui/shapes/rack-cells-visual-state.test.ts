import { describe, expect, it } from 'vitest';
import {
  deriveCellVisualFlags,
  resolveCellVisualState,
  type CellVisualInputs,
  type CellVisualPalette
} from './rack-cells-visual-state';

const palette: CellVisualPalette = {
  baseFill: '#base-fill',
  baseStroke: '#base-stroke',
  occupiedFill: '#occupied-fill',
  occupiedStroke: '#occupied-stroke',
  selectedFill: '#selected-fill',
  selectedStroke: '#selected-stroke',
  focusedFill: '#focused-fill',
  focusedStroke: '#focused-stroke',
  locateTargetFill: '#locate-fill',
  locateTargetStroke: '#locate-stroke',
  searchHitFill: '#search-fill',
  searchHitStroke: '#search-stroke',
  workflowSourceFill: '#workflow-fill',
  workflowSourceStroke: '#workflow-stroke',
  blockedFill: '#blocked-fill',
  blockedStroke: '#blocked-stroke',
  stockedFill: '#stocked-fill',
  stockedStroke: '#stocked-stroke',
  pickActiveFill: '#pick-fill',
  pickActiveStroke: '#pick-stroke',
  reservedFill: '#reserved-fill',
  reservedStroke: '#reserved-stroke',
  quarantinedFill: '#quarantine-fill',
  quarantinedStroke: '#quarantine-stroke',
  emptyFill: '#empty-fill',
  emptyStroke: '#empty-stroke'
};

function createInputs(overrides: Partial<CellVisualInputs> = {}): CellVisualInputs {
  return {
    isInteractive: true,
    isWorkflowScope: false,
    isRackPassive: false,
    isRackSelected: false,
    hasCellIdentity: true,
    isSelected: false,
    isFocused: false,
    isLocateTarget: false,
    isWorkflowSource: false,
    isSearchHit: false,
    isOccupiedByFallback: false,
    runtimeStatus: null,
    ...overrides
  };
}

describe('rack-cells-visual-state characterization', () => {
  it('prefers runtime truth over fallback occupancy when runtime status exists', () => {
    const state = resolveCellVisualState(
      createInputs({
        isOccupiedByFallback: true,
        runtimeStatus: 'reserved'
      }),
      palette
    );

    expect(state.flags.semanticKind).toBe('reserved');
    expect(state.flags.hasRuntimeStatus).toBe(true);
    expect(state.flags.isOccupiedFallback).toBe(true);
    expect(state.fill).toBe(palette.reservedFill);
    expect(state.stroke).toBe(palette.reservedStroke);
  });

  it('uses fallback occupancy as a peer semantic state when runtime truth is absent', () => {
    const state = resolveCellVisualState(
      createInputs({
        isOccupiedByFallback: true
      }),
      palette
    );

    expect(state.flags.semanticKind).toBe('occupied_fallback');
    expect(state.fill).toBe(palette.occupiedFill);
    expect(state.stroke).toBe(palette.occupiedStroke);
    expect(state.opacity).toBe(0.98);
  });

  it('treats selected fallback occupancy differently from unselected fallback occupancy', () => {
    const selectedFlags = deriveCellVisualFlags(
      createInputs({
        isOccupiedByFallback: true,
        isSelected: true
      })
    );
    const unselectedFlags = deriveCellVisualFlags(
      createInputs({
        isOccupiedByFallback: true
      })
    );

    expect(selectedFlags.isOccupiedFallback).toBe(false);
    expect(selectedFlags.semanticKind).toBe('base');
    expect(unselectedFlags.isOccupiedFallback).toBe(true);
    expect(unselectedFlags.semanticKind).toBe('occupied_fallback');
  });

  it('leaks blocked workflow targeting into base fill/stroke channels when fallback occupancy is present', () => {
    const state = resolveCellVisualState(
      createInputs({
        isWorkflowScope: true,
        isOccupiedByFallback: true
      }),
      palette
    );

    expect(state.flags.isWorkflowTargetLocked).toBe(true);
    expect(state.flags.semanticKind).toBe('locked');
    expect(state.fill).toBe(palette.blockedFill);
    expect(state.stroke).toBe(palette.blockedStroke);
    expect(state.isClickable).toBe(false);
  });

  it('keeps focused as a peer navigation input when stronger overlays are absent', () => {
    const state = resolveCellVisualState(
      createInputs({
        isFocused: true
      }),
      palette
    );

    expect(state.navigationFill).toBe(palette.focusedFill);
    expect(state.navigationStroke).toBe(palette.focusedStroke);
    expect(state.navigationStrokeWidth).toBe(1.45);
  });

  it('resolves current overlay precedence as selected over locate over workflow over focused over search', () => {
    const selectedState = resolveCellVisualState(
      createInputs({
        isSelected: true,
        isLocateTarget: true,
        isWorkflowSource: true,
        isFocused: true,
        isSearchHit: true
      }),
      palette
    );
    const locateState = resolveCellVisualState(
      createInputs({
        isLocateTarget: true,
        isWorkflowSource: true,
        isFocused: true,
        isSearchHit: true
      }),
      palette
    );
    const workflowState = resolveCellVisualState(
      createInputs({
        isWorkflowSource: true,
        isFocused: true,
        isSearchHit: true
      }),
      palette
    );
    const focusedState = resolveCellVisualState(
      createInputs({
        isFocused: true,
        isSearchHit: true
      }),
      palette
    );
    const searchState = resolveCellVisualState(
      createInputs({
        isSearchHit: true
      }),
      palette
    );

    expect(selectedState.navigationStroke).toBe(palette.selectedStroke);
    expect(locateState.navigationStroke).toBe(palette.locateTargetStroke);
    expect(workflowState.navigationStroke).toBe(palette.workflowSourceStroke);
    expect(focusedState.navigationStroke).toBe(palette.focusedStroke);
    expect(searchState.navigationStroke).toBe(palette.searchHitStroke);
  });

  it.todo('will remove fallback occupancy as a peer semantic class once PR3 lands');
  it.todo('will normalize overlay ownership and precedence once PR4 lands');
});
