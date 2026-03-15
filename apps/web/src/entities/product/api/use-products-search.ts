import { useQuery } from '@tanstack/react-query';
import { productsSearchQueryOptions } from './queries';

export function useProductsSearch(query: string | null) {
  return useQuery(productsSearchQueryOptions(query));
}
