import type { Site } from '@wos/domain';

export type SiteRow = {
  id: string;
  code: string;
  name: string;
  timezone: string;
};

export function mapSiteRowToDomain(row: SiteRow): Site {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    timezone: row.timezone
  };
}
