import type { ProductPackagingLevel } from '@wos/domain';

export type PackagingHierarchyEntry = {
  id: string;
  code: string;
  name: string;
  baseUnitQty: number;
  isActive: boolean;
  isBase: boolean;
  isReferenceRoot: boolean;
  nestedChildId: string | null;
  nestedChildLabel: string | null;
  nestedCount: number | null;
  indent: number;
  hint: string | null;
};

export type PackagingHierarchy = {
  entries: PackagingHierarchyEntry[];
  activeCount: number;
  inactiveCount: number;
  hasCleanChain: boolean;
  hasImperfectChain: boolean;
  hasParallelActiveLevels: boolean;
  hasBaseReference: boolean;
  topMessage: string;
};

type NormalizedLevel = {
  id: string;
  code: string;
  name: string;
  baseUnitQty: number;
  isActive: boolean;
  isBase: boolean;
  sortOrder: number;
};

function sortLevels(levels: NormalizedLevel[]) {
  return [...levels].sort((left, right) => {
    if (left.baseUnitQty !== right.baseUnitQty) {
      return left.baseUnitQty - right.baseUnitQty;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.code.localeCompare(right.code);
  });
}

function toNormalizedLevel(level: ProductPackagingLevel): NormalizedLevel | null {
  if (!Number.isInteger(level.baseUnitQty) || level.baseUnitQty < 1) {
    return null;
  }

  return {
    id: level.id,
    code: level.code,
    name: level.name,
    baseUnitQty: level.baseUnitQty,
    isActive: level.isActive,
    isBase: level.isBase,
    sortOrder: level.sortOrder
  };
}

function buildQtyCounts(levels: NormalizedLevel[]) {
  const counts = new Map<number, number>();

  levels.forEach((level) => {
    counts.set(level.baseUnitQty, (counts.get(level.baseUnitQty) ?? 0) + 1);
  });

  return counts;
}

function formatLevelLabel(level: NormalizedLevel) {
  return level.name.trim().length > 0 ? level.name : level.code;
}

export function derivePackagingHierarchy(levels: ProductPackagingLevel[]): PackagingHierarchy {
  const normalized = levels
    .map(toNormalizedLevel)
    .filter((level): level is NormalizedLevel => level !== null);

  const activeLevels = sortLevels(normalized.filter((level) => level.isActive));
  const activeQtyCounts = buildQtyCounts(activeLevels);
  const hasParallelActiveLevels = [...activeQtyCounts.values()].some((count) => count > 1);

  const baseCandidates = sortLevels(normalized.filter((level) => level.isBase));
  const baseReference = baseCandidates[0] ?? null;

  const orderedSummaryLevels = baseReference
    ? [baseReference, ...activeLevels.filter((level) => level.id !== baseReference.id)]
    : activeLevels;

  const relationByLevelId = new Map<
    string,
    {
      childId: string;
      childLabel: string;
      count: number;
    }
  >();
  const indentByLevelId = new Map<string, number>();

  activeLevels.forEach((level, index) => {
    if (index === 0) {
      indentByLevelId.set(level.id, 0);
      return;
    }

    const nextSmaller = activeLevels[index - 1];
    const canNest =
      level.baseUnitQty > nextSmaller.baseUnitQty &&
      level.baseUnitQty % nextSmaller.baseUnitQty === 0 &&
      (activeQtyCounts.get(level.baseUnitQty) ?? 0) === 1 &&
      (activeQtyCounts.get(nextSmaller.baseUnitQty) ?? 0) === 1;

    if (canNest) {
      relationByLevelId.set(level.id, {
        childId: nextSmaller.id,
        childLabel: formatLevelLabel(nextSmaller),
        count: level.baseUnitQty / nextSmaller.baseUnitQty
      });
      indentByLevelId.set(level.id, (indentByLevelId.get(nextSmaller.id) ?? 0) + 1);
      return;
    }

    indentByLevelId.set(level.id, 0);
  });

  const entries = orderedSummaryLevels.map<PackagingHierarchyEntry>((level) => {
    const relation = relationByLevelId.get(level.id) ?? null;
    const isReferenceRoot = Boolean(baseReference && level.id === baseReference.id);
    const duplicatedQty = (activeQtyCounts.get(level.baseUnitQty) ?? 0) > 1;

    let hint: string | null = null;

    if (duplicatedQty) {
      hint = 'Parallel level: same unit quantity as another active level.';
    } else if (level.isActive && !relation && activeLevels.length > 1 && activeLevels[0]?.id !== level.id) {
      hint = 'No clean nested relation inferred.';
    }

    if (isReferenceRoot && !level.isActive) {
      hint = 'Base reference level is inactive; shown as root reference only.';
    }

    return {
      id: level.id,
      code: level.code,
      name: level.name,
      baseUnitQty: level.baseUnitQty,
      isActive: level.isActive,
      isBase: level.isBase,
      isReferenceRoot,
      nestedChildId: relation?.childId ?? null,
      nestedChildLabel: relation?.childLabel ?? null,
      nestedCount: relation?.count ?? null,
      indent: indentByLevelId.get(level.id) ?? 0,
      hint
    };
  });

  const activeRelationCount = activeLevels
    .slice(1)
    .filter((level) => relationByLevelId.has(level.id)).length;

  const hasCleanChain = activeLevels.length <= 1 || activeRelationCount === activeLevels.length - 1;
  const hasImperfectChain = activeLevels.length > 1 && !hasCleanChain;

  const topMessage =
    activeLevels.length === 0
      ? 'No active packaging levels available.'
      : activeLevels.length === 1
        ? activeLevels[0].isBase
          ? 'Only base packaging level configured.'
          : 'Only one active packaging level configured.'
        : hasCleanChain
          ? 'Clean nested chain inferred from active levels.'
          : 'Partial hierarchy shown where arithmetic relation is valid.';

  return {
    entries,
    activeCount: activeLevels.length,
    inactiveCount: normalized.length - activeLevels.length,
    hasCleanChain,
    hasImperfectChain,
    hasParallelActiveLevels,
    hasBaseReference: baseReference !== null,
    topMessage
  };
}
