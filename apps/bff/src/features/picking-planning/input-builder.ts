import { createPlanningWarning, type PickTaskCandidate, type PlanningWarning, type PlanningWarningCode, type StorageLocationProjection } from '@wos/domain';
import { mapStorageLocationProjection, type StorageLocationProjectionRow } from '../location-read/storage-location-projection.js';

const SUPPORTED_UNIT_UOMS = new Set(['ea', 'each', 'unit', 'pcs', 'piece']);

type OrderLinePlanningRow = {
  order_id: string;
  id: string;
  product_id: string | null;
  sku: string;
  qty_required: number;
  qty_picked: number;
};

type ProductPlanningRow = {
  id: string;
  sku: string | null;
};

type ProductUnitProfilePlanningRow = {
  product_id: string;
  unit_weight_g: number | null;
  unit_width_mm: number | null;
  unit_height_mm: number | null;
  unit_depth_mm: number | null;
  weight_class: 'light' | 'medium' | 'heavy' | 'very_heavy' | null;
  size_class: 'small' | 'medium' | 'large' | 'oversized' | null;
};

type ProductPackagingLevelPlanningRow = {
  product_id: string;
  base_unit_qty: number;
  is_default_pick_uom: boolean;
  is_base: boolean;
  can_pick: boolean;
  is_active: boolean;
  pack_weight_g: number | null;
  pack_width_mm: number | null;
  pack_height_mm: number | null;
  pack_depth_mm: number | null;
};

type ProductPrimaryPickLocationRow = {
  product_id: string;
  location_id: string;
};

type InventoryUnitPlanningRow = {
  id: string;
  product_id: string;
  container_id: string;
  quantity: number;
  uom: string;
  created_at: string;
};

type ContainerLocationRow = {
  id: string;
  current_location_id: string | null;
};

type InventoryAllocationLedger = {
  remainingByInventoryUnitId: Map<string, number>;
  allocatedByInventoryUnitId: Map<string, number>;
};

type StagedInventoryAllocation = {
  inventoryUnitId: string;
  locationId: string;
  qty: number;
};

export type BuildPlanningInputFromOrdersRequest = {
  orderIds: string[];
};

export type UnresolvedPlanningLine = {
  orderId: string;
  orderLineId: string;
  skuId?: string;
  productId?: string;
  qty: number;
  reason:
    | 'missing_order_line'
    | 'missing_product'
    | 'no_primary_pick_location'
    | 'no_available_inventory'
    | 'missing_source_location'
    | 'missing_quantity'
    | 'unsupported_uom';
  message: string;
};

export type BuildPlanningInputFromOrdersResult = {
  tasks: PickTaskCandidate[];
  locationsById: Record<string, StorageLocationProjection>;
  unresolved: UnresolvedPlanningLine[];
  warnings: string[];
  warningDetails: PlanningWarning[];
};

export type PickingPlanningOrderInputReadRepo = {
  listOrderLines(orderIds: string[]): Promise<OrderLinePlanningRow[]>;
  listProducts(productIds: string[]): Promise<ProductPlanningRow[]>;
  listUnitProfiles(productIds: string[]): Promise<ProductUnitProfilePlanningRow[]>;
  listPackagingLevels(productIds: string[]): Promise<ProductPackagingLevelPlanningRow[]>;
  listPrimaryPickLocations(productIds: string[]): Promise<ProductPrimaryPickLocationRow[]>;
  listInventoryUnits(productIds: string[]): Promise<InventoryUnitPlanningRow[]>;
  listContainerLocations(containerIds: string[]): Promise<ContainerLocationRow[]>;
  listLocations(locationIds: string[]): Promise<StorageLocationProjectionRow[]>;
};

function toUnique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function toUnitWeightG(profile: ProductUnitProfilePlanningRow | undefined, packLevel: ProductPackagingLevelPlanningRow | undefined): number | undefined {
  if (profile?.unit_weight_g != null) return profile.unit_weight_g;
  if (!packLevel?.pack_weight_g) return undefined;
  return packLevel.pack_weight_g / packLevel.base_unit_qty;
}

function toUnitVolumeMm3(profile: ProductUnitProfilePlanningRow | undefined, packLevel: ProductPackagingLevelPlanningRow | undefined): number | undefined {
  if (profile?.unit_width_mm && profile.unit_height_mm && profile.unit_depth_mm) {
    return profile.unit_width_mm * profile.unit_height_mm * profile.unit_depth_mm;
  }

  if (!(packLevel?.pack_width_mm && packLevel.pack_height_mm && packLevel.pack_depth_mm)) {
    return undefined;
  }

  return (packLevel.pack_width_mm * packLevel.pack_height_mm * packLevel.pack_depth_mm) / packLevel.base_unit_qty;
}

function resolveHandlingClass(profile: ProductUnitProfilePlanningRow | undefined): PickTaskCandidate['handlingClass'] {
  if (!profile) return undefined;
  if (profile.size_class === 'large' || profile.size_class === 'oversized') return 'bulky';
  if (profile.weight_class === 'heavy' || profile.weight_class === 'very_heavy') return 'heavy';
  return undefined;
}

function unresolvedReasonToWarningCode(reason: UnresolvedPlanningLine['reason']): PlanningWarningCode | undefined {
  switch (reason) {
    case 'missing_order_line':
      return 'MISSING_ORDER_LINE';
    case 'missing_product':
      return 'MISSING_PRODUCT';
    case 'no_primary_pick_location':
      return 'NO_PRIMARY_PICK_LOCATION';
    case 'no_available_inventory':
      return 'NO_AVAILABLE_INVENTORY';
    case 'missing_source_location':
      return 'MISSING_SOURCE_LOCATION';
    case 'unsupported_uom':
      return 'UNSUPPORTED_UOM';
    default:
      return undefined;
  }
}

function createUnresolvedPlanningWarning(line: UnresolvedPlanningLine): PlanningWarning | undefined {
  const code = unresolvedReasonToWarningCode(line.reason);
  if (!code) return undefined;

  return createPlanningWarning(code, line.message, {
    severity: 'error',
    source: 'builder',
    details: {
      orderId: line.orderId,
      orderLineId: line.orderLineId,
      productId: line.productId,
      skuId: line.skuId,
      qty: line.qty,
      reason: line.reason
    }
  });
}

function compareInventoryUnits(left: InventoryUnitPlanningRow, right: InventoryUnitPlanningRow): number {
  const createdAtOrder = left.created_at.localeCompare(right.created_at);
  if (createdAtOrder !== 0) return createdAtOrder;
  return left.id.localeCompare(right.id);
}

export async function buildPlanningInputFromOrders(
  repo: PickingPlanningOrderInputReadRepo,
  request: BuildPlanningInputFromOrdersRequest
): Promise<BuildPlanningInputFromOrdersResult> {
  const orderIds = toUnique(request.orderIds);
  const warnings: string[] = [];
  const warningDetails: PlanningWarning[] = [];
  const unresolved: UnresolvedPlanningLine[] = [];
  const tasks: PickTaskCandidate[] = [];

  if (orderIds.length === 0) {
    return { tasks, unresolved, warnings, warningDetails, locationsById: {} };
  }

  const lines = await repo.listOrderLines(orderIds);
  const linesByOrder = new Map<string, number>();
  for (const orderId of orderIds) linesByOrder.set(orderId, 0);
  for (const line of lines) linesByOrder.set(line.order_id, (linesByOrder.get(line.order_id) ?? 0) + 1);

  for (const [orderId, lineCount] of linesByOrder.entries()) {
    if (lineCount === 0) {
      const line = {
        orderId,
        orderLineId: 'missing',
        qty: 0,
        reason: 'missing_order_line',
        message: `Order ${orderId} has no order lines to plan.`
      } satisfies UnresolvedPlanningLine;
      unresolved.push(line);
      const warning = createUnresolvedPlanningWarning(line);
      if (warning) warningDetails.push(warning);
    }
  }

  const productIds = toUnique(lines.map((line) => line.product_id).filter((id): id is string => typeof id === 'string'));
  const [products, profiles, packagingLevels, primaryLocations, inventoryUnits] = await Promise.all([
    repo.listProducts(productIds),
    repo.listUnitProfiles(productIds),
    repo.listPackagingLevels(productIds),
    repo.listPrimaryPickLocations(productIds),
    repo.listInventoryUnits(productIds)
  ]);

  const productById = new Map(products.map((row) => [row.id, row]));
  const profileByProductId = new Map(profiles.map((row) => [row.product_id, row]));
  const pickPackLevelByProductId = new Map<string, ProductPackagingLevelPlanningRow>();
  for (const level of packagingLevels) {
    if (!level.is_active || !level.can_pick) continue;
    if (level.is_default_pick_uom) {
      pickPackLevelByProductId.set(level.product_id, level);
      continue;
    }

    if (!pickPackLevelByProductId.has(level.product_id) && level.is_base) {
      pickPackLevelByProductId.set(level.product_id, level);
    }
  }

  const primaryLocationsByProduct = new Map<string, string[]>();
  for (const row of primaryLocations) {
    const list = primaryLocationsByProduct.get(row.product_id);
    if (list) {
      list.push(row.location_id);
    } else {
      primaryLocationsByProduct.set(row.product_id, [row.location_id]);
    }
  }

  const containerIds = toUnique(inventoryUnits.map((row) => row.container_id));
  const containers = await repo.listContainerLocations(containerIds);
  const containerLocationById = new Map(containers.map((row) => [row.id, row.current_location_id]));

  const locationIdsFromPrimary = toUnique(primaryLocations.map((row) => row.location_id));
  const locations = await repo.listLocations(locationIdsFromPrimary);
  const locationById = new Map(locations.map((row) => [row.id, row]));

  const eligibleInventoryByProductAndLocation = new Map<string, InventoryUnitPlanningRow[]>();
  const allocationLedger: InventoryAllocationLedger = {
    remainingByInventoryUnitId: new Map(inventoryUnits.map((row) => [row.id, row.quantity])),
    allocatedByInventoryUnitId: new Map()
  };

  for (const unit of inventoryUnits) {
    const locationId = containerLocationById.get(unit.container_id);
    if (!locationId) continue;
    if (!locationById.has(locationId)) continue;
    const key = `${unit.product_id}:${locationId}`;
    const list = eligibleInventoryByProductAndLocation.get(key);
    if (list) {
      list.push(unit);
    } else {
      eligibleInventoryByProductAndLocation.set(key, [unit]);
    }
  }

  for (const line of lines) {
    const qtyToPlan = line.qty_required - line.qty_picked;
    if (qtyToPlan <= 0) {
      warnings.push(`Skipped order line ${line.id} because qty_required - qty_picked <= 0.`);
      continue;
    }

    if (!line.product_id) {
      const unresolvedLine = {
        orderId: line.order_id,
        orderLineId: line.id,
        skuId: line.sku,
        qty: qtyToPlan,
        reason: 'missing_product',
        message: `Order line ${line.id} has no product_id.`
      } satisfies UnresolvedPlanningLine;
      unresolved.push(unresolvedLine);
      const warning = createUnresolvedPlanningWarning(unresolvedLine);
      if (warning) warningDetails.push(warning);
      continue;
    }

    const product = productById.get(line.product_id);
    if (!product) {
      const unresolvedLine = {
        orderId: line.order_id,
        orderLineId: line.id,
        skuId: line.sku,
        productId: line.product_id,
        qty: qtyToPlan,
        reason: 'missing_product',
        message: `Product ${line.product_id} was not found.`
      } satisfies UnresolvedPlanningLine;
      unresolved.push(unresolvedLine);
      const warning = createUnresolvedPlanningWarning(unresolvedLine);
      if (warning) warningDetails.push(warning);
      continue;
    }

    const primaryPickLocationIds = primaryLocationsByProduct.get(line.product_id) ?? [];
    if (primaryPickLocationIds.length === 0) {
      const unresolvedLine = {
        orderId: line.order_id,
        orderLineId: line.id,
        skuId: product.sku ?? line.sku,
        productId: line.product_id,
        qty: qtyToPlan,
        reason: 'no_primary_pick_location',
        message: `No published primary_pick location is configured for product ${line.product_id}.`
      } satisfies UnresolvedPlanningLine;
      unresolved.push(unresolvedLine);
      const warning = createUnresolvedPlanningWarning(unresolvedLine);
      if (warning) warningDetails.push(warning);
      continue;
    }

    const stagedAllocations: StagedInventoryAllocation[] = [];
    let remainingQtyToStage = qtyToPlan;

    for (const locationId of primaryPickLocationIds) {
      const key = `${line.product_id}:${locationId}`;
      const eligible = (eligibleInventoryByProductAndLocation.get(key) ?? []).slice().sort(compareInventoryUnits);

      const withSupportedUom = eligible.filter((row) => SUPPORTED_UNIT_UOMS.has(row.uom.trim().toLowerCase()));

      for (const inventory of withSupportedUom) {
        const remainingInventoryQty = allocationLedger.remainingByInventoryUnitId.get(inventory.id) ?? 0;
        if (remainingInventoryQty <= 0) continue;

        const qty = Math.min(remainingQtyToStage, remainingInventoryQty);
        stagedAllocations.push({ inventoryUnitId: inventory.id, locationId, qty });
        remainingQtyToStage -= qty;

        if (remainingQtyToStage === 0) break;
      }

      if (remainingQtyToStage === 0) break;

      if (eligible.length > 0 && withSupportedUom.length === 0) {
        const unresolvedLine = {
          orderId: line.order_id,
          orderLineId: line.id,
          skuId: product.sku ?? line.sku,
          productId: line.product_id,
          qty: qtyToPlan,
          reason: 'unsupported_uom',
          message: `Inventory at location ${locationId} for product ${line.product_id} has unsupported UOMs.`
        } satisfies UnresolvedPlanningLine;
        unresolved.push(unresolvedLine);
        const warning = createUnresolvedPlanningWarning(unresolvedLine);
        if (warning) warningDetails.push(warning);
      }
    }

    if (remainingQtyToStage > 0) {
      const unresolvedLine = {
        orderId: line.order_id,
        orderLineId: line.id,
        skuId: product.sku ?? line.sku,
        productId: line.product_id,
        qty: qtyToPlan,
        reason: 'no_available_inventory',
        message: `No available inventory in primary_pick locations can satisfy qty ${qtyToPlan}.`
      } satisfies UnresolvedPlanningLine;
      unresolved.push(unresolvedLine);
      const warning = createUnresolvedPlanningWarning(unresolvedLine);
      if (warning) warningDetails.push(warning);
      continue;
    }

    const missingSourceLocationId = stagedAllocations.find((allocation) => !locationById.has(allocation.locationId))?.locationId;
    if (missingSourceLocationId) {
      const unresolvedLine = {
        orderId: line.order_id,
        orderLineId: line.id,
        skuId: product.sku ?? line.sku,
        productId: line.product_id,
        qty: qtyToPlan,
        reason: 'missing_source_location',
        message: `Source location ${missingSourceLocationId} could not be resolved.`
      } satisfies UnresolvedPlanningLine;
      unresolved.push(unresolvedLine);
      const warning = createUnresolvedPlanningWarning(unresolvedLine);
      if (warning) warningDetails.push(warning);
      continue;
    }

    const profile = profileByProductId.get(line.product_id);
    const packLevel = pickPackLevelByProductId.get(line.product_id);
    const unitWeightG = toUnitWeightG(profile, packLevel);
    const unitVolumeMm3 = toUnitVolumeMm3(profile, packLevel);

    if (unitWeightG == null) {
      const message = `Weight is missing for product ${line.product_id}; task ${line.id} weightKg left undefined.`;
      warnings.push(message);
      warningDetails.push(createPlanningWarning('UNKNOWN_WEIGHT', message, { source: 'builder', details: { productId: line.product_id, orderLineId: line.id } }));
    }

    if (unitVolumeMm3 == null) {
      const message = `Volume is missing for product ${line.product_id}; task ${line.id} volumeLiters left undefined.`;
      warnings.push(message);
      warningDetails.push(createPlanningWarning('UNKNOWN_VOLUME', message, { source: 'builder', details: { productId: line.product_id, orderLineId: line.id } }));
    }

    const skuId = product.sku ?? line.sku;
    for (const allocation of stagedAllocations) {
      const remainingInventoryQty = allocationLedger.remainingByInventoryUnitId.get(allocation.inventoryUnitId) ?? 0;
      allocationLedger.remainingByInventoryUnitId.set(allocation.inventoryUnitId, remainingInventoryQty - allocation.qty);
      allocationLedger.allocatedByInventoryUnitId.set(
        allocation.inventoryUnitId,
        (allocationLedger.allocatedByInventoryUnitId.get(allocation.inventoryUnitId) ?? 0) + allocation.qty
      );
    }

    const qtyByLocationId = new Map<string, number>();
    for (const allocation of stagedAllocations) {
      qtyByLocationId.set(allocation.locationId, (qtyByLocationId.get(allocation.locationId) ?? 0) + allocation.qty);
    }

    const locationAllocations = Array.from(qtyByLocationId.entries());
    for (const [index, [locationId, qty]] of locationAllocations.entries()) {
      tasks.push({
        id: locationAllocations.length === 1 ? `candidate-${line.order_id}-${line.id}` : `candidate-${line.order_id}-${line.id}-${index + 1}`,
        skuId,
        fromLocationId: locationId,
        qty,
        orderRefs: [{ orderId: line.order_id, orderLineId: line.id, qty }],
        weightKg: unitWeightG != null ? (unitWeightG * qty) / 1_000 : undefined,
        volumeLiters: unitVolumeMm3 != null ? (unitVolumeMm3 * qty) / 1_000_000 : undefined,
        handlingClass: resolveHandlingClass(profile)
      });
    }
  }

  const locationsById: Record<string, StorageLocationProjection> = {};
  for (const task of tasks) {
    const location = locationById.get(task.fromLocationId);
    if (!location) continue;
    locationsById[task.fromLocationId] = mapStorageLocationProjection(location);
  }

  return { tasks, locationsById, unresolved, warnings, warningDetails };
}
