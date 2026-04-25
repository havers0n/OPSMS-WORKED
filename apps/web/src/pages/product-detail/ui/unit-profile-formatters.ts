import type { ProductPackagingLevel, ProductUnitProfile } from '@wos/domain';

export function formatNullable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 'Not defined';
  return String(value);
}

export function formatClassName(value: string | null | undefined) {
  if (!value) return 'Not defined';
  return value.replace(/_/g, ' ');
}

export function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Not defined';
  return `${value} g`;
}

export function formatDimensions(args: {
  widthMm: number | null | undefined;
  heightMm: number | null | undefined;
  depthMm: number | null | undefined;
}) {
  if (args.widthMm === null || args.widthMm === undefined) return 'Not defined';
  if (args.heightMm === null || args.heightMm === undefined) return 'Not defined';
  if (args.depthMm === null || args.depthMm === undefined) return 'Not defined';
  return `${args.widthMm} x ${args.heightMm} x ${args.depthMm} mm`;
}

export function formatLevelName(level: Pick<ProductPackagingLevel, 'code' | 'name'>) {
  const name = level.name.trim();
  const code = level.code.trim().toUpperCase();

  if (name && code) return `${name} (${code})`;
  return name || code || 'Unnamed level';
}

export function getUnitProfileWarnings(args: {
  unitProfile: ProductUnitProfile | null | undefined;
  packagingLevels: ProductPackagingLevel[];
  storagePresetCount: number;
}) {
  const warnings: string[] = [];

  if (!args.unitProfile || args.unitProfile.unitWeightG === null) {
    warnings.push('Missing weight');
  }

  if (
    !args.unitProfile ||
    args.unitProfile.unitWidthMm === null ||
    args.unitProfile.unitHeightMm === null ||
    args.unitProfile.unitDepthMm === null
  ) {
    warnings.push('Missing dimensions');
  }

  if (!args.packagingLevels.some((level) => level.isActive)) {
    warnings.push('No active packaging levels');
  }

  if (args.storagePresetCount === 0) {
    warnings.push('No storage presets');
  }

  return warnings;
}
