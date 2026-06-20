import { describe, expect, it } from 'vitest';
import {
  classifyRouteFragments,
  type ClassifiedRouteFragment,
  type RouteFragmentInput,
} from './manual-shift-route-classification';

type ExpectedFragment = {
  orderNumber: string;
  routeBase: string | null;
  workBucketName: string | null;
  routeGroupName: string;
  workBucketDisplayName: string;
  routeGroupKind: string;
  workBucketKind: string;
  classificationConfidence: string;
};

function expectFragment(
  result: ClassifiedRouteFragment,
  expected: ExpectedFragment
): void {
  expect(result.orderNumber).toBe(expected.orderNumber);
  expect(result.routeBase).toBe(expected.routeBase);
  expect(result.workBucketName).toBe(expected.workBucketName);
  expect(result.routeGroupName).toBe(expected.routeGroupName);
  expect(result.workBucketDisplayName).toBe(expected.workBucketDisplayName);
  expect(result.routeGroupKind).toBe(expected.routeGroupKind);
  expect(result.workBucketKind).toBe(expected.workBucketKind);
  expect(result.classificationConfidence).toBe(expected.classificationConfidence);
}

function expectOrderByIndex(
  classified: ClassifiedRouteFragment[],
  index: number,
  expected: ExpectedFragment
): void {
  expect(classified[index]).toBeDefined();
  expectFragment(classified[index], expected);
}

describe('classifyRouteFragments', () => {
  // ── Test case 1: SO26013614 — base + category suffixes ───────────────────
  it('SO26013614: base route גליל with category suffixes סלולר, רכב-פז נהריה', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO26013614', rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null, customerName: 'פז חב.לנפט -ניתוב-נהריה : 316' },
      { orderNumber: 'SO26013614', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר', customerName: 'פז חב.לנפט -ניתוב-נהריה : 316' },
      { orderNumber: 'SO26013614', rawRouteLine: 'גליל/רכב-פז נהריה', routeBase: 'גליל', workBucketName: 'רכב-פז נהריה', customerName: 'פז חב.לנפט -ניתוב-נהריה : 316' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(3);

    // Base route
    expectOrderByIndex(result, 0, {
      orderNumber: 'SO26013614', routeBase: 'גליל', workBucketName: null,
      routeGroupName: 'גליל כללי', workBucketDisplayName: 'כללי',
      routeGroupKind: 'general', workBucketKind: 'general', classificationConfidence: 'high',
    });

    // Category: סלולר
    expectOrderByIndex(result, 1, {
      orderNumber: 'SO26013614', routeBase: 'גליל', workBucketName: 'סלולר',
      routeGroupName: 'גליל כללי', workBucketDisplayName: 'סלולר',
      routeGroupKind: 'general', workBucketKind: 'category', classificationConfidence: 'high',
    });

    // Category: רכב-פז נהריה
    expectOrderByIndex(result, 2, {
      orderNumber: 'SO26013614', routeBase: 'גליל', workBucketName: 'רכב-פז נהריה',
      routeGroupName: 'גליל כללי', workBucketDisplayName: 'רכב-פז נהריה',
      routeGroupKind: 'general', workBucketKind: 'category', classificationConfidence: 'high',
    });
  });

  // ── Test case 2: SO26013956 — base + category suffixes ───────────────────
  it('SO26013956: base route גליל with category suffixes סלולר, רכב-פז מכר', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO26013956', rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null, customerName: 'פז חב.לנפט -ניתוב - מכר : 360' },
      { orderNumber: 'SO26013956', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר', customerName: 'פז חב.לנפט -ניתוב - מכר : 360' },
      { orderNumber: 'SO26013956', rawRouteLine: 'גליל/רכב-פז מכר', routeBase: 'גליל', workBucketName: 'רכב-פז מכר', customerName: 'פז חב.לנפט -ניתוב - מכר : 360' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(3);

    expectOrderByIndex(result, 0, {
      orderNumber: 'SO26013956', routeBase: 'גליל', workBucketName: null,
      routeGroupName: 'גליל כללי', workBucketDisplayName: 'כללי',
      routeGroupKind: 'general', workBucketKind: 'general', classificationConfidence: 'high',
    });

    expectOrderByIndex(result, 1, {
      orderNumber: 'SO26013956', routeBase: 'גליל', workBucketName: 'סלולר',
      routeGroupName: 'גליל כללי', workBucketDisplayName: 'סלולר',
      routeGroupKind: 'general', workBucketKind: 'category', classificationConfidence: 'high',
    });

    expectOrderByIndex(result, 2, {
      orderNumber: 'SO26013956', routeBase: 'גליל', workBucketName: 'רכב-פז מכר',
      routeGroupName: 'גליל כללי', workBucketDisplayName: 'רכב-פז מכר',
      routeGroupKind: 'general', workBucketKind: 'category', classificationConfidence: 'high',
    });
  });

  // ── Test case 3: SO26012406 — base + category suffixes ───────────────────
  it('SO26012406: base route גליל with category suffixes סיגריות, רכב-פז מכר', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO26012406', rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null, customerName: 'פז חב.לנפט -ניתוב - מכר : 360' },
      { orderNumber: 'SO26012406', rawRouteLine: 'גליל/סיגריות', routeBase: 'גליל', workBucketName: 'סיגריות', customerName: 'פז חב.לנפט -ניתוב - מכר : 360' },
      { orderNumber: 'SO26012406', rawRouteLine: 'גליל/רכב-פז מכר', routeBase: 'גליל', workBucketName: 'רכב-פז מכר', customerName: 'פז חב.לנפט -ניתוב - מכר : 360' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(3);

    expectOrderByIndex(result, 0, {
      orderNumber: 'SO26012406', routeBase: 'גליל', workBucketName: null,
      routeGroupName: 'גליל כללי', workBucketDisplayName: 'כללי',
      routeGroupKind: 'general', workBucketKind: 'general', classificationConfidence: 'high',
    });

    expectOrderByIndex(result, 1, {
      orderNumber: 'SO26012406', routeBase: 'גליל', workBucketName: 'סיגריות',
      routeGroupName: 'גליל כללי', workBucketDisplayName: 'סיגריות',
      routeGroupKind: 'general', workBucketKind: 'category', classificationConfidence: 'high',
    });

    expectOrderByIndex(result, 2, {
      orderNumber: 'SO26012406', routeBase: 'גליל', workBucketName: 'רכב-פז מכר',
      routeGroupName: 'גליל כללי', workBucketDisplayName: 'רכב-פז מכר',
      routeGroupKind: 'general', workBucketKind: 'category', classificationConfidence: 'high',
    });
  });

  // ── Test case 4: SO26014230 — standalone single suffix ────────────────────
  it('SO26014230: standalone group גליל/דבאח עין המפרץ', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO26014230', rawRouteLine: 'גליל/דבאח עין המפרץ', routeBase: 'גליל', workBucketName: 'דבאח עין המפרץ', customerName: 'סאלח דבאח ובניו בע"מ - עין המפרץ עכו' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(1);
    expectOrderByIndex(result, 0, {
      orderNumber: 'SO26014230', routeBase: 'גליל', workBucketName: 'דבאח עין המפרץ',
      routeGroupName: 'דבאח עין המפרץ', workBucketDisplayName: 'כללי',
      routeGroupKind: 'standalone', workBucketKind: 'standalone-general', classificationConfidence: 'high',
    });
  });

  // ── Test case 5: SO26014147 — standalone single suffix ────────────────────
  it('SO26014147: standalone group גליל/סונול צומת עדי', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO26014147', rawRouteLine: 'גליל/סונול צומת עדי', routeBase: 'גליל', workBucketName: 'סונול צומת עדי', customerName: 'ספרינט מוטורס (סונול) | צומת עדי : 335' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(1);
    expectOrderByIndex(result, 0, {
      orderNumber: 'SO26014147', routeBase: 'גליל', workBucketName: 'סונול צומת עדי',
      routeGroupName: 'סונול צומת עדי', workBucketDisplayName: 'כללי',
      routeGroupKind: 'standalone', workBucketKind: 'standalone-general', classificationConfidence: 'high',
    });
  });

  // ── Test case 6: SO26013584 — standalone single suffix ────────────────────
  it('SO26013584: standalone group גליל/פז לוחמי הגטאות', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO26013584', rawRouteLine: 'גליל/פז לוחמי הגטאות', routeBase: 'גליל', workBucketName: 'פז לוחמי הגטאות', customerName: 'פז חב.לנפט -ניתוב- לוחמי הגטאות : 427' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(1);
    expectOrderByIndex(result, 0, {
      orderNumber: 'SO26013584', routeBase: 'גליל', workBucketName: 'פז לוחמי הגטאות',
      routeGroupName: 'פז לוחמי הגטאות', workBucketDisplayName: 'כללי',
      routeGroupKind: 'standalone', workBucketKind: 'standalone-general', classificationConfidence: 'high',
    });
  });

  // ── Test case 7: SO26012206 — slash-only mixed, no bare base ──────────────
  it('SO26012206: slash-only mixed order without bare base — group derived from non-category suffix', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO26012206', rawRouteLine: 'גליל/פז נהריה', routeBase: 'גליל', workBucketName: 'פז נהריה', customerName: 'פז חב.לנפט -ניתוב-נהריה : 316' },
      { orderNumber: 'SO26012206', rawRouteLine: 'גליל/סיגריות-פז נהריה', routeBase: 'גליל', workBucketName: 'סיגריות-פז נהריה', customerName: 'פז חב.לנפט -ניתוב-נהריה : 316' },
      { orderNumber: 'SO26012206', rawRouteLine: 'גליל/סלולר-פז נהריה', routeBase: 'גליל', workBucketName: 'סלולר-פז נהריה', customerName: 'פז חב.לנפט -ניתוב-נהריה : 316' },
      { orderNumber: 'SO26012206', rawRouteLine: 'גליל/רכב-פז נהריה', routeBase: 'גליל', workBucketName: 'רכב-פז נהריה', customerName: 'פז חב.לנפט -ניתוב-נהריה : 316' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(4);

    // Non-category suffix → route group = פז נהריה, bucket = כללי
    expectOrderByIndex(result, 0, {
      orderNumber: 'SO26012206', routeBase: 'גליל', workBucketName: 'פז נהריה',
      routeGroupName: 'פז נהריה', workBucketDisplayName: 'כללי',
      routeGroupKind: 'derived-from-non-category-suffix', workBucketKind: 'standalone-general', classificationConfidence: 'high',
    });

    // Category: סיגריות-פז נהריה
    expectOrderByIndex(result, 1, {
      orderNumber: 'SO26012206', routeBase: 'גליל', workBucketName: 'סיגריות-פז נהריה',
      routeGroupName: 'פז נהריה', workBucketDisplayName: 'סיגריות-פז נהריה',
      routeGroupKind: 'general', workBucketKind: 'category', classificationConfidence: 'high',
    });

    // Category: סלולר-פז נהריה
    expectOrderByIndex(result, 2, {
      orderNumber: 'SO26012206', routeBase: 'גליל', workBucketName: 'סלולר-פז נהריה',
      routeGroupName: 'פז נהריה', workBucketDisplayName: 'סלולר-פז נהריה',
      routeGroupKind: 'general', workBucketKind: 'category', classificationConfidence: 'high',
    });

    // Category: רכב-פז נהריה
    expectOrderByIndex(result, 3, {
      orderNumber: 'SO26012206', routeBase: 'גליל', workBucketName: 'רכב-פז נהריה',
      routeGroupName: 'פז נהריה', workBucketDisplayName: 'רכב-פז נהריה',
      routeGroupKind: 'general', workBucketKind: 'category', classificationConfidence: 'high',
    });
  });

  // ── Test case 8: low-confidence category-only fallback ────────────────────
  it('category-only suffix without base route or standalone context returns low confidence', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO-CAT-ONLY', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(1);
    expectOrderByIndex(result, 0, {
      orderNumber: 'SO-CAT-ONLY', routeBase: 'גליל', workBucketName: 'סלולר',
      routeGroupName: 'גליל כללי', workBucketDisplayName: 'סלולר',
      routeGroupKind: 'low-confidence', workBucketKind: 'unknown', classificationConfidence: 'low',
    });
    expect(result[0].classificationReason).toContain('category-like suffix without base route');
  });

  // ── Cross-order isolation: same suffix classifies differently per context ─
  it('same suffix classifies differently when context differs between orders', () => {
    const fragments: RouteFragmentInput[] = [
      // Order A: standalone פז נהריה
      { orderNumber: 'SO-A', rawRouteLine: 'גליל/פז נהריה', routeBase: 'גליל', workBucketName: 'פז נהריה' },
      // Order B: base route + category — even though it also has פז נהריה as standalone
      { orderNumber: 'SO-B', rawRouteLine: 'גליל/פז נהריה', routeBase: 'גליל', workBucketName: 'פז נהריה' },
      { orderNumber: 'SO-B', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר' },
      { orderNumber: 'SO-B', rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(4);

    // Order A: standalone
    expect(result[0].orderNumber).toBe('SO-A');
    expect(result[0].routeGroupName).toBe('פז נהריה');
    expect(result[0].classificationConfidence).toBe('high');
    expect(result[0].routeGroupKind).toBe('standalone');

    // Order B: Rule 2 applies (has base route + categories + standalone)
    // Results are built in order: base fragments first, then category, then standalone
    // Base route fragment (input position 3 within group — bare גליל)
    expect(result[1].orderNumber).toBe('SO-B');
    expect(result[1].workBucketName).toBeNull();
    expect(result[1].routeGroupName).toBe('גליל כללי');
    expect(result[1].classificationConfidence).toBe('high');
    expect(result[1].routeGroupKind).toBe('general');

    // Category suffix (input position 2 within group — סלולר)
    expect(result[2].orderNumber).toBe('SO-B');
    expect(result[2].workBucketName).toBe('סלולר');
    expect(result[2].routeGroupName).toBe('גליל כללי');
    expect(result[2].routeGroupKind).toBe('general');
    expect(result[2].workBucketKind).toBe('category');

    // Standalone suffix (input position 1 within group — פז נהריה)
    expect(result[3].orderNumber).toBe('SO-B');
    expect(result[3].workBucketName).toBe('פז נהריה');
    expect(result[3].routeGroupName).toBe('גליל כללי');
    expect(result[3].routeGroupKind).toBe('general');
  });

  // ── Multiple orders in one batch ──────────────────────────────────────────
  it('classifies multiple orders in a single batch independently', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO-ALPHA', rawRouteLine: 'מרכז', routeBase: 'מרכז', workBucketName: null },
      { orderNumber: 'SO-ALPHA', rawRouteLine: 'מרכז/סלולר', routeBase: 'מרכז', workBucketName: 'סלולר' },
      { orderNumber: 'SO-BETA', rawRouteLine: 'מרכז/פז השקמה', routeBase: 'מרכז', workBucketName: 'פז השקמה' },
      { orderNumber: 'SO-GAMMA', rawRouteLine: 'צפון/סלולר', routeBase: 'צפון', workBucketName: 'סלולר' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(4);

    // SO-ALPHA: base + category → general group
    expect(result[0].orderNumber).toBe('SO-ALPHA');
    expect(result[0].routeGroupName).toBe('מרכז כללי');
    expect(result[1].orderNumber).toBe('SO-ALPHA');
    expect(result[1].routeGroupName).toBe('מרכז כללי');

    // SO-BETA: standalone
    expect(result[2].orderNumber).toBe('SO-BETA');
    expect(result[2].routeGroupName).toBe('פז השקמה');
    expect(result[2].routeGroupKind).toBe('standalone');

    // SO-GAMMA: category-only → low confidence
    expect(result[3].orderNumber).toBe('SO-GAMMA');
    expect(result[3].routeGroupName).toBe('צפון כללי');
    expect(result[3].classificationConfidence).toBe('low');
  });

  // ── Same orderNumber, different routeBase → independent classification ──
  it('same orderNumber with different routeBase classifies independently', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO-SAME', rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null },
      { orderNumber: 'SO-SAME', rawRouteLine: 'צפון/דבאח עכו', routeBase: 'צפון', workBucketName: 'דבאח עכו' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result).toHaveLength(2);

    // First group (גליל): Rule 1 — bare base
    expect(result[0].orderNumber).toBe('SO-SAME');
    expect(result[0].routeBase).toBe('גליל');
    expect(result[0].routeGroupName).toBe('גליל כללי');
    expect(result[0].workBucketDisplayName).toBe('כללי');

    // Second group (צפון): standalone
    expect(result[1].orderNumber).toBe('SO-SAME');
    expect(result[1].routeBase).toBe('צפון');
    expect(result[1].routeGroupName).toBe('דבאח עכו');
    expect(result[1].workBucketDisplayName).toBe('כללי');
    expect(result[1].routeGroupKind).toBe('standalone');

    // They must not merge into the same group
    expect(result[0].routeGroupName).not.toBe(result[1].routeGroupName);
  });

  // ── Hebrew values preserved exactly ──────────────────────────────────────
  it('preserves Hebrew values exactly without normalization', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO-HE', rawRouteLine: 'גליל/דבאח עין המפרץ', routeBase: 'גליל', workBucketName: 'דבאח עין המפרץ' },
    ];

    const result = classifyRouteFragments(fragments);

    expect(result[0].routeGroupName).toBe('דבאח עין המפרץ');
    expect(result[0].workBucketDisplayName).toBe('כללי');
    expect(result[0].rawRouteLine).toBe('גליל/דבאח עין המפרץ');
    expect(result[0].routeBase).toBe('גליל');
    expect(result[0].workBucketName).toBe('דבאח עין המפרץ');
  });

  // ── Deterministic keys ────────────────────────────────────────────────────
  it('generates deterministic keys', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO-1', rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null },
    ];

    const result1 = classifyRouteFragments(fragments);
    const result2 = classifyRouteFragments(fragments);

    expect(result1[0].routeGroupKey).toBe(result2[0].routeGroupKey);
    expect(result1[0].workBucketKey).toBe(result2[0].workBucketKey);
    expect(result1[0].routeGroupKey).toMatch(/^rg/);
    expect(result1[0].workBucketKey).toMatch(/^wb/);
  });

  // ── routeGroupName and workBucketDisplayName are not conflated ───────────
  it('routeGroupName and workBucketDisplayName are distinct', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO-DISTINCT', rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null },
      { orderNumber: 'SO-DISTINCT', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר' },
    ];

    const result = classifyRouteFragments(fragments);

    // Base route: group and bucket are different
    expect(result[0].routeGroupName).toBe('גליל כללי');
    expect(result[0].workBucketDisplayName).toBe('כללי');
    expect(result[0].routeGroupName).not.toBe(result[0].workBucketDisplayName);

    // Category suffix: group and bucket are different
    expect(result[1].routeGroupName).toBe('גליל כללי');
    expect(result[1].workBucketDisplayName).toBe('סלולר');
    expect(result[1].routeGroupName).not.toBe(result[1].workBucketDisplayName);
  });

  // ── Low-confidence reason text clarity ────────────────────────────────────
  it('low confidence fragments include a clear reason', () => {
    const fragments: RouteFragmentInput[] = [
      { orderNumber: 'SO-LOW1', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר' },
      { orderNumber: 'SO-LOW2', rawRouteLine: 'צפון/רכב', routeBase: 'צפון', workBucketName: 'רכב' },
    ];

    const result = classifyRouteFragments(fragments);

    for (const r of result) {
      expect(r.classificationConfidence).toBe('low');
      expect(r.classificationReason.length).toBeGreaterThan(10);
      expect(r.routeGroupKind).toBe('low-confidence');
    }
  });

  // ── Empty fragments array ─────────────────────────────────────────────────
  it('returns empty array for empty input', () => {
    const result = classifyRouteFragments([]);
    expect(result).toEqual([]);
  });
});
