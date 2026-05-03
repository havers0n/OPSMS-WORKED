import { describe, expect, it, vi } from 'vitest';
import { createLocationReadRepo } from './location-read-repo.js';

describe('location read repo', () => {
  it('resolves active locations by published cell id', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'location-1',
        code: '01-A.01.01.01',
        location_type: 'rack_slot',
        geometry_slot_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      },
      error: null
    }));
    const eqStatus = vi.fn(() => ({ maybeSingle }));
    const eqGeometrySlot = vi.fn(() => ({ eq: eqStatus }));
    const select = vi.fn(() => ({ eq: eqGeometrySlot }));
    const from = vi.fn(() => ({ select }));

    const repo = createLocationReadRepo({ from } as never);

    await expect(
      repo.getLocationByCell('216f2dd6-8f17-4de4-aaba-657f9e0e1398')
    ).resolves.toEqual({
      locationId: 'location-1',
      locationCode: '01-A.01.01.01',
      locationType: 'rack_slot',
      cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
    });

    expect(from).toHaveBeenCalledWith('locations');
    expect(eqGeometrySlot).toHaveBeenCalledWith('geometry_slot_id', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');
    expect(eqStatus).toHaveBeenCalledWith('status', 'active');
  });

  it('does not resolve disabled removed locations as active by cell id', async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const eqStatus = vi.fn(() => ({ maybeSingle }));
    const eqGeometrySlot = vi.fn(() => ({ eq: eqStatus }));
    const select = vi.fn(() => ({ eq: eqGeometrySlot }));
    const from = vi.fn(() => ({ select }));

    const repo = createLocationReadRepo({ from } as never);

    await expect(
      repo.getLocationByCell('216f2dd6-8f17-4de4-aaba-657f9e0e1398')
    ).resolves.toBeNull();

    expect(eqGeometrySlot).toHaveBeenCalledWith('geometry_slot_id', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');
    expect(eqStatus).toHaveBeenCalledWith('status', 'active');
  });
});
