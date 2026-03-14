import { describe, expect, it } from 'vitest';
import { parseCellAddress } from '@wos/domain';
import {
  indexPublishedCellsByStructure,
  resolvePublishedCellForPreviewCell
} from './published-cell-lookup';

describe('published cell lookup', () => {
  it('maps a preview cell deterministically to its published physical cell', () => {
    const published = {
      id: 'physical-cell-uuid',
      cellCode: 'cell-code',
      layoutVersionId: 'layout-uuid',
      rackId: 'rack-uuid',
      rackFaceId: 'face-uuid',
      rackSectionId: 'section-uuid',
      rackLevelId: 'level-uuid',
      slotNo: 2,
      address: parseCellAddress('03-A.01.02.02'),
      status: 'active' as const
    };

    const preview = {
      id: 'preview-cell-id',
      previewCellKey: 'preview-key',
      layoutVersionId: 'layout-uuid',
      rackId: 'rack-uuid',
      rackFaceId: 'face-uuid',
      rackSectionId: 'section-uuid',
      rackLevelId: 'level-uuid',
      slotNo: 2,
      address: parseCellAddress('03-A.01.02.02'),
      status: 'active' as const
    };

    const lookup = indexPublishedCellsByStructure([published]);
    expect(resolvePublishedCellForPreviewCell(preview, lookup)?.id).toBe('physical-cell-uuid');
  });
});
