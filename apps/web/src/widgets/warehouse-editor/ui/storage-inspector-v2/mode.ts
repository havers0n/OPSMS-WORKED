export type PanelMode =
  | { kind: 'empty' }
  | { kind: 'rack-overview'; rackId: string }
  | { kind: 'cell-overview'; cellId: string }
  | { kind: 'container-detail'; cellId: string; containerId: string }
  | { kind: 'task-transfer-to-container'; cellId: string; containerId: string }
  | { kind: 'task-extract-quantity'; cellId: string; containerId: string }
  | { kind: 'task-add-product-to-container'; cellId: string; containerId: string }
  | { kind: 'task-edit-override'; cellId: string; containerId: string }
  | { kind: 'task-repair-conflict'; cellId: string; containerId: string }
  | { kind: 'task-create-container'; cellId: string }
  | { kind: 'task-create-container-from-preset'; cellId: string }
  | { kind: 'task-create-container-with-product'; cellId: string }
  | { kind: 'task-place-existing'; cellId: string }
  | { kind: 'task-remove-container'; cellId: string; containerId: string }
  | { kind: 'task-move-container'; sourceContainerId: string; sourceCellId: string }
  | { kind: 'task-swap-container'; sourceContainerId: string; sourceCellId: string };

export type TaskKind =
  | 'create-container'
  | 'create-container-from-preset'
  | 'create-container-with-product'
  | 'place-existing'
  | 'remove-container'
  | 'move-container'
  | 'swap-container'
  | 'transfer-to-container'
  | 'extract-quantity'
  | 'edit-override'
  | 'repair-conflict'
  | 'add-product-to-container';

/**
 * Local task state for the move-container flow.
 * sourceContainerDisplayCode and sourceLocationCode are captured at task start
 * so they survive the user browsing away to select a target cell.
 * targetLocationId is resolved inside the root from targetCellId.
 */
export type MoveTaskState = {
  sourceContainerId: string;
  sourceCellId: string;
  sourceLocationId: string;
  sourceRackId: string | null;
  sourceLevel: number | null;
  sourceLocationCode: string;
  sourceContainerDisplayCode: string;
  targetCellId: string | null;
  stage: 'selecting-target' | 'moving' | 'error';
  errorMessage: string | null;
};

export type SwapTaskState = {
  sourceContainerId: string;
  sourceCellId: string;
  sourceLocationId: string;
  sourceRackId: string | null;
  sourceLevel: number | null;
  sourceLocationCode: string;
  sourceContainerDisplayCode: string;
  targetCellId: string | null;
  stage: 'selecting-target' | 'swapping' | 'error';
  errorMessage: string | null;
};

/**
 * Priority: container-detail > cell-overview > rack-overview > empty
 * containerId only activates when cellId is also set.
 */
export function resolvePanelMode(
  rackId: string | null,
  cellId: string | null,
  containerId: string | null
): PanelMode {
  if (cellId && containerId) return { kind: 'container-detail', cellId, containerId };
  if (cellId) return { kind: 'cell-overview', cellId };
  if (rackId) return { kind: 'rack-overview', rackId };
  return { kind: 'empty' };
}

/**
 * Move task overrides all base modes.
 * Create tasks activate only from cell-overview.
 */
export function resolveActiveMode(
  base: PanelMode,
  taskKind: TaskKind | null,
  moveTaskState: MoveTaskState | null = null,
  swapTaskState: SwapTaskState | null = null
): PanelMode {
  if (taskKind === 'move-container' && moveTaskState !== null) {
    return {
      kind: 'task-move-container',
      sourceContainerId: moveTaskState.sourceContainerId,
      sourceCellId: moveTaskState.sourceCellId
    };
  }

  if (taskKind === 'swap-container' && swapTaskState !== null) {
    return {
      kind: 'task-swap-container',
      sourceContainerId: swapTaskState.sourceContainerId,
      sourceCellId: swapTaskState.sourceCellId
    };
  }

  if (base.kind === 'container-detail' && taskKind === 'edit-override') {
    return { kind: 'task-edit-override', cellId: base.cellId, containerId: base.containerId };
  }

  if (base.kind === 'container-detail' && taskKind === 'transfer-to-container') {
    return { kind: 'task-transfer-to-container', cellId: base.cellId, containerId: base.containerId };
  }

  if (base.kind === 'container-detail' && taskKind === 'extract-quantity') {
    return { kind: 'task-extract-quantity', cellId: base.cellId, containerId: base.containerId };
  }

  if (base.kind === 'container-detail' && taskKind === 'repair-conflict') {
    return { kind: 'task-repair-conflict', cellId: base.cellId, containerId: base.containerId };
  }

  if (base.kind === 'container-detail' && taskKind === 'add-product-to-container') {
    return {
      kind: 'task-add-product-to-container',
      cellId: base.cellId,
      containerId: base.containerId
    };
  }

  if (base.kind === 'container-detail' && taskKind === 'remove-container') {
    return { kind: 'task-remove-container', cellId: base.cellId, containerId: base.containerId };
  }

  if (base.kind === 'cell-overview' && taskKind === 'create-container') {
    return { kind: 'task-create-container', cellId: base.cellId };
  }

  if (base.kind === 'cell-overview' && taskKind === 'create-container-from-preset') {
    return { kind: 'task-create-container-from-preset', cellId: base.cellId };
  }

  if (base.kind === 'cell-overview' && taskKind === 'create-container-with-product') {
    return { kind: 'task-create-container-with-product', cellId: base.cellId };
  }

  if (base.kind === 'cell-overview' && taskKind === 'place-existing') {
    return { kind: 'task-place-existing', cellId: base.cellId };
  }

  return base;
}
