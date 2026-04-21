import { describe, expect, it } from 'vitest';
import type { LocationStorageSnapshotRow } from '@wos/domain';
import {
  projectContainerDetail,
  resolveCellOverview,
  resolveEffectiveRoleProductId,
  resolveLocationCode,
  resolveRackDisplayCode
} from './use-storage-inspector-read-model.selectors';

const ACTIVE_PRODUCT_ID = '11111111-1111-1111-1111-111111111111';

function row(overrides: Partial<LocationStorageSnapshotRow>): LocationStorageSnapshotRow {
  return {
    locationId: 'loc-1',
    locationCode: 'LOC-1',
    locationType: 'rack_slot',
    containerId: 'c-1',
    containerStatus: 'stored',
    systemCode: 'SYS-1',
    externalCode: null,
    containerType: 'box',
    itemRef: null,
    quantity: null,
    uom: null,
    product: null,
    ...overrides
  } as LocationStorageSnapshotRow;
}

describe('use-storage-inspector-read-model.selectors', () => {
  it('resolves rack display code with fallback', () => {
    expect(resolveRackDisplayCode('rack-1', { 'rack-1': { displayCode: 'R-01' } as never })).toBe('R-01');
    expect(resolveRackDisplayCode('rack-2', { 'rack-1': { displayCode: 'R-01' } as never })).toBe('rack-2');
    expect(resolveRackDisplayCode(null, undefined)).toBe('-');
  });

  it('resolves location code from storage rows then falls back to cell address then cell id', () => {
    expect(
      resolveLocationCode({
        storageRows: [row({ locationCode: 'LOC-77' })],
        selectedCellAddress: '01-A.01.01',
        cellId: 'cell-1'
      })
    ).toBe('LOC-77');

    expect(
      resolveLocationCode({
        storageRows: [],
        selectedCellAddress: '01-A.01.01',
        cellId: 'cell-1'
      })
    ).toBe('01-A.01.01');

    expect(
      resolveLocationCode({
        storageRows: [],
        selectedCellAddress: null,
        cellId: 'cell-1'
      })
    ).toBe('cell-1');
  });

  it('returns null effective role product id outside role-aware contexts', () => {
    const storageRows = [row({ containerId: 'c-1' })];
    expect(resolveEffectiveRoleProductId({ selectedContainerId: null, taskKind: null, storageRows })).toBeNull();
    expect(
      resolveEffectiveRoleProductId({ selectedContainerId: 'c-1', taskKind: 'add-product-to-container', storageRows })
    ).toBeNull();
  });

  it('returns effective role product id for single active SKU in container', () => {
    const storageRows = [
      row({
        containerId: 'c-1',
        itemRef: 'INV-1',
        quantity: 1,
        uom: 'EA',
        product: {
          id: ACTIVE_PRODUCT_ID,
          source: 'internal',
          externalProductId: 'ext-1',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          name: 'SKU 1',
          sku: 'SKU-1',
          isActive: true,
          createdAt: '2020-01-01',
          updatedAt: '2020-01-01'
        }
      })
    ];

    expect(resolveEffectiveRoleProductId({ selectedContainerId: 'c-1', taskKind: null, storageRows })).toBe(
      ACTIVE_PRODUCT_ID
    );
  });

  it('projects cell overview and container detail slices', () => {
    const rows = [
      row({ containerId: 'c-1', itemRef: 'INV-1', quantity: 3 }),
      row({ containerId: 'c-2', itemRef: null, quantity: null })
    ];

    const overview = resolveCellOverview({ storageRows: rows });
    expect(overview.isOccupied).toBe(true);
    expect(overview.containers).toHaveLength(2);
    expect(overview.inventoryPreviewRows).toHaveLength(1);

    const detail = projectContainerDetail(rows, 'c-1');
    expect(detail.items).toHaveLength(1);
    expect(detail.isEmptyContainer).toBe(false);
    expect(detail.displayCode).toBe('SYS-1');
  });
});
