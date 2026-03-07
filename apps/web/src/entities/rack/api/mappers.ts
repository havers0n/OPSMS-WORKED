import { rackSchema, type Rack } from '@wos/domain';
import type { Database } from '@/shared/api/supabase/types';

export type RackRow = Database['public']['Tables']['racks']['Row'];

export function mapRackRowToDomain(row: RackRow): Rack {
  return rackSchema.parse({
    id: row.id,
    displayCode: row.display_code,
    kind: row.kind,
    axis: row.axis,
    x: row.x,
    y: row.y,
    totalLength: row.total_length,
    depth: row.depth,
    rotationDeg: row.rotation_deg,
    faces: []
  });
}
