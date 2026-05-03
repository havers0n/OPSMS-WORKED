import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  locationEffectiveRoleQueryOptions,
  locationProductAssignmentsQueryOptions,
  productLocationRoleKeys
} from './queries';
import { bffRequest } from '@/shared/api/bff/client';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn()
}));

describe('productLocationRoleKeys', () => {
  it('uses stable location keys and none sentinels', () => {
    expect(productLocationRoleKeys.byLocationAll()).toEqual([
      'product-location-role',
      'by-location'
    ]);
    expect(productLocationRoleKeys.byLocation('location-a')).toEqual([
      'product-location-role',
      'by-location',
      'location-a'
    ]);
    expect(productLocationRoleKeys.byLocation(null)).toEqual([
      'product-location-role',
      'by-location',
      'none'
    ]);
    expect(productLocationRoleKeys.effectiveRoleAll()).toEqual([
      'product-location-role',
      'effective-role'
    ]);
  });
});

describe('locationProductAssignmentsQueryOptions', () => {
  beforeEach(() => {
    vi.mocked(bffRequest).mockReset();
  });

  it('is enabled only when locationId exists', () => {
    expect(locationProductAssignmentsQueryOptions(null).enabled).toBe(false);
    expect(locationProductAssignmentsQueryOptions('location-a').enabled).toBe(true);
  });

  it('requests product assignments by location', async () => {
    vi.mocked(bffRequest).mockResolvedValue([] as never);
    const options = locationProductAssignmentsQueryOptions('location-a');
    await options.queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith('/api/locations/location-a/product-assignments');
  });
});

describe('locationEffectiveRoleQueryOptions', () => {
  beforeEach(() => {
    vi.mocked(bffRequest).mockReset();
  });

  it('is disabled when locationId is missing', () => {
    expect(locationEffectiveRoleQueryOptions(null, 'product-a').enabled).toBe(false);
  });

  it('is disabled when productId is missing', () => {
    expect(locationEffectiveRoleQueryOptions('location-a', null).enabled).toBe(false);
  });

  it('is enabled only with valid locationId and productId', () => {
    expect(locationEffectiveRoleQueryOptions('location-a', 'product-a').enabled).toBe(true);
  });

  it('uses stable query key shape', () => {
    expect(locationEffectiveRoleQueryOptions('location-a', 'product-a').queryKey).toEqual([
      'product-location-role',
      'effective-role',
      'location-a',
      'product-a'
    ]);
    expect(locationEffectiveRoleQueryOptions(null, null).queryKey).toEqual([
      'product-location-role',
      'effective-role',
      'none',
      'none'
    ]);
  });

  it('requests canonical effective-role route with productId query param', async () => {
    vi.mocked(bffRequest).mockResolvedValue({} as never);
    const options = locationEffectiveRoleQueryOptions('location-a', 'product-a');
    await options.queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith(
      '/api/locations/location-a/effective-role?productId=product-a'
    );
  });
});
