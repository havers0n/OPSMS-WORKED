import type { Floor } from '@wos/domain';

export type FloorRow = {
  id: string;
  site_id: string;
  code: string;
  name: string;
  sort_order: number;
};

export function mapFloorRowToDomain(row: FloorRow): Floor {
  return {
    id: row.id,
    siteId: row.site_id,
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order
  };
}
