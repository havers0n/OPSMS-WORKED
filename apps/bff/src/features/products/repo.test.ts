import { describe, expect, it, vi } from 'vitest';
import { createProductsRepo } from './repo.js';
import type { PackagingLevelInput } from './packaging-validation.js';

describe('products repo packaging levels', () => {
  it('forwards existing ids and sends null ids for new rows to the replace RPC', async () => {
    const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const existingLevelId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const supabase = {
      rpc: vi.fn(async () => ({ data: [], error: null }))
    };
    const repo = createProductsRepo(supabase as never);

    const levels: PackagingLevelInput[] = [
      {
        id: existingLevelId,
        code: 'EACH',
        name: 'Each',
        baseUnitQty: 1,
        isBase: true,
        canPick: true,
        canStore: true,
        isDefaultPickUom: true,
        barcode: null,
        packWeightG: null,
        packWidthMm: null,
        packHeightMm: null,
        packDepthMm: null,
        sortOrder: 0,
        isActive: true
      },
      {
        code: 'BOX',
        name: 'Box',
        baseUnitQty: 6,
        isBase: false,
        canPick: true,
        canStore: true,
        isDefaultPickUom: false,
        barcode: null,
        packWeightG: null,
        packWidthMm: null,
        packHeightMm: null,
        packDepthMm: null,
        sortOrder: 1,
        isActive: true
      }
    ];

    await repo.replaceAllPackagingLevels(productId, levels);

    expect(supabase.rpc).toHaveBeenCalledWith('replace_product_packaging_levels', {
      product_uuid: productId,
      levels_json: [
        expect.objectContaining({
          id: existingLevelId,
          code: 'EACH',
          base_unit_qty: 1
        }),
        expect.objectContaining({
          id: null,
          code: 'BOX',
          base_unit_qty: 6
        })
      ]
    });
  });
});
