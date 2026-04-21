import { describe, expect, it } from 'vitest';
import {
  getProductLabel,
  getProductMeta,
  resolveProductDisplayImages,
  resolveProductPermalink,
  resolveProductPrimaryImage
} from './display';

const product = {
  id: '8c393d26-d4d8-4e84-b772-c1f7b9d8c111',
  source: 'artos.co.il',
  externalProductId: '19917',
  sku: '7290122461749',
  name: 'USB-C Wired Earbuds',
  permalink: 'https://artos.co.il/product/19917',
  imageUrls: ['https://artos.co.il/wp-content/uploads/2026/01/in-ear-soumd-pic@4x-8-scaled.png'],
  imageFiles: ['artos_assets/images/19917_00_07a809fd58.png'],
  isActive: true,
  createdAt: '2026-01-16T16:19:05.000Z',
  updatedAt: '2026-01-16T16:19:05.000Z'
};

describe('product display helpers', () => {
  it('uses resolved catalog metadata when product data exists', () => {
    expect(getProductLabel('product:8c393d26-d4d8-4e84-b772-c1f7b9d8c111', product)).toBe('USB-C Wired Earbuds');
    expect(getProductMeta('product:8c393d26-d4d8-4e84-b772-c1f7b9d8c111', product)).toBe('7290122461749');
  });

  it('keeps legacy refs readable', () => {
    expect(getProductLabel('ITEM-001', null)).toBe('ITEM-001');
    expect(getProductMeta('ITEM-001', null)).toBe('Legacy reference');
  });

  it('distinguishes unresolved catalog refs from legacy refs', () => {
    expect(getProductLabel('product:8c393d26-d4d8-4e84-b772-c1f7b9d8c111', null)).toBe(
      'product:8c393d26-d4d8-4e84-b772-c1f7b9d8c111'
    );
    expect(getProductMeta('product:8c393d26-d4d8-4e84-b772-c1f7b9d8c111', null)).toBe(
      'Catalog product unavailable'
    );
  });

  it('resolves primary image from imageUrls first', () => {
    expect(resolveProductPrimaryImage(product)).toBe(product.imageUrls[0]);
  });

  it('uses imageFiles only when imageUrls are missing and image file is directly displayable', () => {
    expect(
      resolveProductPrimaryImage({
        ...product,
        imageUrls: [],
        imageFiles: ['https://cdn.example.com/products/19917.png']
      })
    ).toBe('https://cdn.example.com/products/19917.png');
  });

  it('does not fake storage paths from imageFiles as displayable urls', () => {
    expect(
      resolveProductPrimaryImage({
        ...product,
        imageUrls: [],
        imageFiles: ['artos_assets/images/19917_00_07a809fd58.png']
      })
    ).toBeNull();
  });

  it('does not fallback to imageFiles when imageUrls are present but unusable', () => {
    expect(
      resolveProductPrimaryImage({
        ...product,
        imageUrls: ['not-a-url'],
        imageFiles: ['https://cdn.example.com/products/19917.png']
      })
    ).toBeNull();
  });

  it('returns permalink only when it is an http(s) url', () => {
    expect(resolveProductPermalink(product)).toBe(product.permalink);
    expect(resolveProductPermalink({ ...product, permalink: 'artos.co.il/product/19917' })).toBeNull();
  });

  it('resolves ordered display images from URLs first and then files', () => {
    expect(resolveProductDisplayImages(product)).toEqual([
      'https://artos.co.il/wp-content/uploads/2026/01/in-ear-soumd-pic@4x-8-scaled.png'
    ]);
  });

  it('filters invalid sources and deduplicates while preserving stable order', () => {
    expect(
      resolveProductDisplayImages({
        ...product,
        imageUrls: [
          '  https://cdn.example.com/p-1.jpg  ',
          '',
          'ftp://cdn.example.com/p-2.jpg',
          '/assets/p-3.jpg',
          'https://cdn.example.com/p-1.jpg'
        ],
        imageFiles: ['  ', 'artos_assets/images/private.png', '/assets/p-3.jpg', '/assets/p-4.jpg']
      })
    ).toEqual(['https://cdn.example.com/p-1.jpg', '/assets/p-3.jpg', '/assets/p-4.jpg']);
  });
});
