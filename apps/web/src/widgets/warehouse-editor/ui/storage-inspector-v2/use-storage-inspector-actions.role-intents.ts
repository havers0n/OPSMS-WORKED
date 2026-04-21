import type { QueryClient } from '@tanstack/react-query';
import type { UseMutateAsyncFunction } from '@tanstack/react-query';
import { refreshOverrideReadSurface } from './use-storage-inspector-actions.refresh';

interface RoleIntentDeps {
  queryClient: QueryClient;
  createProductLocationRoleMutateAsync: UseMutateAsyncFunction<
    unknown,
    Error,
    { locationId: string; productId: string; role: 'primary_pick' | 'reserve' },
    unknown
  >;
  deleteProductLocationRoleMutateAsync: UseMutateAsyncFunction<unknown, Error, string, unknown>;
}

async function deleteAssignments(ids: string[], mutateAsync: (id: string) => Promise<unknown>) {
  for (const id of ids) {
    await mutateAsync(id);
  }
}

export function createRoleIntents(deps: RoleIntentDeps) {
  const onSaveOverride = async (params: {
    locationId: string;
    productId: string;
    role: 'primary_pick' | 'reserve';
    explicitAssignmentIds: string[];
    setIsSubmitting: (value: boolean) => void;
    setErrorMessage: (value: string | null) => void;
    onSuccess: () => void;
  }) => {
    params.setIsSubmitting(true);
    params.setErrorMessage(null);

    try {
      await deleteAssignments(params.explicitAssignmentIds, deps.deleteProductLocationRoleMutateAsync);

      await deps.createProductLocationRoleMutateAsync({
        locationId: params.locationId,
        productId: params.productId,
        role: params.role
      });

      await refreshOverrideReadSurface({
        queryClient: deps.queryClient,
        locationId: params.locationId,
        productId: params.productId
      });
      params.onSuccess();
    } catch (error) {
      await refreshOverrideReadSurface({
        queryClient: deps.queryClient,
        locationId: params.locationId,
        productId: params.productId
      });
      params.setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not save explicit override. Canonical state was refreshed.'
      );
    } finally {
      params.setIsSubmitting(false);
    }
  };

  const onClearOverride = async (params: {
    locationId: string;
    productId: string;
    explicitAssignmentIds: string[];
    setIsSubmitting: (value: boolean) => void;
    setErrorMessage: (value: string | null) => void;
    onSuccess: () => void;
  }) => {
    params.setIsSubmitting(true);
    params.setErrorMessage(null);

    try {
      await deleteAssignments(params.explicitAssignmentIds, deps.deleteProductLocationRoleMutateAsync);
      await refreshOverrideReadSurface({
        queryClient: deps.queryClient,
        locationId: params.locationId,
        productId: params.productId
      });
      params.onSuccess();
    } catch (error) {
      await refreshOverrideReadSurface({
        queryClient: deps.queryClient,
        locationId: params.locationId,
        productId: params.productId
      });
      params.setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not clear explicit override. Canonical state was refreshed.'
      );
    } finally {
      params.setIsSubmitting(false);
    }
  };

  const onResolveConflict = async (params: {
    locationId: string;
    productId: string;
    role: 'primary_pick' | 'reserve';
    targetAssignmentIds: string[];
    canRepair: boolean;
    setIsSubmitting: (value: boolean) => void;
    setErrorMessage: (value: string | null) => void;
    onSuccess: () => void;
  }) => {
    if (!params.canRepair) {
      params.setErrorMessage('Cannot repair conflict: missing published explicit rows for this product/location.');
      return;
    }

    params.setIsSubmitting(true);
    params.setErrorMessage(null);

    try {
      await deleteAssignments(params.targetAssignmentIds, deps.deleteProductLocationRoleMutateAsync);

      await deps.createProductLocationRoleMutateAsync({
        locationId: params.locationId,
        productId: params.productId,
        role: params.role
      });

      await refreshOverrideReadSurface({
        queryClient: deps.queryClient,
        locationId: params.locationId,
        productId: params.productId
      });
      params.onSuccess();
    } catch (error) {
      await refreshOverrideReadSurface({
        queryClient: deps.queryClient,
        locationId: params.locationId,
        productId: params.productId
      });
      params.setErrorMessage(
        error instanceof Error ? error.message : 'Could not repair conflict. Canonical state was refreshed.'
      );
    } finally {
      params.setIsSubmitting(false);
    }
  };

  const onClearConflict = async (params: {
    locationId: string;
    productId: string;
    targetAssignmentIds: string[];
    canRepair: boolean;
    setIsSubmitting: (value: boolean) => void;
    setErrorMessage: (value: string | null) => void;
    onSuccess: () => void;
  }) => {
    if (!params.canRepair) {
      params.setErrorMessage('Cannot repair conflict: missing published explicit rows for this product/location.');
      return;
    }

    params.setIsSubmitting(true);
    params.setErrorMessage(null);

    try {
      await deleteAssignments(params.targetAssignmentIds, deps.deleteProductLocationRoleMutateAsync);

      await refreshOverrideReadSurface({
        queryClient: deps.queryClient,
        locationId: params.locationId,
        productId: params.productId
      });
      params.onSuccess();
    } catch (error) {
      await refreshOverrideReadSurface({
        queryClient: deps.queryClient,
        locationId: params.locationId,
        productId: params.productId
      });
      params.setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not clear explicit overrides. Canonical state was refreshed.'
      );
    } finally {
      params.setIsSubmitting(false);
    }
  };

  return {
    onSaveOverride,
    onClearOverride,
    onResolveConflict,
    onClearConflict
  };
}
