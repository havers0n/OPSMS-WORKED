import { describe, expect, it, vi } from 'vitest';
import { attachProductsToRows, resolveProductIdFromInventoryRow, type ProductRow } from './inventory-product-resolution';

const productRows: ProductRow[] = [
  {
    id: '8c393d26-d4d8-4e84-b772-c1f7b9d8c111',
    source: 'artos.co.il',
    external_product_id: '19917',
    sku: '7290122461749',
    name: 'USB-C Wired Earbuds',
    permalink: 'https://artos.co.il/product/19917',
    image_urls: ['https://artos.co.il/wp-content/uploads/2026/01/in-ear-soumd-pic@4x-8-scaled.png'],
    image_files: ['artos_assets/images/19917_00_07a809fd58.png'],
    is_active: true,
    created_at: '2026-01-16T16:19:05.000Z',
    updated_at: '2026-01-16T16:19:05.000Z'
  }
];

describe('inventory product resolution', () => {
  it('prefers product_id over item_ref when both are present', () => {
    expect(
      resolveProductIdFromInventoryRow({
        product_id: productRows[0].id,
        item_ref: 'LEGACY-ITEM-001'
      })
    ).toBe(productRows[0].id);
  });

  it('resolves catalog-backed rows from product_id', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: productRows,
            error: null
          }))
        }))
      }))
    };

    const rows = await attachProductsToRows(supabase as never, [
      {
        item_ref: 'LEGACY-ALIAS-001',
        product_id: productRows[0].id
      }
    ]);

    expect(rows).toEqual([
      {
        item_ref: 'LEGACY-ALIAS-001',
        product_id: productRows[0].id,
        product: productRows[0]
      }
    ]);
  });

  it('keeps legacy rows readable without product hydration', async () => {
    const supabase = {
      from: vi.fn()
    };

    const rows = await attachProductsToRows(supabase as never, [
      {
        item_ref: 'ITEM-001',
        product_id: null
      }
    ]);

    expect(rows).toEqual([
      {
        item_ref: 'ITEM-001',
        product_id: null,
        product: null
      }
    ]);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
