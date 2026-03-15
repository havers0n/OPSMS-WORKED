import { useQuery } from '@tanstack/react-query';
import { productQueryOptions } from './queries';

export function useProduct(productId: string | null) {
  return useQuery(productQueryOptions(productId));
}
