import type { ProductAwareRow } from '../../inventory-product-resolution.js';

export type OperationsInventoryStatus = 'available' | 'reserved' | 'damaged' | 'hold' | null;
export type OperationsCellStatus = 'empty' | 'stocked' | 'pick_active' | 'reserved' | 'quarantined';

export type OperationsCellStorageRow = ProductAwareRow & {
  tenant_id: string;
  floor_id: string;
  location_id: string;
  location_code: string;
  location_type: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer';
  cell_id: string | null;
  container_id: string;
  external_code: string | null;
  container_type: string;
  container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  placed_at: string;
  product_id?: string | null;
  quantity: number | null;
  uom: string | null;
  inventory_status?: OperationsInventoryStatus;
};
