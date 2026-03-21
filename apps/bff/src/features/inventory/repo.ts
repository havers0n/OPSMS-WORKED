import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { mapReceiveInventoryRpcError } from './errors.js';

const receiveInventoryUnitRpcResultSchema = z.object({
  inventoryUnit: z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    container_id: z.string().uuid(),
    product_id: z.string().uuid(),
    quantity: z.number(),
    uom: z.string(),
    created_at: z.string(),
    created_by: z.string().uuid().nullable()
  }),
  product: z.object({
    id: z.string().uuid(),
    source: z.string(),
    external_product_id: z.string(),
    sku: z.string().nullable(),
    name: z.string(),
    permalink: z.string().nullable(),
    image_urls: z.unknown(),
    image_files: z.unknown(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string()
  })
});

export type ReceiveInventoryUnitResult = z.infer<typeof receiveInventoryUnitRpcResultSchema>;

export type ReceiveInventoryUnitParams = {
  tenantId: string;
  containerId: string;
  productId: string;
  quantity: number;
  uom: string;
  actorId: string;
};

export type InventoryRepo = {
  receiveInventoryUnit(params: ReceiveInventoryUnitParams): Promise<ReceiveInventoryUnitResult>;
};

export function createInventoryRepo(supabase: SupabaseClient): InventoryRepo {
  return {
    async receiveInventoryUnit(params) {
      const { data, error } = await supabase.rpc('receive_inventory_unit', {
        tenant_uuid: params.tenantId,
        container_uuid: params.containerId,
        product_uuid: params.productId,
        quantity: params.quantity,
        uom: params.uom,
        actor_uuid: params.actorId
      });

      if (error) {
        throw mapReceiveInventoryRpcError(error as { message?: string } | null) ?? error;
      }

      return receiveInventoryUnitRpcResultSchema.parse(data);
    }
  };
}
