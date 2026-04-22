import type { OperationsCellRuntime } from '@wos/domain';

type RuntimeStatus = OperationsCellRuntime['status'];

type LegacySemanticKind =
  | 'base'
  | 'occupied_fallback'
  | 'empty'
  | 'stocked'
  | 'reserved'
  | 'pick_active'
  | 'quarantined'
  | 'locked';

export type CellFillSemantic = 'empty' | 'occupied' | 'reserved' | 'pick-active' | 'quarantined';

export type CellBaseSemantic = 'frame' | 'missing-identity';

export type CellVisualPalette = {
  baseFill: string;
  baseStroke: string;
  occupiedFill: string;
  occupiedStroke: string;
  selectedFill: string;
  selectedStroke: string;
  focusedFill: string;
  focusedStroke: string;
  locateTargetFill: string;
  locateTargetStroke: string;
  searchHitFill: string;
  searchHitStroke: string;
  workflowSourceFill: string;
  workflowSourceStroke: string;
  blockedFill: string;
  blockedStroke: string;
  stockedFill: string;
  stockedStroke: string;
  pickActiveFill: string;
  pickActiveStroke: string;
  reservedFill: string;
  reservedStroke: string;
  quarantinedFill: string;
  quarantinedStroke: string;
  emptyFill: string;
  emptyStroke: string;
};

export type CellVisualInputs = {
  isInteractive: boolean;
  isWorkflowScope: boolean;
  isRackPassive: boolean;
  isRackSelected: boolean;
  hasCellIdentity: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isLocateTarget: boolean;
  isWorkflowSource: boolean;
  isSearchHit: boolean;
  isOccupiedByFallback: boolean;
  runtimeStatus: RuntimeStatus | null;
};

export type CellCanonicalSemantics = {
  base: CellBaseSemantic;
  fill: CellFillSemantic | null;
  interaction: {
    selected: boolean;
    locateTarget: boolean;
    searchHit: boolean;
    workflowSource: boolean;
    invalidTarget: boolean;
  };
  truth: {
    isDegraded: boolean;
    isUnknown: boolean;
    source: 'runtime' | 'fallback' | 'none';
  };
};

export type CellVisualFlags = {
  isMissingCellIdentity: boolean;
  canSelectWorkflowTarget: boolean;
  isInvalidTarget: boolean;
  isDegradedFill: boolean;
  hasFill: boolean;
  fillSource: 'runtime' | 'fallback' | 'none';
};

type CellLayerPaint = {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  dash?: number[] | undefined;
};

type CellTruthMarkerPaint = {
  kind: 'degraded' | 'unknown';
  color: string;
};

export type ResolvedCellVisualState = {
  semantics: CellCanonicalSemantics;
  flags: CellVisualFlags;
  fill: string;
  stroke: string;
  opacity: number;
  strokeWidth: number;
  surface: CellLayerPaint;
  outline: CellLayerPaint | null;
  halo: CellLayerPaint | null;
  badge: CellLayerPaint | null;
  truthMarker: CellTruthMarkerPaint | null;
  isClickable: boolean;
  compat: {
    semanticKind: LegacySemanticKind;
    isWorkflowTargetLocked: boolean;
  };
};

function mapRuntimeStatusToFill(runtimeStatus: RuntimeStatus): CellFillSemantic {
  switch (runtimeStatus) {
    case 'stocked':
      return 'occupied';
    case 'pick_active':
      return 'pick-active';
    default:
      return runtimeStatus;
  }
}

function resolveCanonicalSemantics(inputs: CellVisualInputs): CellCanonicalSemantics {
  const invalidTarget =
    inputs.isWorkflowScope &&
    inputs.hasCellIdentity &&
    !inputs.isSelected &&
    !inputs.isLocateTarget &&
    !inputs.isWorkflowSource &&
    inputs.runtimeStatus === null &&
    inputs.isOccupiedByFallback;

  if (inputs.runtimeStatus !== null) {
    return {
      base: inputs.hasCellIdentity ? 'frame' : 'missing-identity',
      fill: mapRuntimeStatusToFill(inputs.runtimeStatus),
      interaction: {
        selected: inputs.isSelected,
        locateTarget: inputs.isLocateTarget,
        searchHit: inputs.isSearchHit,
        workflowSource: inputs.isWorkflowSource,
        invalidTarget
      },
      truth: {
        isDegraded: false,
        isUnknown: false,
        source: 'runtime'
      }
    };
  }

  if (inputs.isOccupiedByFallback) {
    return {
      base: inputs.hasCellIdentity ? 'frame' : 'missing-identity',
      fill: 'occupied',
      interaction: {
        selected: inputs.isSelected,
        locateTarget: inputs.isLocateTarget,
        searchHit: inputs.isSearchHit,
        workflowSource: inputs.isWorkflowSource,
        invalidTarget
      },
      truth: {
        isDegraded: true,
        isUnknown: false,
        source: 'fallback'
      }
    };
  }

  return {
    base: inputs.hasCellIdentity ? 'frame' : 'missing-identity',
    fill: null,
    interaction: {
      selected: inputs.isSelected,
      locateTarget: inputs.isLocateTarget,
      searchHit: inputs.isSearchHit,
      workflowSource: inputs.isWorkflowSource,
      invalidTarget
    },
    truth: {
      isDegraded: false,
      isUnknown: inputs.hasCellIdentity,
      source: 'none'
    }
  };
}

function resolveFillPaint(
  fill: CellFillSemantic | null,
  palette: CellVisualPalette
): { fill: string; stroke: string } {
  switch (fill) {
    case 'empty':
      return { fill: palette.emptyFill, stroke: palette.emptyStroke };
    case 'occupied':
      return { fill: palette.occupiedFill, stroke: palette.occupiedStroke };
    case 'reserved':
      return { fill: palette.reservedFill, stroke: palette.reservedStroke };
    case 'pick-active':
      return { fill: palette.pickActiveFill, stroke: palette.pickActiveStroke };
    case 'quarantined':
      return { fill: palette.quarantinedFill, stroke: palette.quarantinedStroke };
    default:
      return { fill: palette.baseFill, stroke: palette.baseStroke };
  }
}

function resolveLegacySemanticKind(semantics: CellCanonicalSemantics): LegacySemanticKind {
  if (semantics.interaction.invalidTarget) return 'locked';
  if (semantics.fill === null) return 'base';
  if (semantics.truth.source === 'fallback') return 'occupied_fallback';
  switch (semantics.fill) {
    case 'occupied':
      return 'stocked';
    case 'pick-active':
      return 'pick_active';
    default:
      return semantics.fill;
  }
}

export function deriveCellVisualFlags(inputs: CellVisualInputs): CellVisualFlags {
  const semantics = resolveCanonicalSemantics(inputs);

  return {
    isMissingCellIdentity: semantics.base === 'missing-identity',
    canSelectWorkflowTarget:
      !inputs.isWorkflowScope ||
      (inputs.hasCellIdentity && !inputs.isWorkflowSource && !semantics.interaction.invalidTarget),
    isInvalidTarget: semantics.interaction.invalidTarget,
    isDegradedFill: semantics.truth.isDegraded,
    hasFill: semantics.fill !== null,
    fillSource: semantics.truth.source
  };
}

export function resolveCellVisualState(
  inputs: CellVisualInputs,
  palette: CellVisualPalette
): ResolvedCellVisualState {
  const semantics = resolveCanonicalSemantics(inputs);
  const flags = deriveCellVisualFlags(inputs);

  const surfacePaint = resolveFillPaint(semantics.fill, palette);

  const opacity = flags.isMissingCellIdentity
    ? 0.18
    : inputs.isRackPassive
      ? 0.4
      : semantics.fill !== null
        ? 0.98
        : inputs.isRackSelected
          ? 0.9
          : 0.72;

  const strokeWidth = semantics.fill !== null ? 0.9 : inputs.isRackSelected ? 0.9 : 0.5;

  const outline: CellLayerPaint | null = semantics.interaction.selected
    ? {
        fill: null,
        stroke: palette.selectedStroke,
        strokeWidth: 2.1
      }
    : null;

  const halo: CellLayerPaint | null = semantics.interaction.locateTarget
    ? {
        fill: palette.locateTargetFill,
        stroke: palette.locateTargetStroke,
        strokeWidth: 1.9
      }
    : semantics.interaction.searchHit
      ? {
          fill: palette.searchHitFill,
          stroke: palette.searchHitStroke,
          strokeWidth: 1.15
        }
      : null;

  const badge: CellLayerPaint | null = semantics.interaction.invalidTarget
    ? {
        fill: palette.blockedFill,
        stroke: palette.blockedStroke,
        strokeWidth: 1
      }
    : semantics.interaction.workflowSource
      ? {
          fill: palette.workflowSourceFill,
          stroke: palette.workflowSourceStroke,
          strokeWidth: 1,
          dash: [3, 2]
        }
      : null;

  const truthMarker: CellTruthMarkerPaint | null = semantics.truth.isDegraded
    ? {
        kind: 'degraded',
        color: surfacePaint.stroke
      }
    : semantics.truth.isUnknown
      ? {
          kind: 'unknown',
          color: surfacePaint.stroke
        }
      : null;

  return {
    semantics,
    flags,
    fill: surfacePaint.fill,
    stroke: surfacePaint.stroke,
    opacity,
    strokeWidth,
    surface: {
      fill: surfacePaint.fill,
      stroke: surfacePaint.stroke,
      strokeWidth
    },
    outline,
    halo,
    badge,
    truthMarker,
    isClickable: inputs.isInteractive && inputs.hasCellIdentity && flags.canSelectWorkflowTarget,
    compat: {
      semanticKind: resolveLegacySemanticKind(semantics),
      isWorkflowTargetLocked: semantics.interaction.invalidTarget
    }
  };
}
