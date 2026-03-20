import type { SupabaseClient } from '@supabase/supabase-js';
import { createExecutionRepo, type CanonicalMoveResult, type CanonicalSplitResult, type CanonicalTransferResult, type ExecutionRepo } from './execution-repo.js';

export type MoveContainerCanonicalCommand = {
  containerId: string;
  targetLocationId: string;
  actorId?: string | null;
};

export type SplitInventoryUnitCommand = {
  inventoryUnitId: string;
  quantity: number;
  targetContainerId: string;
  actorId?: string | null;
};

export type TransferStockCommand = {
  inventoryUnitId: string;
  quantity: number;
  targetContainerId: string;
  actorId?: string | null;
};

export type PickPartialCommand = {
  inventoryUnitId: string;
  quantity: number;
  pickContainerId: string;
  actorId?: string | null;
};

export type ExecutionService = {
  moveContainerCanonical(command: MoveContainerCanonicalCommand): Promise<CanonicalMoveResult>;
  splitInventoryUnit(command: SplitInventoryUnitCommand): Promise<CanonicalSplitResult>;
  transferStock(command: TransferStockCommand): Promise<CanonicalTransferResult>;
  pickPartial(command: PickPartialCommand): Promise<CanonicalTransferResult>;
};

export function createExecutionServiceFromRepo(repo: ExecutionRepo): ExecutionService {
  return {
    moveContainerCanonical: (command) =>
      repo.moveContainerCanonical(command.containerId, command.targetLocationId, command.actorId),
    splitInventoryUnit: (command) =>
      repo.splitInventoryUnit(command.inventoryUnitId, command.quantity, command.targetContainerId, command.actorId),
    transferStock: (command) =>
      repo.transferInventoryUnit(command.inventoryUnitId, command.quantity, command.targetContainerId, command.actorId),
    pickPartial: (command) =>
      repo.pickPartialInventoryUnit(command.inventoryUnitId, command.quantity, command.pickContainerId, command.actorId)
  };
}

export function createExecutionService(supabase: SupabaseClient): ExecutionService {
  return createExecutionServiceFromRepo(createExecutionRepo(supabase));
}
