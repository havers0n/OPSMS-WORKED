import { describe, expect, it } from 'vitest';
import {
  buildCatalogProductItemRef,
  catalogProductItemRefSchema,
  classifyInventoryItemRef,
  getCatalogProductId,
  isCatalogProductItemRef,
  parseCatalogProductItemRef
} from './inventory-item-ref';

describe('inventory item refs', () => {
  it('builds canonical catalog-backed refs', () => {
    expect(buildCatalogProductItemRef('8C393D26-D4D8-4E84-B772-C1F7B9D8C111')).toBe(
      'product:8c393d26-d4d8-4e84-b772-c1f7b9d8c111'
    );
  });

  it('parses valid catalog-backed refs', () => {
    expect(parseCatalogProductItemRef(' product:8C393D26-D4D8-4E84-B772-C1F7B9D8C111 ')).toEqual({
      kind: 'catalog-product',
      itemRef: 'product:8c393d26-d4d8-4e84-b772-c1f7b9d8c111',
      productId: '8c393d26-d4d8-4e84-b772-c1f7b9d8c111'
    });
    expect(getCatalogProductId('product:8c393d26-d4d8-4e84-b772-c1f7b9d8c111')).toBe(
      '8c393d26-d4d8-4e84-b772-c1f7b9d8c111'
    );
    expect(isCatalogProductItemRef('product:8c393d26-d4d8-4e84-b772-c1f7b9d8c111')).toBe(true);
  });

  it('rejects malformed catalog-backed refs', () => {
    expect(catalogProductItemRefSchema.safeParse('product:not-a-uuid').success).toBe(false);
    expect(parseCatalogProductItemRef('product:not-a-uuid')).toBeNull();
    expect(isCatalogProductItemRef('product:not-a-uuid')).toBe(false);
  });

  it('classifies legacy refs explicitly', () => {
    expect(classifyInventoryItemRef(' ITEM-001 ')).toEqual({
      kind: 'legacy',
      itemRef: 'ITEM-001'
    });
    expect(classifyInventoryItemRef('product:not-a-uuid')).toEqual({
      kind: 'legacy',
      itemRef: 'product:not-a-uuid'
    });
  });
});
