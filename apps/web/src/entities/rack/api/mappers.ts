import type { Database } from '@/shared/api/supabase/types';

type RackRow = Database['public']['Tables'][string]['Row'];

export function mapRackRowToDomain(row: RackRow) {
  return row;
}
