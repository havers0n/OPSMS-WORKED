import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@wos/domain';
import { mapProductRowToDomain } from '../../mappers.js';
import { productSelectColumns, type ProductRow } from '../../inventory-product-resolution.js';

export type ProductCatalogQuery = {
  query: string;
  limit: number;
  offset: number;
  activeOnly: boolean;
};

export type ProductCatalogPage = {
  items: Product[];
  total: number;
  activeTotal: number;
  limit: number;
  offset: number;
};

export type ProductsRepo = {
  findById(productId: string): Promise<Product | null>;
  listActive(limit?: number): Promise<Product[]>;
  searchActive(query: string, limit?: number): Promise<Product[]>;
  findCatalog(args: ProductCatalogQuery): Promise<ProductCatalogPage>;
};

export function createProductsRepo(supabase: SupabaseClient): ProductsRepo {
  return {
    async findById(productId) {
      const { data, error } = await supabase
        .from('products')
        .select(productSelectColumns)
        .eq('id', productId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const product = (data as ProductRow | null) ?? null;
      return product ? mapProductRowToDomain(product) : null;
    },

    async listActive(limit = 20) {
      const { data, error } = await supabase
        .from('products')
        .select(productSelectColumns)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return ((data ?? []) as ProductRow[]).map(mapProductRowToDomain);
    },

    async searchActive(query, limit = 20) {
      const normalizedQuery = query.trim();

      let request = supabase
        .from('products')
        .select(productSelectColumns)
        .eq('is_active', true);

      if (normalizedQuery.length > 0) {
        request = request.or(
          `name.ilike.%${normalizedQuery}%,sku.ilike.%${normalizedQuery}%,external_product_id.ilike.%${normalizedQuery}%`
        );
      }

      const { data, error } = await request
        .order('name', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return ((data ?? []) as ProductRow[]).map(mapProductRowToDomain);
    },

    async findCatalog(args) {
      const normalizedQuery = args.query.trim();

      let itemsRequest = supabase
        .from('products')
        .select(productSelectColumns);

      let totalRequest = supabase
        .from('products')
        .select('id', { count: 'exact', head: true });

      let activeTotalRequest = supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (args.activeOnly) {
        itemsRequest = itemsRequest.eq('is_active', true);
        totalRequest = totalRequest.eq('is_active', true);
      }

      if (normalizedQuery.length > 0) {
        const expression = `name.ilike.%${normalizedQuery}%,sku.ilike.%${normalizedQuery}%,external_product_id.ilike.%${normalizedQuery}%`;
        itemsRequest = itemsRequest.or(expression);
        totalRequest = totalRequest.or(expression);
        activeTotalRequest = activeTotalRequest.or(expression);
      }

      const [
        { data: itemRows, error: itemsError },
        { count: total, error: totalError },
        { count: activeTotal, error: activeTotalError }
      ] = await Promise.all([
        itemsRequest
          .order('name', { ascending: true })
          .range(args.offset, args.offset + args.limit - 1),
        totalRequest.limit(1),
        activeTotalRequest.limit(1)
      ]);

      if (itemsError) throw itemsError;
      if (totalError) throw totalError;
      if (activeTotalError) throw activeTotalError;

      return {
        items: ((itemRows ?? []) as ProductRow[]).map(mapProductRowToDomain),
        total: total ?? 0,
        activeTotal: activeTotal ?? 0,
        limit: args.limit,
        offset: args.offset
      };
    }
  };
}
