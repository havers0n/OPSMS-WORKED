import { describe, expect, it } from 'vitest';
import { productKeys } from './queries';

describe('productKeys', () => {
  it('keeps product search keys stable across searches', () => {
    expect(productKeys.search('gloves')).toEqual(['product', 'search', 'gloves']);
    expect(productKeys.search(null)).toEqual(['product', 'search', 'browse']);
  });

  it('rebinds product detail by id', () => {
    expect(productKeys.detail('product-a')).not.toEqual(productKeys.detail('product-b'));
    expect(productKeys.detail(null)).toEqual(['product', 'detail', 'none']);
  });
});
