import type { ProductPackagingLevel, ProductUnitProfile } from '@wos/domain';
import type {
  ReplaceProductPackagingLevelItem,
  UpsertProductUnitProfileBody
} from '@/entities/product/api/mutations';
import { derivePackagingHierarchy } from './packaging-hierarchy';

export type UnitProfileNumericField =
  | 'unitWeightG'
  | 'unitWidthMm'
  | 'unitHeightMm'
  | 'unitDepthMm';

export type UnitProfileDraft = {
  unitWeightG: string;
  unitWidthMm: string;
  unitHeightMm: string;
  unitDepthMm: string;
  weightClass: '' | 'light' | 'medium' | 'heavy' | 'very_heavy';
  sizeClass: '' | 'small' | 'medium' | 'large' | 'oversized';
};

export type UnitProfileValidationResult = {
  payload: UpsertProductUnitProfileBody | null;
  fieldErrors: Partial<Record<UnitProfileNumericField, string>>;
};

export type PackagingLevelDraft = {
  draftId: string;
  id: string | null;
  code: string;
  name: string;
  baseUnitQty: string;
  containedLevelDraftId: string | null;
  isBase: boolean;
  canPick: boolean;
  canStore: boolean;
  isDefaultPickUom: boolean;
  barcode: string;
  packWeightG: string;
  packWidthMm: string;
  packHeightMm: string;
  packDepthMm: string;
  isActive: boolean;
};

export type PackagingRowField =
  | 'code'
  | 'name'
  | 'baseUnitQty'
  | 'packWeightG'
  | 'packWidthMm'
  | 'packHeightMm'
  | 'packDepthMm';

export type PackagingValidationResult = {
  payload: ReplaceProductPackagingLevelItem[] | null;
  rowErrors: Record<string, Partial<Record<PackagingRowField, string>>>;
  sectionErrors: string[];
};

export type PackagingDraftResolvedQuantity = {
  localQty: number | null;
  canonicalBaseUnitQty: number | null;
  containedLevelDraftId: string | null;
  containedLevelLabel: string | null;
  error: string | null;
};

export function createUnitProfileDraft(profile: ProductUnitProfile | null | undefined): UnitProfileDraft {
  return {
    unitWeightG: profile?.unitWeightG?.toString() ?? '',
    unitWidthMm: profile?.unitWidthMm?.toString() ?? '',
    unitHeightMm: profile?.unitHeightMm?.toString() ?? '',
    unitDepthMm: profile?.unitDepthMm?.toString() ?? '',
    weightClass: profile?.weightClass ?? '',
    sizeClass: profile?.sizeClass ?? ''
  };
}

export function createPackagingLevelDraft(
  level: ProductPackagingLevel,
  index: number
): PackagingLevelDraft {
  return {
    draftId: `${level.id}-${index}`,
    id: level.id,
    code: level.code,
    name: level.name,
    baseUnitQty: level.isBase ? '1' : String(level.baseUnitQty),
    containedLevelDraftId: null,
    isBase: level.isBase,
    canPick: level.canPick,
    canStore: level.canStore,
    isDefaultPickUom: level.isDefaultPickUom,
    barcode: level.barcode ?? '',
    packWeightG: level.packWeightG?.toString() ?? '',
    packWidthMm: level.packWidthMm?.toString() ?? '',
    packHeightMm: level.packHeightMm?.toString() ?? '',
    packDepthMm: level.packDepthMm?.toString() ?? '',
    isActive: level.isActive
  };
}

export function createPackagingLevelDrafts(levels: ProductPackagingLevel[]): PackagingLevelDraft[] {
  const drafts = levels.map((level, index) => createPackagingLevelDraft(level, index));
  const draftByLevelId = new Map(drafts.map((draft) => [draft.id, draft]));
  const hierarchy = derivePackagingHierarchy(levels);

  return drafts.map((draft) => {
    if (draft.isBase || !draft.id) return draft;

    const entry = hierarchy.entries.find((candidate) => candidate.id === draft.id);
    const childDraft = entry?.nestedChildId ? draftByLevelId.get(entry.nestedChildId) : null;

    if (!entry?.nestedCount || !childDraft) {
      const baseDraft = drafts.find((candidate) => candidate.isBase) ?? null;
      return {
        ...draft,
        containedLevelDraftId: baseDraft?.draftId ?? null
      };
    }

    return {
      ...draft,
      baseUnitQty: String(entry.nestedCount),
      containedLevelDraftId: childDraft.draftId
    };
  });
}

export function createEmptyPackagingLevelDraft(draftId: string): PackagingLevelDraft {
  return {
    draftId,
    id: null,
    code: '',
    name: '',
    baseUnitQty: '1',
    containedLevelDraftId: null,
    isBase: false,
    canPick: true,
    canStore: true,
    isDefaultPickUom: false,
    barcode: '',
    packWeightG: '',
    packWidthMm: '',
    packHeightMm: '',
    packDepthMm: '',
    isActive: true
  };
}

function formatDraftLevelLabel(row: PackagingLevelDraft) {
  const code = row.code.trim();
  const name = row.name.trim();
  if (code && name) return `${name} (${code.toUpperCase()})`;
  if (name) return name;
  if (code) return code.toUpperCase();
  return 'Unnamed level';
}

function parsePositiveIntOrNull(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null, error: null };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { value: null, error: 'Must be a positive integer.' };
  }

  const numeric = Number(trimmed);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return { value: null, error: 'Must be a positive integer.' };
  }

  return { value: numeric, error: null };
}

function parseRequiredPositiveInt(value: string) {
  const parsed = parsePositiveIntOrNull(value);
  if (parsed.error) {
    return parsed;
  }
  if (parsed.value === null) {
    return { value: null, error: 'Required.' };
  }
  return parsed;
}

export function resolvePackagingDraftQuantities(rows: PackagingLevelDraft[]): Record<string, PackagingDraftResolvedQuantity> {
  const byId = new Map(rows.map((row) => [row.draftId, row]));
  const result: Record<string, PackagingDraftResolvedQuantity> = {};
  const visiting = new Set<string>();

  function resolve(row: PackagingLevelDraft): PackagingDraftResolvedQuantity {
    const cached = result[row.draftId];
    if (cached) return cached;

    const parsed = parseRequiredPositiveInt(row.baseUnitQty);
    const localQty = row.isBase ? 1 : parsed.value;
    const containedLevelDraftId = row.isBase ? null : row.containedLevelDraftId;

    if (parsed.error) {
      result[row.draftId] = {
        localQty,
        canonicalBaseUnitQty: null,
        containedLevelDraftId,
        containedLevelLabel: null,
        error: parsed.error
      };
      return result[row.draftId];
    }

    if (row.isBase) {
      result[row.draftId] = {
        localQty: 1,
        canonicalBaseUnitQty: 1,
        containedLevelDraftId: null,
        containedLevelLabel: null,
        error: null
      };
      return result[row.draftId];
    }

    if (!containedLevelDraftId) {
      result[row.draftId] = {
        localQty,
        canonicalBaseUnitQty: localQty,
        containedLevelDraftId: null,
        containedLevelLabel: null,
        error: null
      };
      return result[row.draftId];
    }

    const contained = byId.get(containedLevelDraftId);
    if (!contained) {
      result[row.draftId] = {
        localQty,
        canonicalBaseUnitQty: null,
        containedLevelDraftId,
        containedLevelLabel: null,
        error: 'Selected contained pack type is missing.'
      };
      return result[row.draftId];
    }

    if (contained.draftId === row.draftId) {
      result[row.draftId] = {
        localQty,
        canonicalBaseUnitQty: null,
        containedLevelDraftId,
        containedLevelLabel: formatDraftLevelLabel(contained),
        error: 'A pack type cannot contain itself.'
      };
      return result[row.draftId];
    }

    if (visiting.has(row.draftId)) {
      result[row.draftId] = {
        localQty,
        canonicalBaseUnitQty: null,
        containedLevelDraftId,
        containedLevelLabel: formatDraftLevelLabel(contained),
        error: 'Packaging containment cannot be circular.'
      };
      return result[row.draftId];
    }

    visiting.add(row.draftId);
    const containedQuantity = resolve(contained);
    visiting.delete(row.draftId);

    if (containedQuantity.error || containedQuantity.canonicalBaseUnitQty === null || localQty === null) {
      result[row.draftId] = {
        localQty,
        canonicalBaseUnitQty: null,
        containedLevelDraftId,
        containedLevelLabel: formatDraftLevelLabel(contained),
        error: containedQuantity.error ?? 'Contained pack type quantity is invalid.'
      };
      return result[row.draftId];
    }

    result[row.draftId] = {
      localQty,
      canonicalBaseUnitQty: localQty * containedQuantity.canonicalBaseUnitQty,
      containedLevelDraftId,
      containedLevelLabel: formatDraftLevelLabel(contained),
      error: null
    };
    return result[row.draftId];
  }

  rows.forEach(resolve);
  return result;
}

export function validateUnitProfileDraft(draft: UnitProfileDraft): UnitProfileValidationResult {
  const fieldErrors: Partial<Record<UnitProfileNumericField, string>> = {};

  const unitWeightG = parsePositiveIntOrNull(draft.unitWeightG);
  const unitWidthMm = parsePositiveIntOrNull(draft.unitWidthMm);
  const unitHeightMm = parsePositiveIntOrNull(draft.unitHeightMm);
  const unitDepthMm = parsePositiveIntOrNull(draft.unitDepthMm);

  if (unitWeightG.error) fieldErrors.unitWeightG = unitWeightG.error;
  if (unitWidthMm.error) fieldErrors.unitWidthMm = unitWidthMm.error;
  if (unitHeightMm.error) fieldErrors.unitHeightMm = unitHeightMm.error;
  if (unitDepthMm.error) fieldErrors.unitDepthMm = unitDepthMm.error;

  if (Object.keys(fieldErrors).length > 0) {
    return { payload: null, fieldErrors };
  }

  return {
    payload: {
      unitWeightG: unitWeightG.value,
      unitWidthMm: unitWidthMm.value,
      unitHeightMm: unitHeightMm.value,
      unitDepthMm: unitDepthMm.value,
      weightClass: draft.weightClass || null,
      sizeClass: draft.sizeClass || null
    },
    fieldErrors
  };
}

export function validatePackagingLevelsDraft(
  draftRows: PackagingLevelDraft[]
): PackagingValidationResult {
  const rowErrors: Record<string, Partial<Record<PackagingRowField, string>>> = {};
  const sectionErrors: string[] = [];
  const payload: ReplaceProductPackagingLevelItem[] = [];

  const normalizedCodes = new Map<string, string>();
  let baseCount = 0;
  let defaultPickCount = 0;
  const resolvedQuantities = resolvePackagingDraftQuantities(draftRows);

  draftRows.forEach((row, index) => {
    const errors: Partial<Record<PackagingRowField, string>> = {};
    const code = row.code.trim();
    const name = row.name.trim();
    const barcode = row.barcode.trim();

    if (!code) {
      errors.code = 'Required.';
    } else {
      const normalizedCode = code.toLowerCase();
      if (normalizedCodes.has(normalizedCode)) {
        errors.code = 'Code must be unique.';
      }
      normalizedCodes.set(normalizedCode, row.draftId);
    }

    if (!name) {
      errors.name = 'Required.';
    }

    const baseUnitQty = parseRequiredPositiveInt(row.baseUnitQty);
    if (baseUnitQty.error) {
      errors.baseUnitQty = baseUnitQty.error;
    }
    const resolvedQuantity = resolvedQuantities[row.draftId];
    if (resolvedQuantity?.error) {
      errors.baseUnitQty = resolvedQuantity.error;
    }

    const packWeightG = parsePositiveIntOrNull(row.packWeightG);
    if (packWeightG.error) {
      errors.packWeightG = packWeightG.error;
    }

    const packWidthMm = parsePositiveIntOrNull(row.packWidthMm);
    if (packWidthMm.error) {
      errors.packWidthMm = packWidthMm.error;
    }

    const packHeightMm = parsePositiveIntOrNull(row.packHeightMm);
    if (packHeightMm.error) {
      errors.packHeightMm = packHeightMm.error;
    }

    const packDepthMm = parsePositiveIntOrNull(row.packDepthMm);
    if (packDepthMm.error) {
      errors.packDepthMm = packDepthMm.error;
    }

    if (row.isBase) {
      baseCount += 1;
    }

    if (row.isDefaultPickUom) {
      defaultPickCount += 1;
      if (!row.isActive) {
        sectionErrors.push(`Row ${index + 1}: inactive level cannot be default pick.`);
      }
    }

    if (Object.keys(errors).length > 0) {
      rowErrors[row.draftId] = errors;
      return;
    }

    payload.push({
      ...(row.id ? { id: row.id } : {}),
      code,
      name,
      baseUnitQty: resolvedQuantity?.canonicalBaseUnitQty ?? (baseUnitQty.value as number),
      isBase: row.isBase,
      canPick: row.canPick,
      canStore: row.canStore,
      isDefaultPickUom: row.isDefaultPickUom,
      barcode: barcode.length > 0 ? barcode : null,
      packWeightG: packWeightG.value,
      packWidthMm: packWidthMm.value,
      packHeightMm: packHeightMm.value,
      packDepthMm: packDepthMm.value,
      sortOrder: index,
      isActive: row.isActive
    });
  });

  if (baseCount !== 1) {
    sectionErrors.push('Packaging levels must contain exactly one base row.');
  }

  if (defaultPickCount > 1) {
    sectionErrors.push('Packaging levels can contain at most one default pick row.');
  }

  if (Object.keys(rowErrors).length > 0 || sectionErrors.length > 0) {
    return {
      payload: null,
      rowErrors,
      sectionErrors
    };
  }

  return {
    payload,
    rowErrors: {},
    sectionErrors: []
  };
}

export function buildUnitProfileComparable(draft: UnitProfileDraft) {
  const validation = validateUnitProfileDraft(draft);
  if (!validation.payload) {
    return null;
  }
  return validation.payload;
}

export function buildPackagingLevelsComparable(rows: PackagingLevelDraft[]) {
  return rows.map((row, index) => ({
    id: row.id,
    code: row.code.trim(),
    name: row.name.trim(),
    baseUnitQty: row.baseUnitQty.trim(),
    containedLevelDraftId: row.containedLevelDraftId,
    isBase: row.isBase,
    canPick: row.canPick,
    canStore: row.canStore,
    isDefaultPickUom: row.isDefaultPickUom,
    barcode: row.barcode.trim(),
    packWeightG: row.packWeightG.trim(),
    packWidthMm: row.packWidthMm.trim(),
    packHeightMm: row.packHeightMm.trim(),
    packDepthMm: row.packDepthMm.trim(),
    sortOrder: index,
    isActive: row.isActive
  }));
}
