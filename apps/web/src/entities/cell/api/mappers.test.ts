import { describe, expect, it } from 'vitest';
import { mapCellRowToDomain, type CellRow } from './mappers';

describe('mapCellRowToDomain', () => {
  it('keeps persisted cellCode semantics for published cell rows', () => {
    const row: CellRow = {
      id: '4d3c9f52-f2ba-45bf-bf6f-b340bd7ed41f',
      layout_version_id: '3dbf2a90-b1cb-42f0-afec-57f436a22f5d',
      rack_id: 'f38510b5-d5c5-4657-8d7e-a4154cb74951',
      rack_face_id: 'c4873dd5-bb30-48b9-9558-4effcab5cf8d',
      rack_section_id: 'd208453f-555a-40d0-b4bf-f1e6a93a7752',
      rack_level_id: '342d905f-2a71-4812-828f-4b0d1acc4a53',
      slot_no: 1,
      address: '03-A.01.01.01',
      address_sort_key: '0003-A-01-01-01',
      cell_code: 'cell_0123456789abcdef01234567',
      status: 'active',
      x: null,
      y: null,
      created_at: '2026-03-13T10:00:00.000Z',
      updated_at: '2026-03-13T10:00:00.000Z'
    };

    expect(mapCellRowToDomain(row)).toMatchObject({
      cellCode: 'cell_0123456789abcdef01234567',
      address: {
        raw: '03-A.01.01.01'
      }
    });
  });
});
