import { describe, expect, it } from 'vitest';
import {
  canContainerFitLocation,
  canContainerLoadFitLocation,
  canPlaceIntoLocation
} from './location-rules';

describe('location-rules', () => {
  it('accepts fitting dimensions when all enforced limits are satisfied', () => {
    expect(
      canContainerFitLocation(
        { widthMm: 900, heightMm: 1200, depthMm: 700 },
        { widthMm: 1000, heightMm: 1300, depthMm: 800 }
      )
    ).toEqual({ ok: true });
  });

  it('rejects unknown dimensions when the location enforces a limit', () => {
    expect(
      canContainerFitLocation(
        { widthMm: null, heightMm: 1200, depthMm: 700 },
        { widthMm: 1000, heightMm: null, depthMm: null }
      )
    ).toEqual({ ok: false, reason: 'LOCATION_DIMENSION_UNKNOWN' });
  });

  it('rejects overflowing dimensions', () => {
    expect(
      canContainerFitLocation(
        { widthMm: 1100, heightMm: 1200, depthMm: 700 },
        { widthMm: 1000, heightMm: 1300, depthMm: 800 }
      )
    ).toEqual({ ok: false, reason: 'LOCATION_DIMENSION_OVERFLOW' });
  });

  it('rejects unknown weight when the location enforces a weight limit', () => {
    expect(canContainerLoadFitLocation(null, 1000n)).toEqual({
      ok: false,
      reason: 'LOCATION_WEIGHT_UNKNOWN'
    });
  });

  it('rejects overflowing weight', () => {
    expect(canContainerLoadFitLocation(1500n, 1000n)).toEqual({
      ok: false,
      reason: 'LOCATION_WEIGHT_OVERFLOW'
    });
  });

  it('enforces active, different, and unoccupied target locations', () => {
    expect(
      canPlaceIntoLocation({
        locationStatus: 'disabled',
        sameLocation: false,
        occupied: false
      })
    ).toEqual({ ok: false, reason: 'LOCATION_NOT_ACTIVE' });

    expect(
      canPlaceIntoLocation({
        locationStatus: 'active',
        sameLocation: true,
        occupied: false
      })
    ).toEqual({ ok: false, reason: 'SAME_LOCATION' });

    expect(
      canPlaceIntoLocation({
        locationStatus: 'active',
        sameLocation: false,
        occupied: true
      })
    ).toEqual({ ok: false, reason: 'LOCATION_OCCUPIED' });
  });
});
