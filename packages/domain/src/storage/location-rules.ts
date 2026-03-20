import { z } from 'zod';

export const locationFitFailureReasonSchema = z.enum([
  'LOCATION_NOT_ACTIVE',
  'SAME_LOCATION',
  'LOCATION_OCCUPIED',
  'LOCATION_DIMENSION_UNKNOWN',
  'LOCATION_DIMENSION_OVERFLOW',
  'LOCATION_WEIGHT_UNKNOWN',
  'LOCATION_WEIGHT_OVERFLOW'
]);

export type LocationFitFailureReason = z.infer<typeof locationFitFailureReasonSchema>;

type DimensionLike = {
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
};

type PlacementContext = {
  locationStatus: 'active' | 'disabled' | 'draft';
  sameLocation: boolean;
  occupied: boolean;
};

export function canContainerFitLocation(
  container: DimensionLike,
  location: DimensionLike
): { ok: true } | { ok: false; reason: 'LOCATION_DIMENSION_UNKNOWN' | 'LOCATION_DIMENSION_OVERFLOW' } {
  const checks: Array<[number | null, number | null]> = [
    [container.widthMm, location.widthMm],
    [container.heightMm, location.heightMm],
    [container.depthMm, location.depthMm]
  ];

  for (const [containerValue, locationLimit] of checks) {
    if (locationLimit === null) {
      continue;
    }

    if (containerValue === null) {
      return { ok: false, reason: 'LOCATION_DIMENSION_UNKNOWN' };
    }

    if (containerValue > locationLimit) {
      return { ok: false, reason: 'LOCATION_DIMENSION_OVERFLOW' };
    }
  }

  return { ok: true };
}

export function canContainerLoadFitLocation(
  grossWeightG: bigint | null,
  maxWeightG: bigint | null
): { ok: true } | { ok: false; reason: 'LOCATION_WEIGHT_UNKNOWN' | 'LOCATION_WEIGHT_OVERFLOW' } {
  if (maxWeightG === null) {
    return { ok: true };
  }

  if (grossWeightG === null) {
    return { ok: false, reason: 'LOCATION_WEIGHT_UNKNOWN' };
  }

  if (grossWeightG > maxWeightG) {
    return { ok: false, reason: 'LOCATION_WEIGHT_OVERFLOW' };
  }

  return { ok: true };
}

export function canPlaceIntoLocation(
  context: PlacementContext
): { ok: true } | { ok: false; reason: 'LOCATION_NOT_ACTIVE' | 'SAME_LOCATION' | 'LOCATION_OCCUPIED' } {
  if (context.locationStatus !== 'active') {
    return { ok: false, reason: 'LOCATION_NOT_ACTIVE' };
  }

  if (context.sameLocation) {
    return { ok: false, reason: 'SAME_LOCATION' };
  }

  if (context.occupied) {
    return { ok: false, reason: 'LOCATION_OCCUPIED' };
  }

  return { ok: true };
}
