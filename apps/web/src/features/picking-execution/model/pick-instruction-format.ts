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

export function formatPickInstruction({
  qtyEach,
  packagingLevels
}: PickInstructionFormatInput): PickInstructionFormatResult {
  const safeQty = Number.isFinite(qtyEach) ? Math.max(0, Math.floor(qtyEach as number)) : 0;
  if (safeQty <= 0) {
    return { instruction: '0 units', degraded: false };
  }

  if (!Array.isArray(packagingLevels) || packagingLevels.length === 0) {
    return { instruction: `${safeQty} units`, degraded: false };
  }

  const validLevels = packagingLevels.filter(isValidLevel);
  if (validLevels.length === 0) {
    return { instruction: `${safeQty} units`, degraded: true };
  }

  const sortedLevels = [...validLevels].sort((left, right) => right.qtyEach - left.qtyEach);
  const duplicatesBySize = new Set<number>();
  const sizeCounts = new Map<number, number>();
  for (const level of sortedLevels) {
    sizeCounts.set(level.qtyEach, (sizeCounts.get(level.qtyEach) ?? 0) + 1);
  }
  for (const [size, count] of sizeCounts) {
    if (count > 1) duplicatesBySize.add(size);
  }

  let remaining = safeQty;
  const parts: string[] = [];
  for (const level of sortedLevels) {
    if (level.qtyEach <= 1) continue;
    const count = Math.floor(remaining / level.qtyEach);
    if (count <= 0) continue;
    parts.push(`${count} ${level.code}`);
    remaining -= count * level.qtyEach;
  }

  if (parts.length === 0) {
    return { instruction: `${safeQty} units`, degraded: duplicatesBySize.size > 0 };
  }

  if (remaining > 0) {
    parts.push(`${remaining} each`);
  }

  return {
    instruction: parts.join(' + '),
    degraded: duplicatesBySize.size > 0
  };
}
