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

describe('rack-cells-visual-state PR3 semantics', () => {
  it.each([
    { runtimeStatus: 'empty' as const, fill: 'empty', paintFill: palette.emptyFill },
    { runtimeStatus: 'stocked' as const, fill: 'occupied', paintFill: palette.occupiedFill },
    { runtimeStatus: 'reserved' as const, fill: 'reserved', paintFill: palette.reservedFill },
    { runtimeStatus: 'pick_active' as const, fill: 'pick-active', paintFill: palette.pickActiveFill },
    { runtimeStatus: 'quarantined' as const, fill: 'quarantined', paintFill: palette.quarantinedFill }
  ])('maps runtime truth $runtimeStatus to canonical fill $fill', ({ runtimeStatus, fill, paintFill }) => {
    const state = resolveCellVisualState(
      createInputs({
        runtimeStatus,
        isOccupiedByFallback: true
      }),
      palette
    );

    expect(state.semantics.base).toBe('frame');
    expect(state.semantics.fill).toBe(fill);
    expect(state.semantics.truth).toEqual({
      isDegraded: false,
      isUnknown: false,
      source: 'runtime'
    });
    expect(state.flags.fillSource).toBe('runtime');
    expect(state.flags.isDegradedFill).toBe(false);
    expect(state.fill).toBe(paintFill);
  });

  it('degrades fallback occupancy only to canonical occupied fill', () => {
    const state = resolveCellVisualState(
      createInputs({
        isOccupiedByFallback: true
      }),
      palette
    );

    expect(state.semantics.fill).toBe('occupied');
    expect(state.semantics.truth).toEqual({
      isDegraded: true,
      isUnknown: false,
      source: 'fallback'
    });
    expect(state.flags.fillSource).toBe('fallback');
    expect(state.flags.isDegradedFill).toBe(true);
    expect(state.compat.semanticKind).toBe('occupied_fallback');
    expect(state.fill).toBe(palette.occupiedFill);
    expect(state.stroke).toBe(palette.occupiedStroke);
  });

  it('does not render unknown truth as empty', () => {
    const state = resolveCellVisualState(createInputs(), palette);

    expect(state.semantics.fill).toBeNull();
    expect(state.semantics.truth).toEqual({
      isDegraded: false,
      isUnknown: true,
      source: 'none'
    });
    expect(state.flags.hasFill).toBe(false);
    expect(state.fill).toBe(palette.baseFill);
    expect(state.stroke).toBe(palette.baseStroke);
  });

  it('keeps invalid-target separate from canonical fill/base semantics', () => {
    const state = resolveCellVisualState(
      createInputs({
        isWorkflowScope: true,
        isOccupiedByFallback: true
      }),
      palette
    );

    expect(state.semantics.base).toBe('frame');
    expect(state.semantics.fill).toBe('occupied');
    expect(state.semantics.interaction.invalidTarget).toBe(true);
    expect(state.compat.isWorkflowTargetLocked).toBe(true);
    expect(state.fill).toBe(palette.blockedFill);
    expect(state.stroke).toBe(palette.blockedStroke);
    expect(state.isClickable).toBe(false);
  });

  it('removes focused from canonical resolver semantics and derived navigation output', () => {
    const state = resolveCellVisualState(
      createInputs({
        isFocused: true
      }),
      palette
    );

    expect(state.semantics.interaction).toEqual({
      selected: false,
      locateTarget: false,
      searchHit: false,
      workflowSource: false,
      invalidTarget: false
    });
    expect(state.navigationFill).toBeNull();
    expect(state.navigationStroke).toBeNull();
  });

  it('keeps selected, locate-target, workflow-source, and search-hit precedence in derived navigation plumbing', () => {
    const selectedState = resolveCellVisualState(
      createInputs({
        isSelected: true,
        isLocateTarget: true,
        isWorkflowSource: true,
        isSearchHit: true
      }),
      palette
    );
    const locateState = resolveCellVisualState(
      createInputs({
        isLocateTarget: true,
        isWorkflowSource: true,
        isSearchHit: true
      }),
      palette
    );
    const workflowState = resolveCellVisualState(
      createInputs({
        isWorkflowSource: true,
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
    expect(searchState.navigationStroke).toBe(palette.searchHitStroke);
  });

  it('resolves identical canonical base and fill for view/storage-style consumers given identical truth', () => {
    const viewState = resolveCellVisualState(
      createInputs({
        isInteractive: false,
        runtimeStatus: 'reserved'
      }),
      palette
    );
    const storageState = resolveCellVisualState(
      createInputs({
        isInteractive: true,
        runtimeStatus: 'reserved'
      }),
      palette
    );

    expect({
      base: viewState.semantics.base,
      fill: viewState.semantics.fill
    }).toEqual({
      base: storageState.semantics.base,
      fill: storageState.semantics.fill
    });
  });

  it('derives explicit flags from canonical semantics rather than legacy peer states', () => {
    const flags = deriveCellVisualFlags(
      createInputs({
        isOccupiedByFallback: true
      })
    );

    expect(flags).toEqual({
      isMissingCellIdentity: false,
      canSelectWorkflowTarget: true,
      isInvalidTarget: false,
      isDegradedFill: true,
      hasFill: true,
      fillSource: 'fallback'
    });
  });
});
