import { describe, expect, it } from 'vitest';
import { locationKeys } from './queries';

describe('locationKeys', () => {
  it('uses stable keys for location-native reads', () => {
    expect(locationKeys.byCellAll()).toEqual(['location', 'by-cell']);
    expect(locationKeys.byCell('cell-a')).toEqual(['location', 'by-cell', 'cell-a']);
    expect(locationKeys.containers('location-a')).toEqual(['location', 'containers', 'location-a']);
    expect(locationKeys.storageAll()).toEqual(['location', 'storage']);
    expect(locationKeys.storage('location-a')).toEqual(['location', 'storage', 'location-a']);
    expect(locationKeys.occupancyByFloor('floor-a')).toEqual(['location', 'occupancy-by-floor', 'floor-a']);
  });

  it('uses none sentinels for unset identities', () => {
    expect(locationKeys.byCell(null)).toEqual(['location', 'by-cell', 'none']);
    expect(locationKeys.containers(null)).toEqual(['location', 'containers', 'none']);
    expect(locationKeys.storage(null)).toEqual(['location', 'storage', 'none']);
    expect(locationKeys.occupancyByFloor(null)).toEqual(['location', 'occupancy-by-floor', 'none']);
  });
});
