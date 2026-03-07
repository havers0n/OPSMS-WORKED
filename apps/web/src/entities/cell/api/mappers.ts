import type { Database } from '@/shared/api/supabase/types';

type CellRow = Database['public']['Tables'][string]['Row'];

export function mapCellRowToDomain(row: CellRow) {
  return row;
}
