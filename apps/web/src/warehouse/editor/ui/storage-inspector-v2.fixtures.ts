/**
 * StorageInspectorV2 Placeholder Fixtures
 *
 * Additional detail/inventory metadata for the V2 inspector, keyed by locationId.
 *
 * This file intentionally does NOT duplicate occupancy status or containerId —
 * those come from `storage-navigator.fixtures.ts` (mockLocationsByLevel) via
 * a lookup by locationId. This file only extends each location with:
 *   - slot metadata (type, capacityMode, policy, retentionDays)
 *   - inventory items (non-empty only for occupied locations)
 *
 * Real data loading deferred to a future PR.
 */

export interface InventoryItem {
  sku: string;
  description: string;
  qty: number;
}

export interface LocationDetail {
  type: string;
  capacityMode: string;
  policy: string;
  retentionDays: number;
  inventory: InventoryItem[];
}

/**
 * Extended detail for each location in the navigator fixture set.
 * Keyed by locationId (same IDs used in mockLocationsByLevel).
 */
export const locationDetailFixtures: Record<string, LocationDetail> = {
  // ── Level 1 ──────────────────────────────────────────────────────────────
  '01-A.02.01': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.02.02': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'SKU Type A only',
    retentionDays: 30,
    inventory: [
      { sku: 'SKU-001', description: 'Widget Alpha', qty: 12 },
      { sku: 'SKU-002', description: 'Widget Beta', qty: 8 },
    ],
  },
  '01-A.02.03': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.02.04': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'SKU Type B only',
    retentionDays: 60,
    inventory: [
      { sku: 'SKU-007', description: 'Component Gamma', qty: 24 },
      { sku: 'SKU-008', description: 'Component Delta', qty: 16 },
      { sku: 'SKU-009', description: 'Component Epsilon', qty: 4 },
    ],
  },
  '01-A.02.05': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.02.06': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'Restricted',
    retentionDays: 14,
    inventory: [],
  },
  '01-A.02.07': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.02.08': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [{ sku: 'SKU-003', description: 'Part Zeta', qty: 6 }],
  },
  '01-A.02.09': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },

  // ── Level 2 ──────────────────────────────────────────────────────────────
  '01-A.03.01': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'Cold Storage',
    retentionDays: 7,
    inventory: [
      { sku: 'SKU-101', description: 'Refrigerated Item A', qty: 3 },
      { sku: 'SKU-102', description: 'Refrigerated Item B', qty: 7 },
      { sku: 'SKU-103', description: 'Refrigerated Item C', qty: 2 },
    ],
  },
  '01-A.03.02': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.03.03': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.03.04': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'SKU Type A only',
    retentionDays: 30,
    inventory: [
      { sku: 'SKU-201', description: 'Product Upsilon', qty: 15 },
      { sku: 'SKU-202', description: 'Product Phi', qty: 9 },
    ],
  },
  '01-A.03.05': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.03.06': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'Restricted',
    retentionDays: 14,
    inventory: [],
  },
  '01-A.03.07': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.03.08': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.03.09': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [{ sku: 'SKU-301', description: 'Item Omega', qty: 20 }],
  },
  '01-A.03.10': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },

  // ── Level 3 ──────────────────────────────────────────────────────────────
  '01-A.04.01': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.04.02': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.04.03': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'Hazmat',
    retentionDays: 90,
    inventory: [
      { sku: 'SKU-401', description: 'Chemical M', qty: 2 },
      { sku: 'SKU-402', description: 'Chemical N', qty: 1 },
    ],
  },
  '01-A.04.04': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'Restricted',
    retentionDays: 14,
    inventory: [],
  },
  '01-A.04.05': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.04.06': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [
      { sku: 'SKU-501', description: 'Pallet Item P', qty: 18 },
      { sku: 'SKU-502', description: 'Pallet Item Q', qty: 12 },
      { sku: 'SKU-503', description: 'Pallet Item R', qty: 5 },
    ],
  },
  '01-A.04.07': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.04.08': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'General',
    retentionDays: 30,
    inventory: [],
  },
  '01-A.04.09': {
    type: 'Rack Slot',
    capacityMode: 'Single Container',
    policy: 'SKU Type B only',
    retentionDays: 60,
    inventory: [
      { sku: 'SKU-601', description: 'Unit S', qty: 4 },
      { sku: 'SKU-602', description: 'Unit T', qty: 11 },
    ],
  },
};
