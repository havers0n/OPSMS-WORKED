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

export type LocationEffectiveRole = {
  locationId: string;
  productId: string;
  structuralDefaultRole: 'primary_pick' | 'reserve' | 'none';
  effectiveRole: 'primary_pick' | 'reserve' | 'none' | null;
  effectiveRoleSource: 'explicit_override' | 'structural_default' | 'none' | 'conflict';
  conflictingPublishedRoles: Array<'primary_pick' | 'reserve'>;
};

export const productLocationRoleKeys = {
  all: ['product-location-role'] as const,
  byLocation: (locationId: string | null) =>
    [...productLocationRoleKeys.all, 'by-location', locationId ?? 'none'] as const,
  effectiveRole: (locationId: string | null, productId: string | null) =>
    [...productLocationRoleKeys.all, 'effective-role', locationId ?? 'none', productId ?? 'none'] as const
};

async function fetchLocationProductAssignments(
  locationId: string
): Promise<LocationProductAssignment[]> {
  return bffRequest<LocationProductAssignment[]>(
    `/api/locations/${locationId}/product-assignments`
  );
}

async function fetchLocationEffectiveRole(locationId: string, productId: string): Promise<LocationEffectiveRole> {
  return bffRequest<LocationEffectiveRole>(
    `/api/locations/${locationId}/effective-role?productId=${encodeURIComponent(productId)}`
  );
}

export function locationProductAssignmentsQueryOptions(locationId: string | null) {
  return queryOptions({
    queryKey: productLocationRoleKeys.byLocation(locationId),
    queryFn: () => fetchLocationProductAssignments(locationId as string),
    enabled: Boolean(locationId)
  });
}

export function locationEffectiveRoleQueryOptions(locationId: string | null, productId: string | null) {
  return queryOptions({
    queryKey: productLocationRoleKeys.effectiveRole(locationId, productId),
    queryFn: () => fetchLocationEffectiveRole(locationId as string, productId as string),
    enabled: Boolean(locationId && productId)
  });
}
