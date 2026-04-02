import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export type LocationProductAssignment = {
  id: string;
  productId: string;
  locationId: string;
  role: 'primary_pick' | 'reserve';
  state: 'draft' | 'published' | 'inactive';
  layoutVersionId: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    imageUrl: string | null;
  };
};

export const productLocationRoleKeys = {
  all: ['product-location-role'] as const,
  byLocation: (locationId: string | null) =>
    [...productLocationRoleKeys.all, 'by-location', locationId ?? 'none'] as const
};

async function fetchLocationProductAssignments(
  locationId: string
): Promise<LocationProductAssignment[]> {
  return bffRequest<LocationProductAssignment[]>(
    `/api/locations/${locationId}/product-assignments`
  );
}

export function locationProductAssignmentsQueryOptions(locationId: string | null) {
  return queryOptions({
    queryKey: productLocationRoleKeys.byLocation(locationId),
    queryFn: () => fetchLocationProductAssignments(locationId as string),
    enabled: Boolean(locationId)
  });
}
