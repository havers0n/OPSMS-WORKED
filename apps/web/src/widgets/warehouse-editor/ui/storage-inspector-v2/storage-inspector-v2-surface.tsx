import type { FloorWorkspace } from '@wos/domain';
import React, { useEffect, useRef } from 'react';
import { useStorageFocusSelectCell } from '../../model/v2/v2-selectors';
import { resolveActiveMode, resolvePanelMode } from './mode';
import { useStorageInspectorReadModel } from './use-storage-inspector-read-model';
import { useStorageInspectorPolicy } from './use-storage-inspector-policy';
import { useStorageInspectorActions } from './use-storage-inspector-actions';
import { useStorageInspectorUiState } from './use-storage-inspector-ui-state';
import { StorageInspectorV2Panels } from './storage-inspector-v2-panels';

interface StorageInspectorV2SurfaceProps {
  workspace: FloorWorkspace | null;
}

export function StorageInspectorV2Surface({ workspace }: StorageInspectorV2SurfaceProps) {
  const ui = useStorageInspectorUiState();

  const taskKindRef = useRef(ui.taskKind);
  taskKindRef.current = ui.taskKind;

  const moveTaskRef = useRef(ui.moveTaskState);
  moveTaskRef.current = ui.moveTaskState;

  const readModel = useStorageInspectorReadModel({
    workspace,
    selectedContainerId: ui.selectedContainerId,
    taskKind: ui.taskKind,
    moveTaskState: ui.moveTaskState,
    createWithProductSearch: ui.createWithProductSearch,
    addProductSearch: ui.addProductSearch
  });

  const baseMode = resolvePanelMode(readModel.rackId, readModel.cellId, ui.selectedContainerId);
  const mode = resolveActiveMode(baseMode, ui.taskKind, ui.moveTaskState);
  const policy = useStorageInspectorPolicy(readModel, { taskKind: ui.taskKind, baseMode });

  const addProductContainerId = mode.kind === 'task-add-product-to-container' ? mode.containerId : null;
  const addProductSourceCellId = mode.kind === 'task-add-product-to-container' ? mode.cellId : null;

  const actions = useStorageInspectorActions({
    floorId: readModel.floorId,
    locationId: readModel.locationId,
    addProductSourceCellId,
    addProductContainerId
  });

  const selectCell = useStorageFocusSelectCell();

  useEffect(() => {
    if (taskKindRef.current === 'move-container') {
      const current = moveTaskRef.current;
      if (readModel.cellId && current && readModel.cellId !== current.sourceCellId) {
        ui.setMoveTaskState((prev) => (prev ? { ...prev, targetCellId: readModel.cellId } : null));
      }
      return;
    }

    ui.resetAllTransientStateForCellChange();
  }, [readModel.cellId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (policy.shouldCloseEditOverrideTask) {
      ui.closeEditOverrideTask();
    }
  }, [policy.shouldCloseEditOverrideTask]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (policy.shouldCloseRepairConflictTask) {
      ui.closeRepairConflictTask();
    }
  }, [policy.shouldCloseRepairConflictTask]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <StorageInspectorV2Panels
      mode={mode}
      readModel={readModel}
      actions={actions}
      ui={ui}
      selectCell={selectCell}
    />
  );
}
