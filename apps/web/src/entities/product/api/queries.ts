import type { Product } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const productKeys = {
  all: ['product'] as const,
  search: (query: string | null) => [...productKeys.all, 'search', query ?? 'browse'] as const,
  detail: (productId: string | null) => [...productKeys.all, 'detail', productId ?? 'none'] as const
};

async function fetchProducts(query: string) {
  const searchParams = new URLSearchParams();

  if (query.trim().length > 0) {
    searchParams.set('query', query.trim());
  }

  const suffix = searchParams.toString();
  return bffRequest<Product[]>(`/api/products${suffix.length > 0 ? `?${suffix}` : ''}`);
}

async function fetchProduct(productId: string) {
  return bffRequest<Product>(`/api/products/${productId}`);
}

export function productsSearchQueryOptions(query: string | null) {
  return queryOptions({
    queryKey: productKeys.search(query),
    queryFn: () => fetchProducts(query ?? ''),
    enabled: query !== null
  });
}

export function productQueryOptions(productId: string | null) {
  return queryOptions({
    queryKey: productKeys.detail(productId),
    queryFn: () => fetchProduct(productId as string),
    enabled: Boolean(productId)
  });
}
