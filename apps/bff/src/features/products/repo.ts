import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product, ProductUnitProfile, ProductPackagingLevel } from '@wos/domain';
import {
  mapProductRowToDomain,
  mapUnitProfileRowToDomain,
  mapPackagingLevelRowToDomain,
  type UnitProfileRow,
  type PackagingLevelRow
} from '../../mappers.js';
import { productSelectColumns, type ProductRow } from '../../inventory-product-resolution.js';
import type { PackagingLevelInput } from './packaging-validation.js';
import { mapPackagingRpcError } from './errors.js';

export type ProductCatalogQuery = {
  query: string;
  limit: number;
  offset: number;
  activeOnly: boolean;
};

export type ProductCatalogPage = {
  items: Product[];
  total: number;
  activeTotal: number;
  limit: number;
  offset: number;
};

export type UpsertUnitProfileData = {
  unitWeightG?: number | null;
  unitWidthMm?: number | null;
  unitHeightMm?: number | null;
  unitDepthMm?: number | null;
  weightClass?: 'light' | 'medium' | 'heavy' | 'very_heavy' | null;
  sizeClass?: 'small' | 'medium' | 'large' | 'oversized' | null;
};

export type CreatePackagingLevelData = {
  code: string;
  name: string;
  baseUnitQty: number;
  isBase: boolean;
  canPick: boolean;
  canStore: boolean;
  isDefaultPickUom: boolean;
  barcode?: string | null;
  packWeightG?: number | null;
  packWidthMm?: number | null;
  packHeightMm?: number | null;
  packDepthMm?: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type PatchPackagingLevelData = Partial<CreatePackagingLevelData>;

export type ProductsRepo = {
  findById(productId: string): Promise<Product | null>;
  listActive(limit?: number): Promise<Product[]>;
  searchActive(query: string, limit?: number): Promise<Product[]>;
  findCatalog(args: ProductCatalogQuery): Promise<ProductCatalogPage>;
  findUnitProfile(productId: string): Promise<ProductUnitProfile | null>;
  upsertUnitProfile(productId: string, data: UpsertUnitProfileData): Promise<ProductUnitProfile>;
  findPackagingLevels(productId: string): Promise<ProductPackagingLevel[]>;
  createPackagingLevel(productId: string, data: CreatePackagingLevelData): Promise<ProductPackagingLevel>;
  updatePackagingLevel(productId: string, levelId: string, data: PatchPackagingLevelData): Promise<ProductPackagingLevel>;
  deletePackagingLevel(productId: string, levelId: string): Promise<void>;
  replaceAllPackagingLevels(productId: string, levels: PackagingLevelInput[]): Promise<ProductPackagingLevel[]>;
};

export function createProductsRepo(supabase: SupabaseClient): ProductsRepo {
  return {
    async findById(productId) {
      const { data, error } = await supabase
        .from('products')
        .select(productSelectColumns)
        .eq('id', productId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const product = (data as ProductRow | null) ?? null;
      return product ? mapProductRowToDomain(product) : null;
    },

    async listActive(limit = 20) {
      const { data, error } = await supabase
        .from('products')
        .select(productSelectColumns)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return ((data ?? []) as ProductRow[]).map(mapProductRowToDomain);
    },

    async searchActive(query, limit = 20) {
      const normalizedQuery = query.trim();

      let request = supabase
        .from('products')
        .select(productSelectColumns)
        .eq('is_active', true);

      if (normalizedQuery.length > 0) {
        request = request.or(
          `name.ilike.%${normalizedQuery}%,sku.ilike.%${normalizedQuery}%,external_product_id.ilike.%${normalizedQuery}%`
        );
      }

      const { data, error } = await request
        .order('name', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return ((data ?? []) as ProductRow[]).map(mapProductRowToDomain);
    },

    async findCatalog(args) {
      const normalizedQuery = args.query.trim();

      let itemsRequest = supabase
        .from('products')
        .select(productSelectColumns);

      let totalRequest = supabase
        .from('products')
        .select('id', { count: 'exact', head: true });

      let activeTotalRequest = supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (args.activeOnly) {
        itemsRequest = itemsRequest.eq('is_active', true);
        totalRequest = totalRequest.eq('is_active', true);
      }

      if (normalizedQuery.length > 0) {
        const expression = `name.ilike.%${normalizedQuery}%,sku.ilike.%${normalizedQuery}%,external_product_id.ilike.%${normalizedQuery}%`;
        itemsRequest = itemsRequest.or(expression);
        totalRequest = totalRequest.or(expression);
        activeTotalRequest = activeTotalRequest.or(expression);
      }

      const [
        { data: itemRows, error: itemsError },
        { count: total, error: totalError },
        { count: activeTotal, error: activeTotalError }
      ] = await Promise.all([
        itemsRequest
          .order('name', { ascending: true })
          .range(args.offset, args.offset + args.limit - 1),
        totalRequest.limit(1),
        activeTotalRequest.limit(1)
      ]);

      if (itemsError) throw itemsError;
      if (totalError) throw totalError;
      if (activeTotalError) throw activeTotalError;

      return {
        items: ((itemRows ?? []) as ProductRow[]).map(mapProductRowToDomain),
        total: total ?? 0,
        activeTotal: activeTotal ?? 0,
        limit: args.limit,
        offset: args.offset
      };
    },

    async findUnitProfile(productId) {
      const { data, error } = await supabase
        .from('product_unit_profiles')
        .select('*')
        .eq('product_id', productId)
        .maybeSingle();

      if (error) throw error;
      return data ? mapUnitProfileRowToDomain(data as UnitProfileRow) : null;
    },

    async upsertUnitProfile(productId, data) {
      const row = {
        product_id: productId,
        unit_weight_g: data.unitWeightG ?? null,
        unit_width_mm: data.unitWidthMm ?? null,
        unit_height_mm: data.unitHeightMm ?? null,
        unit_depth_mm: data.unitDepthMm ?? null,
        weight_class: data.weightClass ?? null,
        size_class: data.sizeClass ?? null,
        updated_at: new Date().toISOString()
      };

      const { data: upserted, error } = await supabase
        .from('product_unit_profiles')
        .upsert(row, { onConflict: 'product_id' })
        .select('*')
        .single();

      if (error) throw error;
      return mapUnitProfileRowToDomain(upserted as UnitProfileRow);
    },

    async findPackagingLevels(productId) {
      const { data, error } = await supabase
        .from('product_packaging_levels')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as PackagingLevelRow[]).map(mapPackagingLevelRowToDomain);
    },

    async createPackagingLevel(productId, data) {
      const row = {
        product_id: productId,
        code: data.code,
        name: data.name,
        base_unit_qty: data.baseUnitQty,
        is_base: data.isBase,
        can_pick: data.canPick,
        can_store: data.canStore,
        is_default_pick_uom: data.isDefaultPickUom,
        barcode: data.barcode ?? null,
        pack_weight_g: data.packWeightG ?? null,
        pack_width_mm: data.packWidthMm ?? null,
        pack_height_mm: data.packHeightMm ?? null,
        pack_depth_mm: data.packDepthMm ?? null,
        sort_order: data.sortOrder,
        is_active: data.isActive
      };

      const { data: created, error } = await supabase
        .from('product_packaging_levels')
        .insert(row)
        .select('*')
        .single();

      if (error) throw error;
      return mapPackagingLevelRowToDomain(created as PackagingLevelRow);
    },

    async updatePackagingLevel(productId, levelId, data) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.code !== undefined) updates.code = data.code;
      if (data.name !== undefined) updates.name = data.name;
      if (data.baseUnitQty !== undefined) updates.base_unit_qty = data.baseUnitQty;
      if (data.isBase !== undefined) updates.is_base = data.isBase;
      if (data.canPick !== undefined) updates.can_pick = data.canPick;
      if (data.canStore !== undefined) updates.can_store = data.canStore;
      if (data.isDefaultPickUom !== undefined) updates.is_default_pick_uom = data.isDefaultPickUom;
      if ('barcode' in data) updates.barcode = data.barcode ?? null;
      if ('packWeightG' in data) updates.pack_weight_g = data.packWeightG ?? null;
      if ('packWidthMm' in data) updates.pack_width_mm = data.packWidthMm ?? null;
      if ('packHeightMm' in data) updates.pack_height_mm = data.packHeightMm ?? null;
      if ('packDepthMm' in data) updates.pack_depth_mm = data.packDepthMm ?? null;
      if (data.sortOrder !== undefined) updates.sort_order = data.sortOrder;
      if (data.isActive !== undefined) updates.is_active = data.isActive;

      const { data: updated, error } = await supabase
        .from('product_packaging_levels')
        .update(updates)
        .eq('id', levelId)
        .eq('product_id', productId)
        .select('*')
        .single();

      if (error) throw error;
      if (!updated) throw new Error('Packaging level not found');
      return mapPackagingLevelRowToDomain(updated as PackagingLevelRow);
    },

    async deletePackagingLevel(productId, levelId) {
      const { error } = await supabase
        .from('product_packaging_levels')
        .delete()
        .eq('id', levelId)
        .eq('product_id', productId);

      if (error) throw error;
    },

    async replaceAllPackagingLevels(productId, levels) {
      // Single SQL RPC: validates + deletes + inserts all inside one transaction.
      // If validation fails or any insert fails, the DB rolls back and prior rows survive.
      const levelsJson = levels.map((l) => ({
        code: l.code,
        name: l.name,
        base_unit_qty: l.baseUnitQty,
        is_base: l.isBase,
        can_pick: l.canPick,
        can_store: l.canStore,
        is_default_pick_uom: l.isDefaultPickUom,
        barcode: l.barcode ?? null,
        pack_weight_g: l.packWeightG ?? null,
        pack_width_mm: l.packWidthMm ?? null,
        pack_height_mm: l.packHeightMm ?? null,
        pack_depth_mm: l.packDepthMm ?? null,
        sort_order: l.sortOrder,
        is_active: l.isActive
      }));

      const { data, error } = await supabase.rpc(
        'replace_product_packaging_levels',
        { product_uuid: productId, levels_json: levelsJson }
      );

      if (error) {
        throw mapPackagingRpcError(error as { message?: string } | null) ?? error;
      }

      return ((data ?? []) as PackagingLevelRow[]).map(mapPackagingLevelRowToDomain);
    }
  };
}
