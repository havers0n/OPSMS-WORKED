import type { SupabaseClient } from '@supabase/supabase-js';
import type { DeliveryPoint } from '@wos/domain';
import { normalizeDeliveryPointAliasText } from '@wos/domain';

// ── Types ────────────────────────────────────────────────────────────────────

export type ListDeliveryPointsParams = {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type DeliveryPointsRepo = {
  listDeliveryPoints(params?: ListDeliveryPointsParams): Promise<DeliveryPoint[]>;
  getDeliveryPointById(id: string): Promise<DeliveryPoint | null>;
  findDeliveryPointBySource(sourceType: string, sourceExternalId: string): Promise<DeliveryPoint | null>;
  findDeliveryPointByAliasExact(aliasText: string): Promise<DeliveryPoint | null>;
};

// ── Column selects ───────────────────────────────────────────────────────────

const deliveryPointColumns = `
  id,
  source_type,
  source_external_id,
  official_fuel_admin_id,
  display_name,
  company_name,
  site_name,
  address,
  municipality,
  latitude,
  longitude,
  status,
  created_at,
  updated_at
`.trim();

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapDeliveryPointRow(row: Record<string, unknown>): DeliveryPoint {
  return {
    id: row.id as string,
    sourceType: row.source_type as string,
    sourceExternalId: row.source_external_id as string,
    officialFuelAdminId: (row.official_fuel_admin_id as string) ?? null,
    displayName: row.display_name as string,
    companyName: (row.company_name as string) ?? null,
    siteName: (row.site_name as string) ?? null,
    address: (row.address as string) ?? null,
    municipality: (row.municipality as string) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    status: row.status as DeliveryPoint['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createDeliveryPointsRepo(supabase: SupabaseClient): DeliveryPointsRepo {
  return {
    async listDeliveryPoints(params) {
      let query = supabase
        .from('delivery_points')
        .select(deliveryPointColumns);

      if (params?.status) {
        query = query.eq('status', params.status);
      }

      if (params?.search) {
        query = query.or(
          `display_name.ilike.%${params.search}%,company_name.ilike.%${params.search}%,site_name.ilike.%${params.search}%,address.ilike.%${params.search}%`
        );
      }

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      if (params?.offset) {
        query = query.range(params.offset, params.offset + (params.limit ?? 20) - 1);
      }

      query = query.order('display_name', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapDeliveryPointRow);
    },

    async getDeliveryPointById(id) {
      const { data, error } = await supabase
        .from('delivery_points')
        .select(deliveryPointColumns)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return mapDeliveryPointRow(data as unknown as Record<string, unknown>);
    },

    async findDeliveryPointBySource(sourceType, sourceExternalId) {
      const { data, error } = await supabase
        .from('delivery_points')
        .select(deliveryPointColumns)
        .eq('source_type', sourceType)
        .eq('source_external_id', sourceExternalId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return mapDeliveryPointRow(data as unknown as Record<string, unknown>);
    },

    async findDeliveryPointByAliasExact(aliasText) {
      const normalized = normalizeDeliveryPointAliasText(aliasText);
      if (!normalized) return null;

      const { data: aliases, error } = await supabase
        .from('delivery_point_aliases')
        .select(`
          delivery_point_id,
          delivery_points!inner(${deliveryPointColumns})
        `)
        .eq('normalized_alias_text', normalized)
        .eq('confidence', 'confirmed');

      if (error) throw error;

      if (!aliases || aliases.length === 0) return null;

      // Deduplicate by delivery_point_id
      const seen = new Set<string>();
      const uniquePoints: DeliveryPoint[] = [];

      for (const alias of aliases as unknown as Record<string, unknown>[]) {
        const pointId = alias.delivery_point_id as string;
        if (seen.has(pointId)) continue;
        seen.add(pointId);

        const pointRow = (alias as unknown as Record<string, unknown>).delivery_points as unknown as Record<string, unknown>;
        uniquePoints.push(mapDeliveryPointRow(pointRow));
      }

      if (uniquePoints.length === 1) return uniquePoints[0];

      throw Object.assign(
        new Error(
          `Alias "${aliasText}" (normalized: "${normalized}") resolves to ${uniquePoints.length} different delivery points`
        ),
        { code: 'AMBIGUOUS_ALIAS', deliveryPoints: uniquePoints }
      );
    }
  };
}
