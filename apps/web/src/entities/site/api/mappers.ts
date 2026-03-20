import { siteSchema, type Site } from '@wos/domain';
import type { Database } from '@/shared/api/supabase/types';

export type SiteRow = Database['public']['Tables']['sites']['Row'];

export function mapSiteRowToDomain(row: SiteRow): Site {
  return siteSchema.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    timezone: row.timezone
  });
}
