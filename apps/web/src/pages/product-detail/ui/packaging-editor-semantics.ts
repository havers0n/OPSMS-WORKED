import type { ProductPackagingLevel } from '@wos/domain';
import type { PackagingLevelDraft } from './section-editing';
import { derivePackagingHierarchy } from './packaging-hierarchy';

export type PackagingEditorRowSemantics = {
  draftId: string;
  quantityInputValue: string;
  quantityInputDisabled: boolean;
  equivalentLine: string;
  containmentLine: string | null;
  fallbackLine: string | null;
  quantityHelperLine: string | null;
  cueLabel: string;
  cueIndent: number;
};

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const numeric = Number(trimmed);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;

  return numeric;
}

function toSyntheticLevel(row: PackagingLevelDraft, index: number): ProductPackagingLevel {
  const normalizedQty = row.isBase ? 1 : parsePositiveInt(row.baseUnitQty);

  return {
    id: row.draftId,
    productId: 'editor-draft',
    code: row.code,
    name: row.name,
    baseUnitQty: normalizedQty ?? Number.NaN,
    isBase: row.isBase,
    canPick: row.canPick,
    canStore: row.canStore,
    isDefaultPickUom: row.isDefaultPickUom,
    barcode: row.barcode.trim().length > 0 ? row.barcode.trim() : null,
    packWeightG: null,
    packWidthMm: null,
    packHeightMm: null,
    packDepthMm: null,
    sortOrder: index,
    isActive: row.isActive,
    createdAt: '',
    updatedAt: ''
  };
}

export function derivePackagingEditorSemantics(rows: PackagingLevelDraft[]): Record<string, PackagingEditorRowSemantics> {
  const hierarchy = derivePackagingHierarchy(rows.map((row, index) => toSyntheticLevel(row, index)));
  const hierarchyEntries = new Map(hierarchy.entries.map((entry) => [entry.id, entry]));

  return rows.reduce<Record<string, PackagingEditorRowSemantics>>((result, row) => {
    const normalizedQtyValue = row.isBase ? '1' : row.baseUnitQty;
    const parsedQty = row.isBase ? 1 : parsePositiveInt(normalizedQtyValue);
    const hierarchyEntry = hierarchyEntries.get(row.draftId);

    if (row.isBase) {
      result[row.draftId] = {
        draftId: row.draftId,
        quantityInputValue: '1',
        quantityInputDisabled: true,
        equivalentLine: 'Contains exactly 1 single unit',
        containmentLine: null,
        fallbackLine: null,
        quantityHelperLine: 'Base unit is always 1 single unit.',
        cueLabel: 'Base unit level',
        cueIndent: 0
      };
      return result;
    }

    const containmentLine =
      hierarchyEntry?.nestedChildLabel && hierarchyEntry.nestedCount
        ? `Contains ${hierarchyEntry.nestedCount} x ${hierarchyEntry.nestedChildLabel}`
        : null;

    const fallbackLine =
      parsedQty !== null && containmentLine === null && rows.length > 1
        ? 'No clean nested relation inferred'
        : null;

    result[row.draftId] = {
      draftId: row.draftId,
      quantityInputValue: normalizedQtyValue,
      quantityInputDisabled: false,
      equivalentLine:
        parsedQty !== null
          ? `Equivalent to ${parsedQty} single units`
          : 'Enter a positive integer to define contained single units',
      containmentLine,
      fallbackLine,
      quantityHelperLine: null,
      cueLabel: 'Additional pack type',
      cueIndent: hierarchyEntry?.indent ?? 0
    };

    return result;
  }, {});
}
