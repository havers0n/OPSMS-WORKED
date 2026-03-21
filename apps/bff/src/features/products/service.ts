import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@wos/domain';
import { createProductsRepo, type ProductCatalogQuery, type ProductCatalogPage } from './repo.js';

export type ProductsService = {
  findCatalog(args: ProductCatalogQuery): Promise<ProductCatalogPage>;
  searchActive(query: string, limit?: number): Promise<Product[]>;
  listActive(limit?: number): Promise<Product[]>;
  findById(productId: string): Promise<Product | null>;
};

export function createProductsService(supabase: SupabaseClient): ProductsService {
  const repo = createProductsRepo(supabase);
  return {
    findCatalog: (args) => repo.findCatalog(args),
    searchActive: (query, limit) => repo.searchActive(query, limit),
    listActive: (limit) => repo.listActive(limit),
    findById: (productId) => repo.findById(productId)
  };
}
