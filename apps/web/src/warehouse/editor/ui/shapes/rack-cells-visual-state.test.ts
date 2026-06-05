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
  reservedDot: '#reserved-dot',
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

describe('rack-cells-visual-state PR4 paint normalization', () => {
  it.each([
    // stocked and empty are normal states — they defer to occupiedCellIds
    // fallback when isOccupiedByFallback is true (used below).
    { runtimeStatus: 'stocked' as const, fill: 'occupied', paintFill: palette.occupiedFill, expectFallback: true },
    { runtimeStatus: 'reserved' as const, fill: 'reserved', paintFill: palette.reservedFill },
    { runtimeStatus: 'pick_active' as const, fill: 'pick-active', paintFill: palette.pickActiveFill },
    { runtimeStatus: 'quarantined' as const, fill: 'quarantined', paintFill: palette.quarantinedFill }
  ])('maps runtime truth $runtimeStatus to canonical fill $fill', ({ runtimeStatus, fill, paintFill, expectFallback }) => {
    const state = resolveCellVisualState(
      createInputs({
        runtimeStatus,
        isOccupiedByFallback: true
      }),
      palette
    );

    expect(state.semantics.base).toBe('frame');
    expect(state.semantics.fill).toBe(fill);
    if (expectFallback) {
      // Normal runtime states (stocked) defer to physical occupancy fallback
      expect(state.semantics.truth).toEqual({
        isDegraded: true,
        isUnknown: false,
        source: 'fallback'
      });
      expect(state.flags.fillSource).toBe('fallback');
    } else {
      // Exceptional runtime states (pick_active, reserved, quarantined) still use runtime
      expect(state.semantics.truth).toEqual({
        isDegraded: false,
        isUnknown: false,
        source: 'runtime'
      });
      expect(state.flags.fillSource).toBe('runtime');
    }
    expect(state.fill).toBe(paintFill);
    expect(state.surface.fill).toBe(paintFill);
    expect(state.surface.pattern).toEqual(
      runtimeStatus === 'reserved'
        ? {
            kind: 'dots',
            color: palette.reservedDot,
            radius: 0.9,
            pitch: 6,
            inset: 2,
            opacity: 0.32,
            minCellSize: 10
          }
        : undefined
    );
    if (expectFallback) {
      // Normal runtime state (stocked) defers to fallback → shows degraded truth marker
      // The degraded marker uses palette stroke color (surfacePaint.stroke)
      expect(state.truthMarker).toEqual({
        kind: 'degraded',
        color: palette.occupiedStroke
      });
    } else {
      expect(state.truthMarker).toBeNull();
    }
  });

  it('degrades fallback occupancy only to canonical occupied fill and a truth marker', () => {
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
    expect(state.fill).toBe(palette.occupiedFill);
    expect(state.stroke).toBe(palette.occupiedStroke);
    expect(state.surface.pattern).toBeUndefined();
    expect(state.truthMarker).toEqual({
      kind: 'degraded',
      color: palette.occupiedStroke
    });
    expect(state.compat.semanticKind).toBe('occupied_fallback');
  });

  it('does not render unknown truth as empty and uses an internal marker only', () => {
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
    expect(state.surface.pattern).toBeUndefined();
    expect(state.truthMarker).toEqual({
      kind: 'unknown',
      color: palette.baseStroke
    });
  });

  it('keeps invalid-target separate from canonical fill/base semantics and routes it to badge only', () => {
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
    expect(state.fill).toBe(palette.occupiedFill);
    expect(state.stroke).toBe(palette.occupiedStroke);
    expect(state.surface.fill).toBe(palette.occupiedFill);
    expect(state.surface.pattern).toBeUndefined();
    expect(state.badge).toEqual({
      fill: palette.blockedFill,
      stroke: palette.blockedStroke,
      strokeWidth: 1
    });
    expect(state.halo).toBeNull();
    expect(state.outline).toBeNull();
    expect(state.isClickable).toBe(false);
  });

  it('removes focused from canonical semantics and derived paint slots', () => {
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
    expect(state.outline).toBeNull();
    expect(state.halo).toBeNull();
    expect(state.badge).toBeNull();
  });

  it('keeps selected independent from halo and badge precedence', () => {
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

    expect(selectedState.outline?.stroke).toBe(palette.selectedStroke);
    expect(selectedState.halo?.stroke).toBe(palette.locateTargetStroke);
    expect(selectedState.halo?.strokeWidth).toBe(2.6);
    expect(selectedState.badge?.stroke).toBe(palette.workflowSourceStroke);
    expect(locateState.halo?.stroke).toBe(palette.locateTargetStroke);
    expect(locateState.halo?.strokeWidth).toBe(2.6);
    expect(workflowState.halo?.stroke).toBe(palette.searchHitStroke);
    expect(workflowState.badge?.stroke).toBe(palette.workflowSourceStroke);
  });

  it('keeps reserved decoration in the surface channel while overlays stay independent', () => {
    const state = resolveCellVisualState(
      createInputs({
        runtimeStatus: 'reserved',
        isSelected: true,
        isLocateTarget: true,
        isWorkflowSource: true,
        isSearchHit: true
      }),
      palette
    );

    expect(state.surface.pattern).toEqual({
      kind: 'dots',
      color: palette.reservedDot,
      radius: 0.9,
      pitch: 6,
      inset: 2,
      opacity: 0.32,
      minCellSize: 10
    });
    expect(state.outline?.stroke).toBe(palette.selectedStroke);
    expect(state.halo?.stroke).toBe(palette.locateTargetStroke);
    expect(state.halo?.strokeWidth).toBe(2.6);
    expect(state.badge?.stroke).toBe(palette.workflowSourceStroke);
  });

  it('keeps compat fields as derived mirrors from canonical semantics and truth', () => {
    const fallbackState = resolveCellVisualState(
      createInputs({
        isOccupiedByFallback: true
      }),
      palette
    );
    const invalidState = resolveCellVisualState(
      createInputs({
        isWorkflowScope: true,
        isOccupiedByFallback: true
      }),
      palette
    );

    expect(fallbackState.compat.semanticKind).toBe('occupied_fallback');
    expect(fallbackState.semantics.fill).toBe('occupied');
    expect(fallbackState.semantics.truth.source).toBe('fallback');
    expect(invalidState.compat.isWorkflowTargetLocked).toBe(
      invalidState.semantics.interaction.invalidTarget
    );
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

  describe('stale runtime vs physical occupancy resolution', () => {
    it('stale runtime stocked but occupiedCellIds excludes cell → renders empty (no fill, source none)', () => {
      const state = resolveCellVisualState(
        createInputs({
          runtimeStatus: 'stocked',
          isOccupiedByFallback: false
        }),
        palette
      );
      expect(state.semantics.fill).toBeNull();
      expect(state.semantics.truth.source).toBe('none');
      expect(state.flags.fillSource).toBe('none');
      expect(state.flags.hasFill).toBe(false);
      expect(state.fill).toBe(palette.baseFill);
    });

    it('stale runtime empty but occupiedCellIds includes cell → renders occupied (fallback source)', () => {
      const state = resolveCellVisualState(
        createInputs({
          runtimeStatus: 'empty',
          isOccupiedByFallback: true
        }),
        palette
      );
      expect(state.semantics.fill).toBe('occupied');
      expect(state.semantics.truth.source).toBe('fallback');
      expect(state.flags.fillSource).toBe('fallback');
      expect(state.flags.isDegradedFill).toBe(true);
      expect(state.fill).toBe(palette.occupiedFill);
    });

    it('runtime status stocked with occupiedCellIds included → renders occupied (fallback source)', () => {
      const state = resolveCellVisualState(
        createInputs({
          runtimeStatus: 'stocked',
          isOccupiedByFallback: true
        }),
        palette
      );
      expect(state.semantics.fill).toBe('occupied');
      expect(state.semantics.truth.source).toBe('fallback');
      expect(state.flags.fillSource).toBe('fallback');
      expect(state.fill).toBe(palette.occupiedFill);
    });

    it('exceptional runtime pick_active still overrides physical occupancy', () => {
      const state = resolveCellVisualState(
        createInputs({
          runtimeStatus: 'pick_active',
          isOccupiedByFallback: false
        }),
        palette
      );
      expect(state.semantics.fill).toBe('pick-active');
      expect(state.semantics.truth.source).toBe('runtime');
      expect(state.fill).toBe(palette.pickActiveFill);
    });

    it('exceptional runtime reserved still overrides physical occupancy', () => {
      const state = resolveCellVisualState(
        createInputs({
          runtimeStatus: 'reserved',
          isOccupiedByFallback: false
        }),
        palette
      );
      expect(state.semantics.fill).toBe('reserved');
      expect(state.semantics.truth.source).toBe('runtime');
      expect(state.fill).toBe(palette.reservedFill);
    });

    it('exceptional runtime quarantined still overrides physical occupancy', () => {
      const state = resolveCellVisualState(
        createInputs({
          runtimeStatus: 'quarantined',
          isOccupiedByFallback: false
        }),
        palette
      );
      expect(state.semantics.fill).toBe('quarantined');
      expect(state.semantics.truth.source).toBe('runtime');
      expect(state.fill).toBe(palette.quarantinedFill);
    });

    it('no runtime and no fallback → empty (source none)', () => {
      const state = resolveCellVisualState(
        createInputs({
          runtimeStatus: null,
          isOccupiedByFallback: false
        }),
        palette
      );
      expect(state.semantics.fill).toBeNull();
      expect(state.semantics.truth.source).toBe('none');
      expect(state.fill).toBe(palette.baseFill);
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
