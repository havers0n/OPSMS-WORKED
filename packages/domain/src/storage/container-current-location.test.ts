import { describe, expect, it } from 'vitest';
import { containerCurrentLocationSchema } from './container-current-location';

describe('containerCurrentLocationSchema', () => {
  it('accepts a rack-backed canonical current location', () => {
    expect(containerCurrentLocationSchema.parse({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      currentLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      locationCode: '03-A.01.02.01',
      locationType: 'rack_slot',
      cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
    })).toMatchObject({
      locationType: 'rack_slot'
    });
  });

  it('accepts an explicit unset current location', () => {
    expect(containerCurrentLocationSchema.parse({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      currentLocationId: null,
      locationCode: null,
      locationType: null,
      cellId: null
    }).currentLocationId).toBeNull();
  });
});
