import { describe, expect, it } from 'vitest';
import { productKeys } from './queries';

describe('productKeys', () => {
  it('keeps catalog keys stable across pagination and filters', () => {
    expect(productKeys.catalog('gloves', 0, 50, false)).toEqual(['product', 'catalog', 'gloves', 0, 50, 'all']);
    expect(productKeys.catalog(null, 1, 25, true)).toEqual(['product', 'catalog', 'browse', 1, 25, 'active']);
  });

  it('keeps product search keys stable across searches', () => {
    expect(productKeys.search('gloves')).toEqual(['product', 'search', 'gloves']);
    expect(productKeys.search(null)).toEqual(['product', 'search', 'browse']);
  });

  it('rebinds product detail by id', () => {
    expect(productKeys.detail('product-a')).not.toEqual(productKeys.detail('product-b'));
    expect(productKeys.detail(null)).toEqual(['product', 'detail', 'none']);
  });

  it('keeps section-level detail keys stable', () => {
    expect(productKeys.unitProfile('product-a')).toEqual([
      'product',
      'unit-profile',
      'product-a'
    ]);
    expect(productKeys.unitProfile(null)).toEqual(['product', 'unit-profile', 'none']);
    expect(productKeys.packagingLevels('product-a')).toEqual([
      'product',
      'packaging-levels',
      'product-a'
    ]);
    expect(productKeys.packagingLevels(null)).toEqual([
      'product',
      'packaging-levels',
      'none'
    ]);
  });
});
