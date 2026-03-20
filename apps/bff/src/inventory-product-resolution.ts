import type { SupabaseClient } from '@supabase/supabase-js';
import { getCatalogProductId } from '@wos/domain';
import { z } from 'zod';

export type ProductRow = {
  id: string;
  source: string;
  external_product_id: string;
  sku: string | null;
  name: string;
  permalink: string | null;
  image_urls: unknown;
  image_files: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductAwareRow = {
  item_ref: string | null;
  product_id?: string | null;
  product?: ProductRow | null;
};

export const productSelectColumns =
  'id,source,external_product_id,sku,name,permalink,image_urls,image_files,is_active,created_at,updated_at';

const productIdSchema = z.string().uuid();

function normalizeProductId(productId: string | null | undefined): string | null {
  if (typeof productId !== 'string') {
    return null;
  }

  const result = productIdSchema.safeParse(productId);
  return result.success ? result.data : null;
}

export function resolveProductIdFromInventoryRow(row: Pick<ProductAwareRow, 'item_ref' | 'product_id'>): string | null {
  return normalizeProductId(row.product_id) ?? getCatalogProductId(row.item_ref);
}

export async function attachProductsToRows<T extends ProductAwareRow>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<Array<T & { product: ProductRow | null }>> {
  const productIds = [...new Set(rows.map(resolveProductIdFromInventoryRow).filter((productId): productId is string => productId !== null))];

  if (productIds.length === 0) {
    return rows.map((row) => ({
      ...row,
      product: row.product ?? null
    }));
  }

  const { data, error } = await supabase
    .from('products')
    .select(productSelectColumns)
    .in('id', productIds);

  if (error) {
    throw error;
  }

  const productsById = new Map<string, ProductRow>(
    ((data ?? []) as ProductRow[]).map((product) => [product.id, product])
  );

  return rows.map((row) => ({
    ...row,
    product: productsById.get(resolveProductIdFromInventoryRow(row) ?? '') ?? row.product ?? null
  }));
}
