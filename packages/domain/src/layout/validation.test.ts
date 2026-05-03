import { describe, expect, it } from 'vitest';
import { layoutPublishRequestSchema } from './validation';

describe('layoutPublishRequestSchema', () => {
  it('accepts publish requests without rename mappings', () => {
    expect(layoutPublishRequestSchema.parse({ expectedDraftVersion: 7 })).toEqual({
      expectedDraftVersion: 7
    });
  });

  it('accepts explicit rename mappings and trims codes', () => {
    expect(
      layoutPublishRequestSchema.parse({
        expectedDraftVersion: 7,
        renameMappings: [{ oldCode: ' 03-A.01.01.01 ', newCode: ' 03-A.01.01.02 ' }]
      })
    ).toEqual({
      expectedDraftVersion: 7,
      renameMappings: [{ oldCode: '03-A.01.01.01', newCode: '03-A.01.01.02' }]
    });
  });

  it('rejects blank rename mapping codes', () => {
    expect(() =>
      layoutPublishRequestSchema.parse({
        expectedDraftVersion: 7,
        renameMappings: [{ oldCode: ' ', newCode: '03-A.01.01.02' }]
      })
    ).toThrow();
  });
});
