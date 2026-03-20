import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  ExecutionContainerNotFoundError,
  ExecutionContainerNotPlacedError,
  ExecutionInventoryUnitNotFoundError,
  ExecutionInvalidSplitQuantityError,
  ExecutionSerialSplitNotAllowedError,
  ExecutionTargetContainerNotFoundError,
  ExecutionTargetContainerSameAsSourceError,
  ExecutionTargetContainerTenantMismatchError,
  ExecutionTargetLocationDimensionOverflowError,
  ExecutionTargetLocationDimensionUnknownError,
  ExecutionTargetLocationNotActiveError,
  ExecutionTargetLocationNotFoundError,
  ExecutionTargetLocationOccupiedError,
  ExecutionTargetLocationSameAsSourceError,
  ExecutionTargetLocationTenantMismatchError,
  ExecutionTargetLocationWeightOverflowError,
  ExecutionTargetLocationWeightUnknownError
} from './errors.js';

type SupabaseLikeError = {
  code?: string;
  message?: string;
};

const canonicalSplitResultSchema = z.object({
  sourceInventoryUnitId: z.string().uuid(),
  targetInventoryUnitId: z.string().uuid(),
  sourceContainerId: z.string().uuid(),
  targetContainerId: z.string().uuid(),
  sourceLocationId: z.string().uuid().nullable(),
  targetLocationId: z.string().uuid().nullable(),
  quantity: z.number().positive(),
  uom: z.string().trim().min(1),
  mergeApplied: z.boolean(),
  sourceQuantity: z.number().min(0),
  targetQuantity: z.number().min(0),
  movementId: z.string().uuid(),
  occurredAt: z.string()
});

const canonicalTransferResultSchema = canonicalSplitResultSchema.extend({
  splitMovementId: z.string().uuid(),
  transferMovementId: z.string().uuid()
});

const canonicalMoveResultSchema = z.object({
  containerId: z.string().uuid(),
  sourceLocationId: z.string().uuid().nullable(),
  targetLocationId: z.string().uuid(),
  movementId: z.string().uuid(),
  occurredAt: z.string()
});

export type CanonicalSplitResult = z.infer<typeof canonicalSplitResultSchema>;
export type CanonicalTransferResult = z.infer<typeof canonicalTransferResultSchema>;
export type CanonicalMoveResult = z.infer<typeof canonicalMoveResultSchema>;

function mapExecutionRpcError(error: SupabaseLikeError): Error | null {
  if (error.code !== 'P0001') {
    return null;
  }

  switch (error.message) {
    case 'CONTAINER_NOT_FOUND':
      return new ExecutionContainerNotFoundError();
    case 'CONTAINER_NOT_PLACED':
      return new ExecutionContainerNotPlacedError();
    case 'SOURCE_INVENTORY_UNIT_NOT_FOUND':
      return new ExecutionInventoryUnitNotFoundError();
    case 'INVALID_SPLIT_QUANTITY':
      return new ExecutionInvalidSplitQuantityError();
    case 'SERIAL_SPLIT_NOT_ALLOWED':
      return new ExecutionSerialSplitNotAllowedError();
    case 'TARGET_CONTAINER_NOT_FOUND':
      return new ExecutionTargetContainerNotFoundError();
    case 'TARGET_CONTAINER_TENANT_MISMATCH':
      return new ExecutionTargetContainerTenantMismatchError();
    case 'TARGET_CONTAINER_SAME_AS_SOURCE_CONTAINER':
      return new ExecutionTargetContainerSameAsSourceError();
    case 'TARGET_LOCATION_NOT_FOUND':
    case 'LOCATION_NOT_FOUND':
      return new ExecutionTargetLocationNotFoundError();
    case 'TENANT_MISMATCH':
      return new ExecutionTargetLocationTenantMismatchError();
    case 'TARGET_LOCATION_NOT_ACTIVE':
    case 'LOCATION_NOT_ACTIVE':
      return new ExecutionTargetLocationNotActiveError();
    case 'TARGET_LOCATION_OCCUPIED':
    case 'LOCATION_OCCUPIED':
      return new ExecutionTargetLocationOccupiedError();
    case 'CONTAINER_ALREADY_IN_TARGET_CELL':
    case 'SAME_LOCATION':
      return new ExecutionTargetLocationSameAsSourceError();
    case 'LOCATION_DIMENSION_UNKNOWN':
      return new ExecutionTargetLocationDimensionUnknownError();
    case 'LOCATION_DIMENSION_OVERFLOW':
      return new ExecutionTargetLocationDimensionOverflowError();
    case 'LOCATION_WEIGHT_UNKNOWN':
      return new ExecutionTargetLocationWeightUnknownError();
    case 'LOCATION_WEIGHT_OVERFLOW':
      return new ExecutionTargetLocationWeightOverflowError();
    default:
      return null;
  }
}

export type ExecutionRepo = {
  moveContainerCanonical(containerId: string, targetLocationId: string, actorId?: string | null): Promise<CanonicalMoveResult>;
  splitInventoryUnit(
    inventoryUnitId: string,
    quantity: number,
    targetContainerId: string,
    actorId?: string | null
  ): Promise<CanonicalSplitResult>;
  transferInventoryUnit(
    inventoryUnitId: string,
    quantity: number,
    targetContainerId: string,
    actorId?: string | null
  ): Promise<CanonicalTransferResult>;
  pickPartialInventoryUnit(
    inventoryUnitId: string,
    quantity: number,
    pickContainerId: string,
    actorId?: string | null
  ): Promise<CanonicalTransferResult>;
};

export function createExecutionRepo(supabase: SupabaseClient): ExecutionRepo {
  return {
    async moveContainerCanonical(containerId, targetLocationId, actorId) {
      const { data, error } = await supabase.rpc('move_container_canonical', {
        container_uuid: containerId,
        target_location_uuid: targetLocationId,
        actor_uuid: actorId ?? null
      });

      if (error) {
        throw mapExecutionRpcError(error) ?? error;
      }

      return canonicalMoveResultSchema.parse(data);
    },

    async splitInventoryUnit(inventoryUnitId, quantity, targetContainerId, actorId) {
      const { data, error } = await supabase.rpc('split_inventory_unit', {
        source_inventory_unit_uuid: inventoryUnitId,
        split_quantity: quantity,
        target_container_uuid: targetContainerId,
        actor_uuid: actorId ?? null
      });

      if (error) {
        throw mapExecutionRpcError(error) ?? error;
      }

      return canonicalSplitResultSchema.parse(data);
    },

    async transferInventoryUnit(inventoryUnitId, quantity, targetContainerId, actorId) {
      const { data, error } = await supabase.rpc('transfer_inventory_unit', {
        source_inventory_unit_uuid: inventoryUnitId,
        quantity,
        target_container_uuid: targetContainerId,
        actor_uuid: actorId ?? null
      });

      if (error) {
        throw mapExecutionRpcError(error) ?? error;
      }

      return canonicalTransferResultSchema.parse(data);
    },

    async pickPartialInventoryUnit(inventoryUnitId, quantity, pickContainerId, actorId) {
      const { data, error } = await supabase.rpc('pick_partial_inventory_unit', {
        source_inventory_unit_uuid: inventoryUnitId,
        quantity,
        pick_container_uuid: pickContainerId,
        actor_uuid: actorId ?? null
      });

      if (error) {
        throw mapExecutionRpcError(error) ?? error;
      }

      return canonicalTransferResultSchema.parse(data);
    }
  };
}
