import { z } from 'zod';

export const classificationConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type ClassificationConfidence = z.infer<typeof classificationConfidenceSchema>;

export const routeGroupKindSchema = z.enum([
  'general',
  'standalone',
  'derived-from-non-category-suffix',
  'low-confidence'
]);
export type RouteGroupKind = z.infer<typeof routeGroupKindSchema>;

export const workBucketKindSchema = z.enum([
  'general',
  'category',
  'standalone-general',
  'unknown'
]);
export type WorkBucketKind = z.infer<typeof workBucketKindSchema>;

export type CategorySuffixPattern = {
  kind: 'exact' | 'prefix';
  value: string;
};

export type RouteFragmentInput = {
  orderNumber: string;
  customerName?: string | null;
  rawRouteLine: string | null;
  routeBase: string | null;
  workBucketName: string | null;
  pointName?: string | null;
};

export type ClassifiedRouteFragment = RouteFragmentInput & {
  routeGroupName: string;
  routeGroupKey: string;
  // @deprecated — use distributionGroup* / workGroup* aliases
  distributionGroupName: string;
  distributionGroupKey: string;
  workBucketDisplayName: string;
  workBucketKey: string;
  workGroupDisplayName: string;
  workGroupKey: string;
  routeGroupKind: RouteGroupKind;
  workBucketKind: WorkBucketKind;
  classificationReason: string;
  classificationConfidence: ClassificationConfidence;
};

export const DEFAULT_CATEGORY_SUFFIXES: CategorySuffixPattern[] = [
  { kind: 'exact', value: 'סלולר' },
  { kind: 'prefix', value: 'סלולר-' },
  { kind: 'exact', value: 'רכב' },
  { kind: 'prefix', value: 'רכב-' },
  { kind: 'exact', value: 'סיגריות' },
  { kind: 'prefix', value: 'סיגריות-' },
];

const GROUP_SEPARATOR = '\u0001';

function groupKey(f: RouteFragmentInput): string {
  return `${f.orderNumber ?? ''}${GROUP_SEPARATOR}${f.routeBase ?? ''}`;
}

function makeRouteGroupKey(routeGroupName: string): string {
  return `rg${GROUP_SEPARATOR}${routeGroupName}`;
}

function makeWorkBucketKey(routeGroupName: string, workBucketDisplayName: string): string {
  return `wb${GROUP_SEPARATOR}${routeGroupName}${GROUP_SEPARATOR}${workBucketDisplayName}`;
}

export function isCategorySuffix(
  suffix: string,
  patterns: CategorySuffixPattern[]
): boolean {
  return patterns.some((p) => {
    if (p.kind === 'exact') return suffix === p.value;
    if (p.kind === 'prefix') return suffix.startsWith(p.value);
    return false;
  });
}

type ClassificationOverrides = {
  routeGroupName: string;
  workBucketDisplayName: string;
  routeGroupKind: RouteGroupKind;
  workBucketKind: WorkBucketKind;
  classificationConfidence: ClassificationConfidence;
  classificationReason: string;
};

function buildResult(
  fragment: RouteFragmentInput,
  overrides: ClassificationOverrides
): ClassifiedRouteFragment {
  return {
    orderNumber: fragment.orderNumber ?? '',
    customerName: fragment.customerName ?? null,
    rawRouteLine: fragment.rawRouteLine ?? null,
    routeBase: fragment.routeBase ?? null,
    workBucketName: fragment.workBucketName ?? null,
    pointName: fragment.pointName ?? null,
    ...overrides,
    routeGroupKey: makeRouteGroupKey(overrides.routeGroupName),
    distributionGroupKey: makeRouteGroupKey(overrides.routeGroupName),
    distributionGroupName: overrides.routeGroupName,
    workBucketKey: makeWorkBucketKey(overrides.routeGroupName, overrides.workBucketDisplayName),
    workGroupKey: makeWorkBucketKey(overrides.routeGroupName, overrides.workBucketDisplayName),
    workGroupDisplayName: overrides.workBucketDisplayName,
  };
}

type CategorizedFragment = {
  fragment: RouteFragmentInput;
  suffix: string;
};

function classifySingleGroup(
  fragments: RouteFragmentInput[],
  categorySuffixes: CategorySuffixPattern[]
): ClassifiedRouteFragment[] {
  const routeBase = fragments[0]?.routeBase ?? null;
  const baseFragments: RouteFragmentInput[] = [];
  const catFragments: CategorizedFragment[] = [];
  const standaloneFragments: CategorizedFragment[] = [];

  for (const f of fragments) {
    if (f.workBucketName === null) {
      baseFragments.push(f);
    } else if (isCategorySuffix(f.workBucketName, categorySuffixes)) {
      catFragments.push({ fragment: f, suffix: f.workBucketName });
    } else {
      standaloneFragments.push({ fragment: f, suffix: f.workBucketName });
    }
  }

  const hasBase = baseFragments.length > 0;
  const hasCat = catFragments.length > 0;
  const hasStandalone = standaloneFragments.length > 0;
  const baseRouteLabel = routeBase ?? '';

  // Rule 1 — bare base route fragments only
  if (hasBase && !hasCat && !hasStandalone) {
    return baseFragments.map((f) =>
      buildResult(f, {
        routeGroupName: `${baseRouteLabel} כללי`,
        workBucketDisplayName: 'כללי',
        routeGroupKind: 'general',
        workBucketKind: 'general',
        classificationConfidence: 'high',
        classificationReason: 'base route without slash suffixes',
      })
    );
  }

  // Rule 2 — base route present, at least one suffix sibling
  if (hasBase) {
    const results: ClassifiedRouteFragment[] = baseFragments.map((f) =>
      buildResult(f, {
        routeGroupName: `${baseRouteLabel} כללי`,
        workBucketDisplayName: 'כללי',
        routeGroupKind: 'general',
        workBucketKind: 'general',
        classificationConfidence: 'high',
        classificationReason: 'base route with work bucket siblings',
      })
    );

    for (const { fragment: f, suffix } of catFragments) {
      results.push(
        buildResult(f, {
          routeGroupName: `${baseRouteLabel} כללי`,
          workBucketDisplayName: suffix,
          routeGroupKind: 'general',
          workBucketKind: 'category',
          classificationConfidence: 'high',
          classificationReason: 'category suffix with base route sibling',
        })
      );
    }

    for (const { fragment: f, suffix } of standaloneFragments) {
      results.push(
        buildResult(f, {
          routeGroupName: `${baseRouteLabel} כללי`,
          workBucketDisplayName: suffix,
          routeGroupKind: 'general',
          workBucketKind: 'general',
          classificationConfidence: 'high',
          classificationReason: 'standalone suffix with base route sibling',
        })
      );
    }

    return results;
  }

  // No base route cases below

  // Rule 3 — single standalone suffix, no category siblings
  if (!hasBase && standaloneFragments.length === 1 && !hasCat) {
    const { fragment: f, suffix } = standaloneFragments[0];
    return [
      buildResult(f, {
        routeGroupName: suffix,
        workBucketDisplayName: 'כללי',
        routeGroupKind: 'standalone',
        workBucketKind: 'standalone-general',
        classificationConfidence: 'high',
        classificationReason: 'standalone delivery group without category siblings',
      }),
    ];
  }

  // Rule 4 — single standalone suffix with category siblings, no base
  if (!hasBase && standaloneFragments.length === 1 && hasCat) {
    const { fragment: nonCatFrag, suffix: groupName } = standaloneFragments[0];
    const results: ClassifiedRouteFragment[] = [
      buildResult(nonCatFrag, {
        routeGroupName: groupName,
        workBucketDisplayName: 'כללי',
        routeGroupKind: 'derived-from-non-category-suffix',
        workBucketKind: 'standalone-general',
        classificationConfidence: 'high',
        classificationReason: 'non-category suffix defines route group, with category siblings',
      }),
    ];

    for (const { fragment: f, suffix } of catFragments) {
      results.push(
        buildResult(f, {
          routeGroupName: groupName,
          workBucketDisplayName: suffix,
          routeGroupKind: 'general',
          workBucketKind: 'category',
          classificationConfidence: 'high',
          classificationReason: 'category suffix within route group derived from non-category sibling',
        })
      );
    }

    return results;
  }

  // Rule 5 — category-only, no base, no standalone sibling context
  if (!hasBase && !hasStandalone && hasCat) {
    return catFragments.map(({ fragment: f, suffix }) =>
      buildResult(f, {
        routeGroupName: `${baseRouteLabel} כללי`,
        workBucketDisplayName: suffix,
        routeGroupKind: 'low-confidence',
        workBucketKind: 'unknown',
        classificationConfidence: 'low',
        classificationReason:
          'category-like suffix without base route or standalone sibling context',
      })
    );
  }

  // Edge: multiple standalone suffixes, no base, no categories
  if (!hasBase && standaloneFragments.length > 1 && !hasCat) {
    return standaloneFragments.map(({ fragment: f, suffix }) =>
      buildResult(f, {
        routeGroupName: `${baseRouteLabel} כללי`,
        workBucketDisplayName: suffix,
        routeGroupKind: 'low-confidence',
        workBucketKind: 'unknown',
        classificationConfidence: 'low',
        classificationReason:
          'multiple standalone suffixes without base route or category context',
      })
    );
  }

  // Edge: multiple standalone suffixes + category suffixes, no base
  if (!hasBase && standaloneFragments.length > 1 && hasCat) {
    return [
      ...standaloneFragments.map(({ fragment: f, suffix }) =>
        buildResult(f, {
          routeGroupName: `${baseRouteLabel} כללי`,
          workBucketDisplayName: suffix,
          routeGroupKind: 'low-confidence',
          workBucketKind: 'unknown',
          classificationConfidence: 'low',
          classificationReason:
            'multiple standalone suffixes with category siblings, ambiguous route group',
        })
      ),
      ...catFragments.map(({ fragment: f, suffix }) =>
        buildResult(f, {
          routeGroupName: `${baseRouteLabel} כללי`,
          workBucketDisplayName: suffix,
          routeGroupKind: 'low-confidence',
          workBucketKind: 'unknown',
          classificationConfidence: 'low',
          classificationReason:
            'category suffix with ambiguous non-category siblings',
        })
      ),
    ];
  }

  // Fallback: unexpected
  return fragments.map((f) =>
    buildResult(f, {
      routeGroupName: baseRouteLabel || String(f.rawRouteLine ?? ''),
      workBucketDisplayName: f.workBucketName ?? 'כללי',
      routeGroupKind: 'low-confidence',
      workBucketKind: 'unknown',
      classificationConfidence: 'low',
      classificationReason: 'unable to classify — unexpected fragment combination',
    })
  );
}

export function classifyRouteFragments(
  fragments: RouteFragmentInput[],
  options?: { categorySuffixes?: CategorySuffixPattern[] }
): ClassifiedRouteFragment[] {
  const categorySuffixes = options?.categorySuffixes ?? DEFAULT_CATEGORY_SUFFIXES;
  const groups = new Map<string, { fragments: RouteFragmentInput[]; firstIndex: number }>();
  const orderMap = new Map<string, number>();

  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    const key = groupKey(f);
    const entry = groups.get(key);
    if (entry) {
      entry.fragments.push(f);
    } else {
      groups.set(key, { fragments: [f], firstIndex: i });
    }
  }

  const sortedKeys = Array.from(groups.entries()).sort(
    (a, b) => a[1].firstIndex - b[1].firstIndex
  );

  const results: ClassifiedRouteFragment[] = [];
  for (const [, { fragments: groupFragments }] of sortedKeys) {
    const classified = classifySingleGroup(groupFragments, categorySuffixes);
    results.push(...classified);
  }

  return results;
}
