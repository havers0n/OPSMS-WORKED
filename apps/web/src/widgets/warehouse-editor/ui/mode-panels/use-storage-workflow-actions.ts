import type {
  useActiveStorageWorkflow,
  useCancelPlacementInteraction,
  useMarkActiveStorageWorkflowSubmitting,
  useSetActiveStorageWorkflowError,
  useSetCreateAndPlacePlacementRetry,
  useSetSelectedCellId
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { useCreateContainer } from '@/features/container-create/model/use-create-container';
import { useMoveContainer } from '@/features/placement-actions/model/use-move-container';
import { usePlaceContainer } from '@/features/placement-actions/model/use-place-container';
import { formatCreateAndPlacePlacementFailure } from './cell-placement-inspector.lib';

export function useStorageWorkflowActions({
  floorId,
  activeStorageWorkflow,
  workflowLocationId,
  placeContainerIdInput,
  containerTypeIdInput,
  targetValidationMessage,
  cancelPlacementInteraction,
  markActiveStorageWorkflowSubmitting,
  setActiveStorageWorkflowError,
  setCreateAndPlacePlacementRetry,
  setSelectedCellId
}: {
  floorId: string | null;
  activeStorageWorkflow: ReturnType<typeof useActiveStorageWorkflow>;
  workflowLocationId: string | null;
  placeContainerIdInput: string;
  containerTypeIdInput: string;
  targetValidationMessage: string | null;
  cancelPlacementInteraction: ReturnType<typeof useCancelPlacementInteraction>;
  markActiveStorageWorkflowSubmitting: ReturnType<typeof useMarkActiveStorageWorkflowSubmitting>;
  setActiveStorageWorkflowError: ReturnType<typeof useSetActiveStorageWorkflowError>;
  setCreateAndPlacePlacementRetry: ReturnType<typeof useSetCreateAndPlacePlacementRetry>;
  setSelectedCellId: ReturnType<typeof useSetSelectedCellId>;
}) {
  const placeContainer = usePlaceContainer({
    floorId,
    locationId: workflowLocationId
  });
  const moveContainer = useMoveContainer({
    floorId,
    sourceCellId:
      activeStorageWorkflow?.kind === 'move-container'
        ? activeStorageWorkflow.sourceCellId
        : null,
    containerId:
      activeStorageWorkflow?.kind === 'move-container'
        ? activeStorageWorkflow.containerId
        : null
  });
  const createContainer = useCreateContainer();

  const isSubmitting =
    activeStorageWorkflow?.status === 'submitting' ||
    placeContainer.isPending ||
    moveContainer.isPending ||
    createContainer.isPending;

  const handleConfirmMove = async () => {
    if (
      activeStorageWorkflow?.kind !== 'move-container' ||
      !activeStorageWorkflow.targetCellId ||
      !workflowLocationId ||
      targetValidationMessage
    ) {
      return;
    }

    markActiveStorageWorkflowSubmitting();

    try {
      await moveContainer.mutateAsync({
        containerId: activeStorageWorkflow.containerId,
        targetLocationId: workflowLocationId
      });
      setSelectedCellId(activeStorageWorkflow.targetCellId);
      cancelPlacementInteraction();
    } catch (error) {
      setActiveStorageWorkflowError(
        error instanceof Error ? error.message : 'Could not move the container.'
      );
    }
  };

  const handleConfirmPlace = async () => {
    const nextContainerId = placeContainerIdInput.trim();
    if (!workflowLocationId || nextContainerId.length === 0) {
      return;
    }

    markActiveStorageWorkflowSubmitting();

    try {
      await placeContainer.mutateAsync({
        containerId: nextContainerId,
        locationId: workflowLocationId
      });
      cancelPlacementInteraction();
    } catch (error) {
      setActiveStorageWorkflowError(
        error instanceof Error ? error.message : 'Could not place the container.'
      );
    }
  };

  const handleCreateAndPlace = async () => {
    if (
      activeStorageWorkflow?.kind !== 'create-and-place' ||
      activeStorageWorkflow.status === 'placement-retry' ||
      !workflowLocationId ||
      containerTypeIdInput.length === 0
    ) {
      return;
    }

    markActiveStorageWorkflowSubmitting();

    try {
      const container = await createContainer.mutateAsync({
        containerTypeId: containerTypeIdInput,
        operationalRole: 'storage'
      });

      try {
        await placeContainer.mutateAsync({
          containerId: container.containerId,
          locationId: workflowLocationId
        });
        cancelPlacementInteraction();
      } catch (error) {
        setCreateAndPlacePlacementRetry(
          {
            id: container.containerId,
            code: container.systemCode
          },
          formatCreateAndPlacePlacementFailure(
            container.systemCode,
            error instanceof Error ? error.message : 'Placement failed.'
          )
        );
      }
    } catch (error) {
      setActiveStorageWorkflowError(
        error instanceof Error ? error.message : 'Could not create the container.'
      );
    }
  };

  const handleRetryCreatedContainerPlacement = async () => {
    if (
      activeStorageWorkflow?.kind !== 'create-and-place' ||
      activeStorageWorkflow.status !== 'placement-retry' ||
      !activeStorageWorkflow.createdContainer ||
      !workflowLocationId
    ) {
      return;
    }

    markActiveStorageWorkflowSubmitting();

    try {
      await placeContainer.mutateAsync({
        containerId: activeStorageWorkflow.createdContainer.id,
        locationId: workflowLocationId
      });
      cancelPlacementInteraction();
    } catch (error) {
      setCreateAndPlacePlacementRetry(
        activeStorageWorkflow.createdContainer,
        formatCreateAndPlacePlacementFailure(
          activeStorageWorkflow.createdContainer.code,
          error instanceof Error ? error.message : 'Placement failed.'
        )
      );
    }
  };

  return {
    isSubmitting,
    handleConfirmMove,
    handleConfirmPlace,
    handleCreateAndPlace,
    handleRetryCreatedContainerPlacement
  };
}
