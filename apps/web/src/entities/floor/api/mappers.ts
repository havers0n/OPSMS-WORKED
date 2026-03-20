import { floorSchema, type Floor } from '@wos/domain';
import type { Database } from '@/shared/api/supabase/types';

export type FloorRow = Database['public']['Tables']['floors']['Row'];

export function mapFloorRowToDomain(row: FloorRow): Floor {
  return floorSchema.parse({
    id: row.id,
    siteId: row.site_id,
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order
  });
}
