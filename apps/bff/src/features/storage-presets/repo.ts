import type { SupabaseClient } from '@supabase/supabase-js';
import {
  storagePresetSchema,
  createContainerFromStoragePresetResultSchema,
  type CreateStoragePresetBody,
  type PatchStoragePresetBody,
  type StoragePreset,
  type CreateContainerFromStoragePresetResult
} from '@wos/domain';

type PackagingProfileRow = {
  id: string;
  tenant_id: string;
  product_id: string;
  code: string;
  name: string;
  profile_type: 'legacy_bridge' | 'receiving' | 'storage';
  scope_type: 'tenant' | 'location';
  scope_id: string;
  valid_from: string | null;
  valid_to: string | null;
  priority: number;
  is_default: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

type PackagingProfileLevelRow = {
  id: string;
  profile_id: string;
  level_type: string;
  qty_each: number;
  parent_level_type: string | null;
  qty_per_parent: number | null;
  container_type: string | null;
  tare_weight_g: number | null;
  nominal_gross_weight_g: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  cases_per_tier: number | null;
  tiers_per_pallet: number | null;
  max_stack_height: number | null;
  max_stack_weight: number | null;
  legacy_product_packaging_level_id: string | null;
  created_at: string;
  updated_at: string;
};

type SkuLocationPolicyRow = {
  id: string;
  tenant_id: string;
  location_id: string;
  product_id: string;
  min_qty_each: number | null;
  max_qty_each: number | null;
  preferred_packaging_profile_id: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type SkuLocationStoragePolicy = {
  id: string;
  tenantId: string;
  locationId: string;
  productId: string;
  minQtyEach: number | null;
  maxQtyEach: number | null;
  preferredPackagingProfileId: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

export type StoragePresetsRepo = {
  listByProduct(tenantId: string, productId: string): Promise<StoragePreset[]>;
  create(tenantId: string, productId: string, input: CreateStoragePresetBody): Promise<StoragePreset>;
  patch(tenantId: string, productId: string, presetId: string, input: PatchStoragePresetBody): Promise<StoragePreset>;
  setPreferredPolicy(
    tenantId: string,
    locationId: string,
    productId: string,
    preferredPackagingProfileId: string | null
  ): Promise<SkuLocationStoragePolicy>;
  activeStoragePresetExists(tenantId: string, productId: string, presetId: string): Promise<boolean>;
  createContainerFromPreset(args: {
    presetId: string;
    locationId?: string;
    externalCode?: string;
    materializeContents?: boolean;
    actorId: string;
  }): Promise<CreateContainerFromStoragePresetResult>;
};

type MaterializeStoragePresetContentsResult = {
  inventoryUnit?: {
    id?: string;
    quantity?: number;
    container_line_id?: string | null;
  };
};

const profileColumns =
  'id,tenant_id,product_id,code,name,profile_type,scope_type,scope_id,valid_from,valid_to,priority,is_default,status,created_at,updated_at';

const levelColumns =
  'id,profile_id,level_type,qty_each,parent_level_type,qty_per_parent,container_type,tare_weight_g,nominal_gross_weight_g,length_mm,width_mm,height_mm,cases_per_tier,tiers_per_pallet,max_stack_height,max_stack_weight,legacy_product_packaging_level_id,created_at,updated_at';

function mapLevel(row: PackagingProfileLevelRow) {
  return {
    id: row.id,
    profileId: row.profile_id,
    levelType: row.level_type,
    qtyEach: row.qty_each,
    parentLevelType: row.parent_level_type,
    qtyPerParent: row.qty_per_parent,
    containerType: row.container_type,
    tareWeightG: row.tare_weight_g,
    nominalGrossWeightG: row.nominal_gross_weight_g,
    lengthMm: row.length_mm,
    widthMm: row.width_mm,
    heightMm: row.height_mm,
    casesPerTier: row.cases_per_tier,
    tiersPerPallet: row.tiers_per_pallet,
    maxStackHeight: row.max_stack_height,
    maxStackWeight: row.max_stack_weight,
    legacyProductPackagingLevelId: row.legacy_product_packaging_level_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPreset(row: PackagingProfileRow, levels: PackagingProfileLevelRow[]): StoragePreset {
  return storagePresetSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    productId: row.product_id,
    code: row.code,
    name: row.name,
    profileType: row.profile_type,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    priority: row.priority,
    isDefault: row.is_default,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    levels: levels.map(mapLevel)
  });
}

function mapPolicy(row: SkuLocationPolicyRow): SkuLocationStoragePolicy {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id,
    productId: row.product_id,
    minQtyEach: row.min_qty_each,
    maxQtyEach: row.max_qty_each,
    preferredPackagingProfileId: row.preferred_packaging_profile_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadPreset(supabase: SupabaseClient, presetId: string): Promise<StoragePreset> {
  const { data: profile, error: profileError } = await supabase
    .from('packaging_profiles')
    .select(profileColumns)
    .eq('id', presetId)
    .eq('profile_type', 'storage')
    .single();

  if (profileError) throw profileError;

  const { data: levels, error: levelsError } = await supabase
    .from('packaging_profile_levels')
    .select(levelColumns)
    .eq('profile_id', presetId)
    .order('qty_each', { ascending: false });

  if (levelsError) throw levelsError;
  return mapPreset(profile as PackagingProfileRow, (levels ?? []) as PackagingProfileLevelRow[]);
}

async function resolveNextPriority(supabase: SupabaseClient, args: {
  tenantId: string;
  productId: string;
  scopeType: 'tenant' | 'location';
  scopeId: string;
}) {
  const { data, error } = await supabase
    .from('packaging_profiles')
    .select('priority')
    .eq('tenant_id', args.tenantId)
    .eq('product_id', args.productId)
    .eq('scope_type', args.scopeType)
    .eq('scope_id', args.scopeId)
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .limit(1);

  if (error) throw error;
  const maxPriority = (data?.[0] as { priority?: number } | undefined)?.priority;
  return typeof maxPriority === 'number' ? maxPriority + 1 : 0;
}

function getStoragePresetMaterializationError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? error);
  if (message.includes('STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED')) {
    return {
      code: 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED',
      message: 'Storage preset must have exactly one materializable level for this phase.'
    };
  }
  if (message.includes('STORAGE_PRESET_CONTAINER_NOT_EMPTY')) {
    return {
      code: 'STORAGE_PRESET_CONTAINER_NOT_EMPTY',
      message: 'Storage preset shell already contains inventory.'
    };
  }
  if (message.includes('STORAGE_PRESET_CONTAINER_MISMATCH')) {
    return {
      code: 'STORAGE_PRESET_CONTAINER_MISMATCH',
      message: 'Storage preset shell does not match the selected preset.'
    };
  }
  return {
    code: 'STORAGE_PRESET_MATERIALIZATION_FAILED',
    message: 'Preset contents materialization failed.'
  };
}

export function createStoragePresetsRepo(supabase: SupabaseClient): StoragePresetsRepo {
  return {
    async listByProduct(tenantId, productId) {
      const { data: profiles, error } = await supabase
        .from('packaging_profiles')
        .select(profileColumns)
        .eq('tenant_id', tenantId)
        .eq('product_id', productId)
        .eq('profile_type', 'storage')
        .order('priority', { ascending: false })
        .order('code', { ascending: true });

      if (error) throw error;
      const profileRows = (profiles ?? []) as PackagingProfileRow[];
      if (profileRows.length === 0) return [];

      const { data: levels, error: levelsError } = await supabase
        .from('packaging_profile_levels')
        .select(levelColumns)
        .in('profile_id', profileRows.map((row) => row.id))
        .order('qty_each', { ascending: false });

      if (levelsError) throw levelsError;
      const levelsByProfile = new Map<string, PackagingProfileLevelRow[]>();
      for (const level of (levels ?? []) as PackagingProfileLevelRow[]) {
        const existing = levelsByProfile.get(level.profile_id) ?? [];
        existing.push(level);
        levelsByProfile.set(level.profile_id, existing);
      }

      return profileRows.map((profile) => mapPreset(profile, levelsByProfile.get(profile.id) ?? []));
    },

    async create(tenantId, productId, input) {
      const scopeType = input.scopeType ?? 'tenant';
      const scopeId = input.scopeId ?? tenantId;
      const priority = input.priority ?? await resolveNextPriority(supabase, {
        tenantId,
        productId,
        scopeType,
        scopeId
      });

      const { data: profile, error } = await supabase
        .from('packaging_profiles')
        .insert({
          tenant_id: tenantId,
          product_id: productId,
          code: input.code,
          name: input.name,
          profile_type: 'storage',
          scope_type: scopeType,
          scope_id: scopeId,
          priority,
          is_default: input.isDefault,
          status: input.status
        })
        .select('id')
        .single();

      if (error) throw error;
      const profileId = (profile as { id: string }).id;

      const { error: levelsError } = await supabase.from('packaging_profile_levels').insert(
        input.levels.map((level) => ({
          profile_id: profileId,
          level_type: level.levelType,
          qty_each: level.qtyEach,
          parent_level_type: level.parentLevelType ?? null,
          qty_per_parent: level.qtyPerParent ?? null,
          container_type: level.containerType ?? null,
          legacy_product_packaging_level_id: level.legacyProductPackagingLevelId ?? null
        }))
      );

      if (levelsError) throw levelsError;
      return loadPreset(supabase, profileId);
    },

    async patch(tenantId, productId, presetId, input) {
      const profileUpdates: Record<string, unknown> = {};
      if (input.code !== undefined) profileUpdates.code = input.code;
      if (input.name !== undefined) profileUpdates.name = input.name;
      if (input.scopeType !== undefined) profileUpdates.scope_type = input.scopeType;
      if (input.scopeId !== undefined) profileUpdates.scope_id = input.scopeId ?? tenantId;
      if (input.priority !== undefined) profileUpdates.priority = input.priority;
      if (input.isDefault !== undefined) profileUpdates.is_default = input.isDefault;
      if (input.status !== undefined) profileUpdates.status = input.status;

      if (Object.keys(profileUpdates).length > 0) {
        const { data, error } = await supabase
          .from('packaging_profiles')
          .update(profileUpdates)
          .eq('id', presetId)
          .eq('tenant_id', tenantId)
          .eq('product_id', productId)
          .eq('profile_type', 'storage')
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('STORAGE_PRESET_NOT_FOUND');
      }

      if (input.levels !== undefined) {
        const { error: deleteError } = await supabase
          .from('packaging_profile_levels')
          .delete()
          .eq('profile_id', presetId);
        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase.from('packaging_profile_levels').insert(
          input.levels.map((level) => ({
            profile_id: presetId,
            level_type: level.levelType,
            qty_each: level.qtyEach,
            parent_level_type: level.parentLevelType ?? null,
            qty_per_parent: level.qtyPerParent ?? null,
            container_type: level.containerType ?? null,
            legacy_product_packaging_level_id: level.legacyProductPackagingLevelId ?? null
          }))
        );
        if (insertError) throw insertError;
      }

      return loadPreset(supabase, presetId);
    },

    async setPreferredPolicy(tenantId, locationId, productId, preferredPackagingProfileId) {
      const { data, error } = await supabase
        .from('sku_location_policies')
        .upsert(
          {
            tenant_id: tenantId,
            location_id: locationId,
            product_id: productId,
            preferred_packaging_profile_id: preferredPackagingProfileId,
            status: 'active'
          },
          { onConflict: 'tenant_id,location_id,product_id' }
        )
        .select('id,tenant_id,location_id,product_id,min_qty_each,max_qty_each,preferred_packaging_profile_id,status,created_at,updated_at')
        .single();

      if (error) throw error;
      return mapPolicy(data as SkuLocationPolicyRow);
    },

    async activeStoragePresetExists(tenantId, productId, presetId) {
      const { data, error } = await supabase
        .from('packaging_profiles')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('product_id', productId)
        .eq('id', presetId)
        .eq('profile_type', 'storage')
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      return Boolean(data);
    },

    async createContainerFromPreset(args) {
      const { data, error } = await supabase.rpc('create_container_from_storage_preset', {
        packaging_profile_uuid: args.presetId,
        location_uuid: args.locationId ?? null,
        external_code_input: args.externalCode ?? null,
        actor_uuid: args.actorId,
        materialize_contents_input: false
      });

      if (error) throw error;
      const shellResult = createContainerFromStoragePresetResultSchema.parse(data);
      if (!args.materializeContents) {
        return createContainerFromStoragePresetResultSchema.parse({
          ...shellResult,
          materializationStatus: 'shell',
          materializationErrorCode: null,
          materializationErrorMessage: null
        });
      }

      try {
        const { data: materialized, error: materializeError } = await supabase.rpc(
          'materialize_storage_preset_container_contents',
          {
            packaging_profile_uuid: args.presetId,
            container_uuid: shellResult.containerId,
            actor_uuid: args.actorId
          }
        );

        if (materializeError) throw materializeError;
        const materializedResult = materialized as MaterializeStoragePresetContentsResult;
        const inventoryUnit = materializedResult.inventoryUnit;

        return createContainerFromStoragePresetResultSchema.parse({
          ...shellResult,
          materializationMode: 'materialized',
          materializationStatus: 'materialized',
          materializationErrorCode: null,
          materializationErrorMessage: null,
          materializedInventoryUnitId: inventoryUnit?.id ?? null,
          materializedContainerLineId: inventoryUnit?.container_line_id ?? null,
          materializedQuantity: inventoryUnit?.quantity ?? null
        });
      } catch (error) {
        const materializationError = getStoragePresetMaterializationError(error);
        return createContainerFromStoragePresetResultSchema.parse({
          ...shellResult,
          materializationMode: 'shell',
          materializationStatus: 'partial_failed',
          materializationErrorCode: materializationError.code,
          materializationErrorMessage: materializationError.message,
          materializedInventoryUnitId: null,
          materializedContainerLineId: null,
          materializedQuantity: null
        });
      }
    }
  };
}
