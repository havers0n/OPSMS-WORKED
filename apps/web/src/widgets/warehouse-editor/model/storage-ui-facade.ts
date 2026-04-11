import {
  useActiveStorageWorkflow,
  useCancelPlacementInteraction,
  useEditorSelection,
  useMarkActiveStorageWorkflowSubmitting,
  useSelectedCellId,
  useSelectedRackActiveLevel,
  useSetActiveStorageWorkflowError,
  useSetCreateAndPlacePlacementRetry,
  useSetPlacementMoveTargetCellId,
  useSetSelectedCellId,
  useSetSelectedContainerId,
  useSetSelectedRackActiveLevel,
  useStartCreateAndPlaceWorkflow,
  useStartPlaceContainerWorkflow,
  useStartPlacementMove
} from './editor-selectors';
export { resolveStorageFocusContext } from './storage-focus';

export const useStorageSelection = useEditorSelection;
export const useStorageSelectedRackActiveLevel = useSelectedRackActiveLevel;
export const useStorageSetSelectedRackActiveLevel = useSetSelectedRackActiveLevel;
export const useStorageSelectedCellId = useSelectedCellId;
export const useStorageSetSelectedCellId = useSetSelectedCellId;
export const useStorageSetSelectedContainerId = useSetSelectedContainerId;
export const useStorageActiveWorkflow = useActiveStorageWorkflow;
export const useStorageStartPlaceContainerWorkflow = useStartPlaceContainerWorkflow;
export const useStorageStartCreateAndPlaceWorkflow = useStartCreateAndPlaceWorkflow;
export const useStorageStartPlacementMove = useStartPlacementMove;
export const useStorageSetPlacementMoveTargetCellId = useSetPlacementMoveTargetCellId;
export const useStorageCancelPlacementInteraction = useCancelPlacementInteraction;
export const useStorageSetWorkflowError = useSetActiveStorageWorkflowError;
export const useStorageSetCreateAndPlacePlacementRetry = useSetCreateAndPlacePlacementRetry;
export const useStorageMarkWorkflowSubmitting = useMarkActiveStorageWorkflowSubmitting;
