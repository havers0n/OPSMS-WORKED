import type { ProductPackagingLevel } from '@wos/domain';
import { derivePackagingHierarchy } from './packaging-hierarchy';
import { resolvePackagingDraftQuantities, type PackagingLevelDraft } from './section-editing';

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
  canonicalBaseUnitQty: number | null;
};

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const numeric = Number(trimmed);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;

  return numeric;
}

function toSyntheticLevel(row: PackagingLevelDraft, index: number, canonicalBaseUnitQty: number | null): ProductPackagingLevel {
  return {
    id: row.draftId,
    productId: 'editor-draft',
    code: row.code,
    name: row.name,
    baseUnitQty: canonicalBaseUnitQty ?? Number.NaN,
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
  const resolvedQuantities = resolvePackagingDraftQuantities(rows);
  const hierarchy = derivePackagingHierarchy(
    rows.map((row, index) => toSyntheticLevel(row, index, resolvedQuantities[row.draftId]?.canonicalBaseUnitQty ?? null))
  );
  const hierarchyEntries = new Map(hierarchy.entries.map((entry) => [entry.id, entry]));

  return rows.reduce<Record<string, PackagingEditorRowSemantics>>((result, row) => {
    const normalizedQtyValue = row.isBase ? '1' : row.baseUnitQty;
    const parsedQty = row.isBase ? 1 : parsePositiveInt(normalizedQtyValue);
    const resolvedQuantity = resolvedQuantities[row.draftId];
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
        cueIndent: 0,
        canonicalBaseUnitQty: 1
      };
      return result;
    }

    const containmentLine = resolvedQuantity?.containedLevelLabel
      ? `Contains ${parsedQty ?? '?'} x ${resolvedQuantity.containedLevelLabel}`
      : hierarchyEntry?.nestedChildLabel && hierarchyEntry.nestedCount
        ? `Contains ${hierarchyEntry.nestedCount} x ${hierarchyEntry.nestedChildLabel}`
        : null;

    const fallbackLine =
      resolvedQuantity?.error ??
      (parsedQty !== null && containmentLine === null && rows.length > 1
        ? 'No clean nested relation inferred'
        : null);

    result[row.draftId] = {
      draftId: row.draftId,
      quantityInputValue: normalizedQtyValue,
      quantityInputDisabled: false,
      equivalentLine:
        resolvedQuantity?.canonicalBaseUnitQty !== null && resolvedQuantity?.canonicalBaseUnitQty !== undefined
          ? `Equivalent to ${resolvedQuantity.canonicalBaseUnitQty} single units`
          : 'Enter a positive integer to define contained single units',
      containmentLine,
      fallbackLine,
      quantityHelperLine: resolvedQuantity?.containedLevelLabel
        ? `Quantity is counted in ${resolvedQuantity.containedLevelLabel}.`
        : null,
      cueLabel: 'Additional pack type',
      cueIndent: hierarchyEntry?.indent ?? 0,
      canonicalBaseUnitQty: resolvedQuantity?.canonicalBaseUnitQty ?? null
    };

    return result;
  }, {});
}
