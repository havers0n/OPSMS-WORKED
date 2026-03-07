import { cellSchema, parseCellAddress, type Cell } from '@wos/domain';
import type { Database } from '@/shared/api/supabase/types';

export type CellRow = Database['public']['Tables']['cells']['Row'];

export function mapCellRowToDomain(row: CellRow): Cell {
  return cellSchema.parse({
    id: row.id,
    cellCode: row.cell_code,
    layoutVersionId: row.layout_version_id,
    rackId: row.rack_id,
    rackFaceId: row.rack_face_id,
    rackSectionId: row.rack_section_id,
    rackLevelId: row.rack_level_id,
    slotNo: row.slot_no,
    address: parseCellAddress(row.address, row.address_sort_key),
    x: row.x ?? undefined,
    y: row.y ?? undefined,
    status: row.status
  });
}
