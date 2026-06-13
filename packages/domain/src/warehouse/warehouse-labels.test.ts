import { describe, expect, it } from 'vitest';
import {
  getWarehouseLabelPreset,
  warehouseLabelPreviewRequestSchema,
  warehouseLabelPreviewResponseSchema
} from './warehouse-labels';

describe('warehouse label schemas', () => {
  it('parses the discriminated preview request variants', () => {
    expect(
      warehouseLabelPreviewRequestSchema.parse({
        floorId: '11111111-1111-4111-8111-111111111111',
        selection: {
          mode: 'location-ids',
          locationIds: ['22222222-2222-4222-8222-222222222222']
        },
        labelPreset: 'rack-slot-100x50',
        layout: {
          mode: 'a4-sheet',
          marginMm: 5,
          gapMm: 2
        },
        sort: 'address'
      })
    ).toMatchObject({
      selection: { mode: 'location-ids' },
      layout: { mode: 'a4-sheet', marginMm: 5, gapMm: 2 }
    });
  });

  it('rejects an empty location id selection list', () => {
    expect(() =>
      warehouseLabelPreviewRequestSchema.parse({
        floorId: '11111111-1111-4111-8111-111111111111',
        selection: {
          mode: 'location-ids',
          locationIds: []
        },
        labelPreset: 'rack-slot-100x50',
        layout: {
          mode: 'single-label-page'
        },
        sort: 'address'
      })
    ).toThrow();
  });

  it('returns the fixed preset dimensions', () => {
    expect(getWarehouseLabelPreset('rack-slot-70x40')).toEqual({
      id: 'rack-slot-70x40',
      widthMm: 70,
      heightMm: 40
    });
  });

  it('limits sample labels in the preview response contract', () => {
    expect(() =>
      warehouseLabelPreviewResponseSchema.parse({
        labelCount: 11,
        pageCount: 11,
        resolvedPreset: {
          id: 'rack-slot-100x50',
          widthMm: 100,
          heightMm: 50
        },
        resolvedLayout: {
          mode: 'single-label-page',
          pageWidthMm: 100,
          pageHeightMm: 50,
          labelsPerPage: 1
        },
        sampleLabels: Array.from({ length: 11 }, (_, index) => ({
          locationId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          address: `L-${index}`,
          barcodeValue: `L-${index}`
        })),
        warnings: []
      })
    ).toThrow();
  });
});
