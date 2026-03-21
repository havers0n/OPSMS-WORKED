import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createInventoryRepo,
  type ReceiveInventoryUnitParams,
  type ReceiveInventoryUnitResult
} from './repo.js';

export type InventoryService = {
  receiveInventoryUnit(params: ReceiveInventoryUnitParams): Promise<ReceiveInventoryUnitResult>;
};

export function createInventoryService(supabase: SupabaseClient): InventoryService {
  const repo = createInventoryRepo(supabase);
  return {
    receiveInventoryUnit: (params) => repo.receiveInventoryUnit(params)
  };
}
