import type { InventoryUnit } from './inventory-unit';

export function isSerialTrackedUnit(unit: Pick<InventoryUnit, 'serialNo'>): boolean {
  return unit.serialNo !== null;
}

export function sameTrackingIdentity(
  left: Pick<InventoryUnit, 'productId' | 'uom' | 'status' | 'lotCode' | 'serialNo' | 'expiryDate'>,
  right: Pick<InventoryUnit, 'productId' | 'uom' | 'status' | 'lotCode' | 'serialNo' | 'expiryDate'>
): boolean {
  return (
    left.productId === right.productId &&
    left.uom === right.uom &&
    left.status === right.status &&
    left.lotCode === right.lotCode &&
    left.serialNo === right.serialNo &&
    left.expiryDate === right.expiryDate
  );
}

export function canMergeInventoryUnits(
  left: Pick<InventoryUnit, 'containerId' | 'productId' | 'uom' | 'status' | 'lotCode' | 'serialNo' | 'expiryDate'>,
  right: Pick<InventoryUnit, 'containerId' | 'productId' | 'uom' | 'status' | 'lotCode' | 'serialNo' | 'expiryDate'>
): boolean {
  if (left.containerId !== right.containerId) {
    return false;
  }

  if (left.serialNo !== null || right.serialNo !== null) {
    return false;
  }

  return sameTrackingIdentity(left, right);
}

export function canSplitInventoryUnit(
  unit: Pick<InventoryUnit, 'quantity' | 'serialNo'>,
  quantity: number
): boolean {
  if (!Number.isFinite(quantity)) {
    return false;
  }

  if (quantity <= 0 || quantity >= unit.quantity) {
    return false;
  }

  if (isSerialTrackedUnit(unit)) {
    return false;
  }

  return true;
}
