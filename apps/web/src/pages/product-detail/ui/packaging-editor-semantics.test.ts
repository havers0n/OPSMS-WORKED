import { describe, expect, it } from 'vitest';
import { createEmptyPackagingLevelDraft, type PackagingLevelDraft } from './section-editing';
import { derivePackagingEditorSemantics } from './packaging-editor-semantics';

function createRow(overrides: Partial<PackagingLevelDraft>): PackagingLevelDraft {
  return {
    ...createEmptyPackagingLevelDraft(crypto.randomUUID()),
    code: 'ROW',
    name: 'Row',
    ...overrides
  };
}

describe('derivePackagingEditorSemantics', () => {
  it('locks base rows to 1 single unit semantics', () => {
    const baseRow = createRow({ code: 'EA', name: 'Each', isBase: true, baseUnitQty: '9' });

    const result = derivePackagingEditorSemantics([baseRow]);
    const semantics = result[baseRow.draftId];

    expect(semantics).toBeDefined();
    expect(semantics.quantityInputDisabled).toBe(true);
    expect(semantics.quantityInputValue).toBe('1');
    expect(semantics.equivalentLine).toBe('Contains exactly 1 single unit');
    expect(semantics.quantityHelperLine).toBe('Base unit is always 1 single unit.');
    expect(semantics.cueLabel).toBe('Base unit level');
  });

  it('shows clean inferred containment for divisible chain', () => {
    const unit = createRow({ code: 'EA', name: 'Unit', isBase: true, baseUnitQty: '1' });
    const inner = createRow({ code: 'INR', name: 'Inner box', baseUnitQty: '6' });
    const carton = createRow({ code: 'CTN', name: 'Carton', baseUnitQty: '24' });

    const result = derivePackagingEditorSemantics([unit, inner, carton]);

    expect(result[carton.draftId]?.equivalentLine).toBe('Equivalent to 24 single units');
    expect(result[carton.draftId]?.containmentLine).toBe('Contains 4 x Inner box');
    expect(result[carton.draftId]?.fallbackLine).toBeNull();
    expect(result[carton.draftId]?.cueLabel).toBe('Additional pack type');
  });

  it('shows fallback message when no clean nested relation can be inferred', () => {
    const unit = createRow({ code: 'EA', name: 'Unit', isBase: true, baseUnitQty: '1' });
    const inner = createRow({ code: 'INR', name: 'Inner box', baseUnitQty: '6' });
    const odd = createRow({ code: 'ODD', name: 'Odd case', baseUnitQty: '25' });

    const result = derivePackagingEditorSemantics([unit, inner, odd]);

    expect(result[odd.draftId]?.equivalentLine).toBe('Equivalent to 25 single units');
    expect(result[odd.draftId]?.containmentLine).toBeNull();
    expect(result[odd.draftId]?.fallbackLine).toBe('No clean nested relation inferred');
  });

  it('treats duplicate quantities as parallel levels without containment', () => {
    const unit = createRow({ code: 'EA', name: 'Unit', isBase: true, baseUnitQty: '1' });
    const cartonA = createRow({ code: 'CTN-A', name: 'Carton A', baseUnitQty: '24' });
    const cartonB = createRow({ code: 'CTN-B', name: 'Carton B', baseUnitQty: '24' });

    const result = derivePackagingEditorSemantics([unit, cartonA, cartonB]);

    expect(result[cartonA.draftId]?.containmentLine).toBeNull();
    expect(result[cartonA.draftId]?.fallbackLine).toBe('No clean nested relation inferred');
    expect(result[cartonB.draftId]?.containmentLine).toBeNull();
    expect(result[cartonB.draftId]?.fallbackLine).toBe('No clean nested relation inferred');
  });
});
