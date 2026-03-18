import { describe, expect, it } from 'vitest';
import { buildCellStructureKey, parseCellAddress } from '@wos/domain';
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

  // ── BUG A regression ────────────────────────────────────────────────────────
  //
  // After publish, create_layout_draft() copies the published layout into a new
  // draft but generates fresh gen_random_uuid() values for every rack, face,
  // section, and level row.  The published cells table still references the OLD
  // (published) UUIDs.  If EditorCanvas builds the lookup key from the DRAFT
  // rack tree (new UUIDs) instead of the PUBLISHED rack tree (old UUIDs), every
  // Map.get() call returns undefined → cellId = null → onClick is never
  // registered → Storage selection is permanently broken.
  //
  // Fix: EditorCanvas uses workspace.latestPublished (= same layout_version_id
  // as publishedCells) as the rack tree source when isPlacementMode = true.
  // Both sides of the lookup then share the same UUID space.

  it('returns undefined when lookup uses draft UUIDs instead of published UUIDs — the pre-fix identity mismatch', () => {
    const publishedCell = {
      id: 'physical-cell-uuid',
      cellCode: 'cell_abc123',
      layoutVersionId: 'D1-version-id',
      rackId: 'D1-rack-id',
      rackFaceId: 'D1-face-id',
      rackSectionId: 'D1-section-id',
      rackLevelId: 'D1-level-id',
      slotNo: 1,
      address: parseCellAddress('01-A.01.01.01'),
      status: 'active' as const
    };

    // Map is keyed by D1 UUIDs (from the published layout version)
    const lookup = indexPublishedCellsByStructure([publishedCell]);

    // Simulates what EditorCanvas did before the fix: it built the lookup key
    // from the active draft rack tree, which has D2 UUIDs because
    // create_layout_draft() generates new UUIDs for all structural entities.
    const result = lookup.get(
      buildCellStructureKey({
        rackId: 'D2-rack-id',       // fresh UUID from create_layout_draft
        rackFaceId: 'D2-face-id',   // fresh UUID from create_layout_draft
        rackSectionId: 'D2-section-id',
        rackLevelId: 'D2-level-id',
        slotNo: 1
      })
    );

    // cellId = undefined → null → onClick never registered → click does nothing
    expect(result).toBeUndefined();
  });

  it('resolves correctly when lookup uses the same published UUIDs as the cell map — the post-fix behaviour', () => {
    const publishedCell = {
      id: 'physical-cell-uuid',
      cellCode: 'cell_abc123',
      layoutVersionId: 'D1-version-id',
      rackId: 'D1-rack-id',
      rackFaceId: 'D1-face-id',
      rackSectionId: 'D1-section-id',
      rackLevelId: 'D1-level-id',
      slotNo: 1,
      address: parseCellAddress('01-A.01.01.01'),
      status: 'active' as const
    };

    // Map is keyed by D1 UUIDs (published layout version)
    const lookup = indexPublishedCellsByStructure([publishedCell]);

    // After the fix, EditorCanvas uses workspace.latestPublished (D1 rack tree)
    // in placement mode, so the lookup key is built from D1 UUIDs — matching the map.
    const result = lookup.get(
      buildCellStructureKey({
        rackId: 'D1-rack-id',
        rackFaceId: 'D1-face-id',
        rackSectionId: 'D1-section-id',
        rackLevelId: 'D1-level-id',
        slotNo: 1
      })
    );

    expect(result?.id).toBe('physical-cell-uuid');
  });
});
