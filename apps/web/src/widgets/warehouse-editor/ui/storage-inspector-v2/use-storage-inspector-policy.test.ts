import { describe, expect, it } from 'vitest';
import type { LocationStorageSnapshotRow } from '@wos/domain';
import { buildContainerPolicySnapshot, computeStorageInspectorPolicy } from './use-storage-inspector-policy';
import type { StorageInspectorReadModel } from './use-storage-inspector-read-model';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';

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
    itemRef: 'INV-1',
    quantity: 1,
    uom: 'EA',
    product: {
      id: PRODUCT_ID,
      source: 'internal',
      externalProductId: 'ext-1',
      permalink: null,
      imageUrls: [],
      imageFiles: [],
      name: 'P',
      sku: 'P-1',
      isActive: true,
      createdAt: '2020-01-01',
      updatedAt: '2020-01-01'
    },
    ...overrides
  } as LocationStorageSnapshotRow;
}

function createReadModel(partial: Partial<StorageInspectorReadModel>): StorageInspectorReadModel {
  return {
    floorId: 'floor-1',
    racks: undefined,
    publishedCells: [],
    containerTypes: [],
    cellId: 'cell-1',
    rackId: 'rack-1',
    activeLevel: 1,
    rackDisplayCode: 'R-01',
    createWithProductSearchResults: [],
    addProductSearchResults: [],
    locationRef: {
      locationId: 'loc-1',
      locationType: 'rack_slot',
      locationCode: 'LOC-1',
      cellId: 'cell-1'
    },
    locationRefLoading: false,
    locationId: 'loc-1',
    storageRows: [row({})],
    storageLoading: false,
    locationProductAssignments: [],
    effectiveRoleProductId: PRODUCT_ID,
    effectiveRoleContext: {
      locationId: 'loc-1',
      productId: PRODUCT_ID,
      structuralDefaultRole: 'reserve',
      effectiveRole: 'reserve',
      effectiveRoleSource: 'structural_default',
      conflictingPublishedRoles: []
    },
    effectiveRoleLoading: false,
    moveTargetLocationRef: undefined,
    moveTargetLocationLoading: false,
    selectedCellAddress: '01-A.01.01',
    locationCode: 'LOC-1',
    isOccupied: true,
    containers: [],
    inventoryPreviewRows: [],
    inventoryOverflow: 0,
    ...partial
  };
}

describe('use-storage-inspector-policy', () => {
  it('computes edit-override autoclose when conflict appears', () => {
    const readModel = createReadModel({
      effectiveRoleContext: {
        locationId: 'loc-1',
        productId: PRODUCT_ID,
        structuralDefaultRole: 'reserve',
        effectiveRole: null,
        effectiveRoleSource: 'conflict',
        conflictingPublishedRoles: ['reserve']
      }
    });

    const policy = computeStorageInspectorPolicy(readModel, {
      taskKind: 'edit-override',
      baseMode: { kind: 'container-detail', cellId: 'cell-1', containerId: 'c-1' }
    });

    expect(policy.shouldCloseEditOverrideTask).toBe(true);
    expect(policy.shouldCloseRepairConflictTask).toBe(false);
  });

  it('does not close repair-conflict while effective role is still loading', () => {
    const readModel = createReadModel({ effectiveRoleLoading: true });

    const policy = computeStorageInspectorPolicy(readModel, {
      taskKind: 'repair-conflict',
      baseMode: { kind: 'container-detail', cellId: 'cell-1', containerId: 'c-1' }
    });

    expect(policy.shouldCloseRepairConflictTask).toBe(false);
  });

  it('builds capability snapshot for container detail', () => {
    const readModel = createReadModel({
      locationProductAssignments: [
        {
          id: 'a-1',
          locationId: 'loc-1',
          productId: PRODUCT_ID,
          role: 'reserve',
          state: 'published',
          layoutVersionId: null,
          createdAt: '2020-01-01',
          product: { id: PRODUCT_ID, name: 'P', sku: 'P-1', imageUrl: null }
        }
      ]
    });

    const snapshot = buildContainerPolicySnapshot(readModel, 'c-1');
    expect(snapshot.hasProductContext).toBe(true);
    expect(snapshot.hasExplicitOverride).toBe(true);
    expect(snapshot.canShowOverrideEntry).toBe(true);
    expect(snapshot.structuralDefaultText).toBe('Reserve');
  });
});
