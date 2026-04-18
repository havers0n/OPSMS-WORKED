import type { OperationsCellRuntime } from '@wos/domain';

type RuntimeStatus = OperationsCellRuntime['status'];

type RuntimeVisual = {
  fill: string;
  stroke: string;
};

export type CellVisualPalette = {
  baseFill: string;
  baseStroke: string;
  occupiedFill: string;
  occupiedStroke: string;
  selectedFill: string;
  selectedStroke: string;
  workflowSourceFill: string;
  workflowSourceStroke: string;
  highlightedStroke: string;
  lockedFill: string;
  lockedStroke: string;
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
  isWorkflowSource: boolean;
  isHighlighted: boolean;
  isOccupiedByFallback: boolean;
  runtimeStatus: RuntimeStatus | null;
};

export type CellVisualFlags = {
  isMissingCellIdentity: boolean;
  hasRuntimeStatus: boolean;
  isOccupiedFallback: boolean;
  isWorkflowTargetLocked: boolean;
  canSelectWorkflowTarget: boolean;
};

export type ResolvedCellVisualState = {
  fill: string;
  stroke: string;
  opacity: number;
  strokeWidth: number;
  isClickable: boolean;
  flags: CellVisualFlags;
};

function resolveRuntimeVisual(
  runtimeStatus: RuntimeStatus | null,
  palette: CellVisualPalette
): RuntimeVisual | null {
  if (!runtimeStatus) return null;
  if (runtimeStatus === 'quarantined') {
    return { fill: palette.quarantinedFill, stroke: palette.quarantinedStroke };
  }
  if (runtimeStatus === 'pick_active') {
    return { fill: palette.pickActiveFill, stroke: palette.pickActiveStroke };
  }
  if (runtimeStatus === 'reserved') {
    return { fill: palette.reservedFill, stroke: palette.reservedStroke };
  }
  if (runtimeStatus === 'stocked') {
    return { fill: palette.stockedFill, stroke: palette.stockedStroke };
  }
  return { fill: palette.emptyFill, stroke: palette.emptyStroke };
}

export function deriveCellVisualFlags(inputs: CellVisualInputs): CellVisualFlags {
  const isMissingCellIdentity = !inputs.hasCellIdentity;
  const hasRuntimeStatus = inputs.runtimeStatus !== null;
  const isOccupiedFallback = inputs.isOccupiedByFallback && !inputs.isSelected;
  const isWorkflowTargetLocked =
    inputs.isWorkflowScope &&
    inputs.hasCellIdentity &&
    !inputs.isSelected &&
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
    canSelectWorkflowTarget
  };
}

export function resolveCellVisualState(
  inputs: CellVisualInputs,
  palette: CellVisualPalette
): ResolvedCellVisualState {
  const flags = deriveCellVisualFlags(inputs);
  const runtimeVisual = resolveRuntimeVisual(inputs.runtimeStatus, palette);

  const fill = (() => {
    if (inputs.isSelected) return palette.selectedFill;
    if (inputs.isWorkflowSource) return palette.workflowSourceFill;
    if (flags.isWorkflowTargetLocked) return palette.lockedFill;
    if (runtimeVisual) return runtimeVisual.fill;
    if (flags.isOccupiedFallback) return palette.occupiedFill;
    return palette.baseFill;
  })();

  const stroke = (() => {
    if (inputs.isSelected) return palette.selectedStroke;
    if (inputs.isWorkflowSource) return palette.workflowSourceStroke;
    if (inputs.isHighlighted) return palette.highlightedStroke;
    if (flags.isWorkflowTargetLocked) return palette.lockedStroke;
    if (runtimeVisual) return runtimeVisual.stroke;
    if (flags.isOccupiedFallback) return palette.occupiedStroke;
    return palette.baseStroke;
  })();

  const opacity = flags.isMissingCellIdentity
    ? 0.18
    : inputs.isSelected || inputs.isWorkflowSource || inputs.isHighlighted
      ? 0.98
      : flags.isWorkflowTargetLocked
        ? 0.24
        : inputs.isRackPassive
          ? 0.4
          : flags.isOccupiedFallback || flags.hasRuntimeStatus
            ? 0.98
            : inputs.isRackSelected
              ? 0.9
              : 0.72;

  const strokeWidth = inputs.isSelected
    ? 1.4
    : inputs.isWorkflowSource || inputs.isHighlighted
      ? 1.2
      : flags.isOccupiedFallback || inputs.isRackSelected
        ? 0.9
        : 0.5;

  return {
    fill,
    stroke,
    opacity,
    strokeWidth,
    isClickable: inputs.isInteractive && inputs.hasCellIdentity && flags.canSelectWorkflowTarget,
    flags
  };
}
