import { describe, expect, it } from 'vitest';
import { locationReferenceSchema } from './location-reference';

describe('locationReferenceSchema', () => {
  it('accepts canonical geometry-backed location identity', () => {
    expect(
      locationReferenceSchema.parse({
        locationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
        locationCode: 'A-01-01',
        locationType: 'rack_slot',
        cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      })
    ).toEqual({
      locationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      locationCode: 'A-01-01',
      locationType: 'rack_slot',
      cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
    });
  });
});
