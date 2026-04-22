import type { UpsertProductUnitProfileBody } from '@/entities/product/api/mutations';
import type {
  buildPackagingLevelsComparable,
  buildUnitProfileComparable
} from '../ui/section-editing';

export type UnitProfileComparable = NonNullable<ReturnType<typeof buildUnitProfileComparable>>;
export type PackagingLevelsComparable = ReturnType<typeof buildPackagingLevelsComparable>;
export type PackagingLevelComparable = PackagingLevelsComparable[number];

export function equalUnitProfileComparable(
  a: UpsertProductUnitProfileBody,
  b: UpsertProductUnitProfileBody
) {
  return (
    a.unitWeightG === b.unitWeightG &&
    a.unitWidthMm === b.unitWidthMm &&
    a.unitHeightMm === b.unitHeightMm &&
    a.unitDepthMm === b.unitDepthMm &&
    a.weightClass === b.weightClass &&
    a.sizeClass === b.sizeClass
  );
}

export function equalPackagingLevelComparable(
  a: PackagingLevelComparable,
  b: PackagingLevelComparable
) {
  return (
    a.id === b.id &&
    a.code === b.code &&
    a.name === b.name &&
    a.baseUnitQty === b.baseUnitQty &&
    a.isBase === b.isBase &&
    a.canPick === b.canPick &&
    a.canStore === b.canStore &&
    a.isDefaultPickUom === b.isDefaultPickUom &&
    a.barcode === b.barcode &&
    a.packWeightG === b.packWeightG &&
    a.packWidthMm === b.packWidthMm &&
    a.packHeightMm === b.packHeightMm &&
    a.packDepthMm === b.packDepthMm &&
    a.sortOrder === b.sortOrder &&
    a.isActive === b.isActive
  );
}

export function equalPackagingLevelsComparable(
  a: PackagingLevelsComparable,
  b: PackagingLevelsComparable
) {
  if (a.length !== b.length) return false;

  return a.every((row, index) => {
    const other = b[index];
    if (!other) return false;
    return equalPackagingLevelComparable(row, other);
  });
}
