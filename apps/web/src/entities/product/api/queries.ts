import type { Product } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export type ProductCatalogPage = {
  items: Product[];
  total: number;
  activeTotal: number;
  limit: number;
  offset: number;
};

export const productKeys = {
  all: ['product'] as const,
  catalog: (query: string | null, page: number, pageSize: number, activeOnly: boolean) =>
    [...productKeys.all, 'catalog', query ?? 'browse', page, pageSize, activeOnly ? 'active' : 'all'] as const,
  search: (query: string | null) => [...productKeys.all, 'search', query ?? 'browse'] as const,
  detail: (productId: string | null) => [...productKeys.all, 'detail', productId ?? 'none'] as const
};

async function fetchProductCatalog(args: {
  query: string;
  page: number;
  pageSize: number;
  activeOnly: boolean;
}) {
  const searchParams = new URLSearchParams();

  if (args.query.trim().length > 0) {
    searchParams.set('query', args.query.trim());
  }

  searchParams.set('limit', String(args.pageSize));
  searchParams.set('offset', String(args.page * args.pageSize));
  searchParams.set('activeOnly', String(args.activeOnly));

  const suffix = searchParams.toString();
  return bffRequest<ProductCatalogPage>(`/api/products${suffix.length > 0 ? `?${suffix}` : ''}`);
}

async function fetchProducts(query: string) {
  const searchParams = new URLSearchParams();

  if (query.trim().length > 0) {
    searchParams.set('query', query.trim());
  }

  const suffix = searchParams.toString();
  return bffRequest<Product[]>(`/api/products/search${suffix.length > 0 ? `?${suffix}` : ''}`);
}

async function fetchProduct(productId: string) {
  return bffRequest<Product>(`/api/products/${productId}`);
}

export function productCatalogQueryOptions(args: {
  query: string | null;
  page: number;
  pageSize: number;
  activeOnly?: boolean;
}) {
  return queryOptions({
    queryKey: productKeys.catalog(args.query, args.page, args.pageSize, args.activeOnly ?? false),
    queryFn: () =>
      fetchProductCatalog({
        query: args.query ?? '',
        page: args.page,
        pageSize: args.pageSize,
        activeOnly: args.activeOnly ?? false
      })
  });
}

export function productsSearchQueryOptions(query: string | null) {
  return queryOptions({
    queryKey: productKeys.search(query),
    queryFn: () => fetchProducts(query ?? '')
  });
}

export function productQueryOptions(productId: string | null) {
  return queryOptions({
    queryKey: productKeys.detail(productId),
    queryFn: () => fetchProduct(productId as string),
    enabled: Boolean(productId)
  });
}
