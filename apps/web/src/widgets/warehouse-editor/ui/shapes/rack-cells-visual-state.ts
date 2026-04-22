import type { OperationsCellRuntime } from '@wos/domain';

type RuntimeStatus = OperationsCellRuntime['status'];

type RuntimeVisual = {
  kind: Exclude<CellSemanticKind, 'base' | 'occupied_fallback' | 'locked'>;
  fill: string;
  stroke: string;
};

export type CellSemanticKind =
  | 'base'
  | 'occupied_fallback'
  | 'empty'
  | 'stocked'
  | 'reserved'
  | 'pick_active'
  | 'quarantined'
  | 'locked';

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

export type CellVisualFlags = {
  isMissingCellIdentity: boolean;
  hasRuntimeStatus: boolean;
  isOccupiedFallback: boolean;
  isWorkflowTargetLocked: boolean;
  canSelectWorkflowTarget: boolean;
  semanticKind: CellSemanticKind;
};

export type ResolvedCellVisualState = {
  fill: string;
  stroke: string;
  opacity: number;
  strokeWidth: number;
  navigationFill: string | null;
  navigationStroke: string | null;
  navigationStrokeWidth: number;
  navigationDash: number[] | undefined;
  isClickable: boolean;
  flags: CellVisualFlags;
};

function resolveRuntimeVisual(
  runtimeStatus: RuntimeStatus | null,
  palette: CellVisualPalette
): RuntimeVisual | null {
  if (!runtimeStatus) return null;
  if (runtimeStatus === 'quarantined') {
    return { kind: 'quarantined', fill: palette.quarantinedFill, stroke: palette.quarantinedStroke };
  }
  if (runtimeStatus === 'pick_active') {
    return { kind: 'pick_active', fill: palette.pickActiveFill, stroke: palette.pickActiveStroke };
  }
  if (runtimeStatus === 'reserved') {
    return { kind: 'reserved', fill: palette.reservedFill, stroke: palette.reservedStroke };
  }
  if (runtimeStatus === 'stocked') {
    return { kind: 'stocked', fill: palette.stockedFill, stroke: palette.stockedStroke };
  }
  return { kind: 'empty', fill: palette.emptyFill, stroke: palette.emptyStroke };
}

export function deriveCellVisualFlags(inputs: CellVisualInputs): CellVisualFlags {
  const isMissingCellIdentity = !inputs.hasCellIdentity;
  const hasRuntimeStatus = inputs.runtimeStatus !== null;
  const isOccupiedFallback = inputs.isOccupiedByFallback && !inputs.isSelected;
  const isWorkflowTargetLocked =
    inputs.isWorkflowScope &&
    inputs.hasCellIdentity &&
    !inputs.isSelected &&
    !inputs.isLocateTarget &&
    !inputs.isWorkflowSource &&
    isOccupiedFallback;
  const canSelectWorkflowTarget =
    !inputs.isWorkflowScope ||
    (inputs.hasCellIdentity && !inputs.isWorkflowSource && !isOccupiedFallback);

  return {
    isMissingCellIdentity,
    hasRuntimeStatus,
    isOccupiedFallback,
    isWorkflowTargetLocked,
    canSelectWorkflowTarget,
    semanticKind: isWorkflowTargetLocked
      ? 'locked'
      : hasRuntimeStatus
        ? (inputs.runtimeStatus as CellSemanticKind)
        : isOccupiedFallback
          ? 'occupied_fallback'
          : 'base'
  };
}

export function resolveCellVisualState(
  inputs: CellVisualInputs,
  palette: CellVisualPalette
): ResolvedCellVisualState {
  const flags = deriveCellVisualFlags(inputs);
  const runtimeVisual = resolveRuntimeVisual(inputs.runtimeStatus, palette);

  const fill = flags.isWorkflowTargetLocked
    ? palette.blockedFill
    : runtimeVisual
      ? runtimeVisual.fill
      : flags.isOccupiedFallback
        ? palette.occupiedFill
        : palette.baseFill;

  const stroke = flags.isWorkflowTargetLocked
    ? palette.blockedStroke
    : runtimeVisual
      ? runtimeVisual.stroke
      : flags.isOccupiedFallback
        ? palette.occupiedStroke
        : palette.baseStroke;

  const opacity = flags.isMissingCellIdentity
    ? 0.18
    : flags.isWorkflowTargetLocked
      ? 0.24
      : inputs.isRackPassive
        ? 0.4
        : flags.isOccupiedFallback || flags.hasRuntimeStatus
          ? 0.98
          : inputs.isRackSelected
            ? 0.9
            : 0.72;

  const strokeWidth =
    flags.isOccupiedFallback || flags.hasRuntimeStatus || flags.isWorkflowTargetLocked
      ? 0.9
      : inputs.isRackSelected
        ? 0.9
        : 0.5;

  let navigationFill: string | null = null;
  let navigationStroke: string | null = null;
  let navigationStrokeWidth = 0;
  let navigationDash: number[] | undefined;

  if (inputs.isSelected) {
    navigationFill = palette.selectedFill;
    navigationStroke = palette.selectedStroke;
    navigationStrokeWidth = 2.1;
  } else if (inputs.isLocateTarget) {
    navigationFill = palette.locateTargetFill;
    navigationStroke = palette.locateTargetStroke;
    navigationStrokeWidth = 1.9;
  } else if (inputs.isWorkflowSource) {
    navigationFill = palette.workflowSourceFill;
    navigationStroke = palette.workflowSourceStroke;
    navigationStrokeWidth = 1.6;
    navigationDash = [3, 2];
  } else if (inputs.isFocused) {
    navigationFill = palette.focusedFill;
    navigationStroke = palette.focusedStroke;
    navigationStrokeWidth = 1.45;
  } else if (inputs.isSearchHit) {
    navigationFill = palette.searchHitFill;
    navigationStroke = palette.searchHitStroke;
    navigationStrokeWidth = 1.15;
  }

  return {
    fill,
    stroke,
    opacity,
    strokeWidth,
    navigationFill,
    navigationStroke,
    navigationStrokeWidth,
    navigationDash,
    isClickable: inputs.isInteractive && inputs.hasCellIdentity && flags.canSelectWorkflowTarget,
    flags
  };
}
