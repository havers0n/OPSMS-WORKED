import type { Product, ProductPackagingLevel, ProductUnitProfile, StoragePreset } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest, BffRequestError, resolveBffUrl } from '@/shared/api/bff/client';
import { supabase } from '@/shared/api/supabase/client';
import { env } from '@/shared/config/env';

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
  detail: (productId: string | null) => [...productKeys.all, 'detail', productId ?? 'none'] as const,
  unitProfile: (productId: string | null) => [...productKeys.all, 'unit-profile', productId ?? 'none'] as const,
  packagingLevels: (productId: string | null) =>
    [...productKeys.all, 'packaging-levels', productId ?? 'none'] as const,
  storagePresets: (productId: string | null) =>
    [...productKeys.all, 'storage-presets', productId ?? 'none'] as const
};

type BffErrorBody = {
  code?: string;
  message?: string;
  details?: unknown;
  requestId?: string;
  errorId?: string;
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

async function fetchNullableProductSection<T>(path: string): Promise<T | null> {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const headers = new Headers();
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(resolveBffUrl(env.bffUrl, path), { headers });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as BffErrorBody | null;
    const requestId = errorBody?.requestId ?? response.headers.get('x-request-id');
    const errorId = errorBody?.errorId ?? null;
    const message =
      errorBody?.message ??
      `BFF request failed with status ${response.status}${requestId ? ` [request ${requestId}]` : ''}${errorId ? ` [error ${errorId}]` : ''}`;

    throw new BffRequestError(
      response.status,
      errorBody?.code ?? null,
      message,
      requestId,
      errorId,
      errorBody?.details ?? null
    );
  }

  return (await response.json()) as T;
}

async function fetchProductUnitProfile(productId: string) {
  return fetchNullableProductSection<ProductUnitProfile>(`/api/products/${productId}/unit-profile`);
}

async function fetchProductPackagingLevels(productId: string) {
  const levels =
    await fetchNullableProductSection<ProductPackagingLevel[]>(
      `/api/products/${productId}/packaging-levels`
    );
  return levels ?? [];
}

async function fetchProductStoragePresets(productId: string) {
  const presets =
    await fetchNullableProductSection<StoragePreset[]>(
      `/api/products/${productId}/storage-presets`
    );
  return presets ?? [];
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

export function productUnitProfileQueryOptions(productId: string | null) {
  return queryOptions({
    queryKey: productKeys.unitProfile(productId),
    queryFn: () => fetchProductUnitProfile(productId as string),
    enabled: Boolean(productId)
  });
}

export function productPackagingLevelsQueryOptions(productId: string | null) {
  return queryOptions({
    queryKey: productKeys.packagingLevels(productId),
    queryFn: () => fetchProductPackagingLevels(productId as string),
    enabled: Boolean(productId)
  });
}

export function productStoragePresetsQueryOptions(productId: string | null) {
  return queryOptions({
    queryKey: productKeys.storagePresets(productId),
    queryFn: () => fetchProductStoragePresets(productId as string),
    enabled: Boolean(productId)
  });
}
