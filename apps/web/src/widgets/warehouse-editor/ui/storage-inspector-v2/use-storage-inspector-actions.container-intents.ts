import type { QueryClient } from '@tanstack/react-query';
import { createContainer } from '@/features/container-create/api/mutations';
import { addInventoryItem } from '@/features/inventory-add/api/mutations';
import { moveContainer as moveContainerApi, placeContainer } from '@/features/placement-actions/api/mutations';
import { containerStorageQueryOptions } from '@/entities/container/api/queries';
import { locationKeys } from '@/entities/location/api/queries';
import { hasInventoryRows } from './helpers';
import type { MoveTaskState } from './mode';
import {
  refreshAfterAddProduct,
  refreshAfterCreateOrPlace,
  refreshAfterMove
} from './use-storage-inspector-actions.refresh';

export interface ContainerIntentDeps {
  queryClient: QueryClient;
  floorId: string | null;
  locationId: string | null;
  addInventoryToContainerMutateAsync: (params: {
    containerId: string;
    productId: string;
    quantity: number;
    uom: string;
  }) => Promise<unknown>;
}

export function createContainerIntents(deps: ContainerIntentDeps) {
  const onCreateContainer = async (params: {
    containerTypeId: string;
    externalCode: string;
    isSubmitting: boolean;
    setIsSubmitting: (value: boolean) => void;
    setErrorMessage: (value: string | null) => void;
    onSuccess: () => void;
  }) => {
    if (!deps.locationId || !params.containerTypeId || params.isSubmitting) return;

    params.setIsSubmitting(true);
    params.setErrorMessage(null);

    try {
      let containerId: string;
      try {
        const result = await createContainer({
          containerTypeId: params.containerTypeId,
          externalCode: params.externalCode.trim() || undefined
        });
        containerId = result.containerId;
      } catch {
        params.setErrorMessage('Failed to create container.');
        return;
      }

      try {
        await placeContainer({ containerId, locationId: deps.locationId });
      } catch {
        params.setErrorMessage('Failed to place container at this location.');
        return;
      }

      await refreshAfterCreateOrPlace({
        queryClient: deps.queryClient,
        floorId: deps.floorId,
        locationId: deps.locationId,
        containerId
      });
      params.onSuccess();
    } finally {
      params.setIsSubmitting(false);
    }
  };

  const onCreateContainerWithProduct = async (params: {
    containerTypeId: string;
    externalCode: string;
    productId: string | null;
    quantity: string;
    uom: string;
    isSubmitting: boolean;
    setIsSubmitting: (value: boolean) => void;
    setErrorMessage: (value: string | null) => void;
    onSuccess: () => void;
  }) => {
    if (
      !deps.locationId ||
      !params.containerTypeId ||
      !params.productId ||
      params.quantity.trim() === '' ||
      Number(params.quantity) <= 0 ||
      params.uom.trim() === '' ||
      params.isSubmitting
    ) {
      return;
    }

    params.setIsSubmitting(true);
    params.setErrorMessage(null);

    try {
      let containerId: string;
      try {
        const result = await createContainer({
          containerTypeId: params.containerTypeId,
          externalCode: params.externalCode.trim() || undefined
        });
        containerId = result.containerId;
      } catch {
        params.setErrorMessage('Failed to create container.');
        return;
      }

      try {
        await placeContainer({ containerId, locationId: deps.locationId });
      } catch {
        params.setErrorMessage('Failed to place container at this location.');
        return;
      }

      try {
        await addInventoryItem({
          containerId,
          productId: params.productId,
          quantity: Number(params.quantity),
          uom: params.uom.trim()
        });
      } catch {
        await deps.queryClient.invalidateQueries({ queryKey: locationKeys.storage(deps.locationId) });
        params.setErrorMessage(
          'Container was created and placed, but inventory could not be added. The container is now empty at this location.'
        );
        return;
      }

      await refreshAfterCreateOrPlace({
        queryClient: deps.queryClient,
        floorId: deps.floorId,
        locationId: deps.locationId,
        containerId
      });
      params.onSuccess();
    } finally {
      params.setIsSubmitting(false);
    }
  };

  const onMoveContainerConfirm = async (params: {
    moveTaskState: MoveTaskState | null;
    resolvedTargetLocationId: string | null;
    onStageChange: (stage: MoveTaskState['stage'], errorMessage?: string | null) => void;
  }) => {
    if (!params.moveTaskState || !params.resolvedTargetLocationId) return;

    params.onStageChange('moving');

    try {
      await moveContainerApi({
        containerId: params.moveTaskState.sourceContainerId,
        targetLocationId: params.resolvedTargetLocationId
      });

      await refreshAfterMove({
        queryClient: deps.queryClient,
        floorId: deps.floorId,
        sourceCellId: params.moveTaskState.sourceCellId,
        containerId: params.moveTaskState.sourceContainerId
      });

      params.onStageChange('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Move failed. Please try again.';
      params.onStageChange('error', message);
    }
  };

  const onAddProductToContainer = async (params: {
    containerId: string;
    productId: string | null;
    quantity: string;
    uom: string;
    isContainerEmpty: boolean;
    setErrorMessage: (value: string | null) => void;
    onSuccess: () => void;
  }) => {
    if (!deps.locationId || !params.productId || !params.containerId) return;
    params.setErrorMessage(null);

    if (!params.isContainerEmpty) {
      params.setErrorMessage('This container is no longer empty. Return to details to continue.');
      return;
    }

    try {
      const latestRows = await deps.queryClient.fetchQuery(containerStorageQueryOptions(params.containerId));
      if (hasInventoryRows(latestRows)) {
        params.setErrorMessage('This container is no longer empty. Return to details to continue.');
        return;
      }

      await deps.addInventoryToContainerMutateAsync({
        containerId: params.containerId,
        productId: params.productId,
        quantity: Number(params.quantity),
        uom: params.uom.trim()
      });

      await refreshAfterAddProduct({
        queryClient: deps.queryClient,
        locationId: deps.locationId,
        containerId: params.containerId
      });
      params.onSuccess();
    } catch (error) {
      params.setErrorMessage(error instanceof Error ? error.message : 'Could not add product.');
    }
  };

  return {
    onCreateContainer,
    onCreateContainerWithProduct,
    onMoveContainerConfirm,
    onAddProductToContainer
  };
}
