import type { QueryClient } from '@tanstack/react-query';
import { locationKeys } from '@/entities/location/api/queries';
import { containerKeys } from '@/entities/container/api/queries';
import { productLocationRoleKeys } from '@/entities/product-location-role/api/queries';
import { invalidatePlacementQueries } from '@/features/placement-actions/model/invalidation';

export async function refreshAfterCreateOrPlace(params: {
  queryClient: QueryClient;
  floorId: string | null;
  locationId: string;
  containerId: string;
}) {
  await invalidatePlacementQueries(params.queryClient, {
    floorId: params.floorId,
    containerId: params.containerId
  });
  await params.queryClient.invalidateQueries({
    queryKey: locationKeys.storage(params.locationId)
  });
}

export async function refreshAfterMove(params: {
  queryClient: QueryClient;
  floorId: string | null;
  sourceCellId: string;
  containerId: string;
}) {
  await invalidatePlacementQueries(params.queryClient, {
    floorId: params.floorId,
    sourceCellId: params.sourceCellId,
    containerId: params.containerId
  });
  await params.queryClient.invalidateQueries({
    queryKey: containerKeys.currentLocation(params.containerId)
  });
}

export async function refreshAfterAddProduct(params: {
  queryClient: QueryClient;
  locationId: string;
  containerId: string;
}) {
  await Promise.all([
    params.queryClient.refetchQueries({
      queryKey: locationKeys.storage(params.locationId),
      exact: true
    }),
    params.queryClient.refetchQueries({
      queryKey: containerKeys.storage(params.containerId),
      exact: true
    })
  ]);
}

export async function refreshOverrideReadSurface(params: {
  queryClient: QueryClient;
  locationId: string;
  productId: string;
}) {
  await Promise.all([
    params.queryClient.refetchQueries({
      queryKey: productLocationRoleKeys.byLocation(params.locationId),
      exact: true
    }),
    params.queryClient.refetchQueries({
      queryKey: productLocationRoleKeys.effectiveRole(params.locationId, params.productId),
      exact: true
    })
  ]);
}
