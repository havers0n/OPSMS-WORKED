import { useQuery } from '@tanstack/react-query';
import { cellStorageQueryOptions } from './queries';

export function useCellStorage(cellId: string | null) {
  return useQuery(cellStorageQueryOptions(cellId));
}
