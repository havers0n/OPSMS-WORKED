import { describe, expect, it } from 'vitest';
import {
  computePreviewFingerprint,
  fingerprintsMatch,
  type PreviewFingerprint
} from '../api/warehouse-labels-api';

describe('computePreviewFingerprint', () => {
  it('computes a fingerprint with the provided floorId and preset', () => {
    const fp = computePreviewFingerprint(
      '11111111-1111-4111-8111-111111111111',
      'rack-slot-100x50',
      { mode: 'entire-floor' }
    );
    expect(fp).toEqual({
      floorId: '11111111-1111-4111-8111-111111111111',
      selection: { mode: 'entire-floor' },
      labelPreset: 'rack-slot-100x50',
      layoutMode: 'single-label-page'
    });
  });

  it('uses entire-floor selection and single-label-page layout by default', () => {
    const fp = computePreviewFingerprint('floor-1', 'rack-slot-70x40', { mode: 'entire-floor' });
    expect(fp.selection.mode).toBe('entire-floor');
    expect(fp.layoutMode).toBe('single-label-page');
  });

  it('sorts and deduplicates location ids for stable fingerprints', () => {
    const fp = computePreviewFingerprint('floor-1', 'rack-slot-70x40', {
      mode: 'location-ids',
      locationIds: ['loc-3', 'loc-1', 'loc-1', 'loc-2']
    });

    expect(fp.selection).toEqual({
      mode: 'location-ids',
      locationIds: ['loc-1', 'loc-2', 'loc-3']
    });
  });
});

describe('fingerprintsMatch', () => {
  const base: PreviewFingerprint = {
    floorId: '11111111-1111-4111-8111-111111111111',
    selection: { mode: 'entire-floor' },
    labelPreset: 'rack-slot-100x50',
    layoutMode: 'single-label-page'
  };

  it('matches identical fingerprints', () => {
    expect(fingerprintsMatch(base, { ...base })).toBe(true);
  });

  it('does not match when preset differs', () => {
    expect(fingerprintsMatch(base, { ...base, labelPreset: 'rack-slot-70x40' })).toBe(false);
  });

  it('does not match when floorId differs', () => {
    expect(fingerprintsMatch(base, { ...base, floorId: '22222222-2222-4222-8222-222222222222' })).toBe(false);
  });

  it('does not match when either is null', () => {
    expect(fingerprintsMatch(base, null)).toBe(false);
    expect(fingerprintsMatch(null, base)).toBe(false);
    expect(fingerprintsMatch(null, null)).toBe(false);
  });

  it('does not match when selection mode differs', () => {
    expect(
      fingerprintsMatch(base, {
        ...base,
        selection: { mode: 'location-ids', locationIds: ['loc-1'] }
      })
    ).toBe(false);
  });

  it('does not match when layout mode differs', () => {
    expect(fingerprintsMatch(base, { ...base, layoutMode: 'a4-sheet' })).toBe(false);
  });

  it('matches equivalent location-id selections regardless of click order', () => {
    const left: PreviewFingerprint = {
      floorId: '11111111-1111-4111-8111-111111111111',
      selection: { mode: 'location-ids', locationIds: ['loc-1', 'loc-2'] },
      labelPreset: 'rack-slot-100x50',
      layoutMode: 'single-label-page'
    };
    const right = computePreviewFingerprint(
      '11111111-1111-4111-8111-111111111111',
      'rack-slot-100x50',
      { mode: 'location-ids', locationIds: ['loc-2', 'loc-1', 'loc-1'] }
    );

    expect(fingerprintsMatch(left, right)).toBe(true);
  });
});
