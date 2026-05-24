import type { PickInstructionFormatInput, PickInstructionFormatResult } from './picking-run-types';

type PackagingLevel = {
  code: string;
  qtyEach: number;
};

function isValidLevel(level: unknown): level is PackagingLevel {
  if (!level || typeof level !== 'object') return false;
  const candidate = level as PackagingLevel;
  return (
    typeof candidate.code === 'string' &&
    candidate.code.length > 0 &&
    Number.isFinite(candidate.qtyEach) &&
    candidate.qtyEach > 0
  );
}

function formatRawUnits(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 units';
  const normalized = Number.isInteger(value) ? String(value) : String(value);
  return `${normalized} units`;
}

export function formatPickInstruction({
  qtyEach,
  packagingLevels
}: PickInstructionFormatInput): PickInstructionFormatResult {
  const rawQty = Number.isFinite(qtyEach) ? (qtyEach as number) : 0;
  if (rawQty <= 0) {
    return { instruction: '0 units', degraded: false };
  }

  // MVP policy: decimal each quantities are out of scope; never silently round/floor.
  if (!Number.isInteger(rawQty)) {
    return {
      instruction: formatRawUnits(rawQty),
      degraded: true,
      reason: 'non_integer_quantity'
    };
  }

  if (!Array.isArray(packagingLevels) || packagingLevels.length === 0) {
    return { instruction: `${rawQty} units`, degraded: false };
  }

  const validLevels = packagingLevels.filter(isValidLevel);
  if (validLevels.length === 0) {
    return {
      instruction: `${rawQty} units`,
      degraded: true,
      reason: 'invalid_packaging_levels'
    };
  }

  const groupsBySize = new Map<number, PackagingLevel[]>();
  for (const level of validLevels) {
    const group = groupsBySize.get(level.qtyEach) ?? [];
    group.push(level);
    groupsBySize.set(level.qtyEach, group);
  }

  for (const [, group] of groupsBySize) {
    if (group.length <= 1) continue;
    const signatures = new Set(
      group.map((level) => `${level.code}:${level.qtyEach}`)
    );
    if (signatures.size > 1 || group.length > 1) {
      return {
        instruction: `${rawQty} units`,
        degraded: true,
        reason: 'ambiguous_packaging'
      };
    }
  }

  const sortedLevels = [...validLevels].sort((left, right) => right.qtyEach - left.qtyEach);
  let remaining = rawQty;
  const parts: string[] = [];
  for (const level of sortedLevels) {
    if (level.qtyEach <= 1) continue;
    const count = Math.floor(remaining / level.qtyEach);
    if (count <= 0) continue;
    parts.push(`${count} ${level.code}`);
    remaining -= count * level.qtyEach;
  }

  if (parts.length === 0) {
    return { instruction: `${rawQty} units`, degraded: false };
  }

  if (remaining > 0) {
    parts.push(`${remaining} unit${remaining === 1 ? '' : 's'}`);
  }

  return {
    instruction: parts.join(' + '),
    degraded: false
  };
}
