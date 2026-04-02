import { describe, expect, it } from 'vitest';
import {
  mapContainerRowToDomain,
  mapContainerStorageSnapshotRowToDomain,
  mapContainerTypeRowToDomain,
  mapLocationStorageSnapshotRowToDomain
} from './mappers.js';

// ──────────────────────────────────────────────────────────────
// mapContainerTypeRowToDomain
// ──────────────────────────────────────────────────────────────

describe('mapContainerTypeRowToDomain', () => {
  const baseRow = {
    id: 'a8c1ab0f-2917-4ae0-b332-fd50f39db123',
    code: 'bin',
    description: 'Storage bin',
    supports_storage: true,
    supports_picking: true
  };

  it('maps capability booleans to camelCase domain fields', () => {
    const result = mapContainerTypeRowToDomain(baseRow);
    expect(result.supportsStorage).toBe(true);
    expect(result.supportsPicking).toBe(true);
  });

  it('maps storage-only type (pallet)', () => {
    const result = mapContainerTypeRowToDomain({
      ...baseRow,
      code: 'pallet',
      description: 'Standard pallet',
      supports_storage: true,
      supports_picking: true
    });
    expect(result.supportsStorage).toBe(true);
    expect(result.supportsPicking).toBe(true);
  });

  it('maps pick-only type (tote) — supportsStorage false', () => {
    const result = mapContainerTypeRowToDomain({
      ...baseRow,
      code: 'tote',
      description: 'Reusable tote',
      supports_storage: false,
      supports_picking: true
    });
    expect(result.supportsStorage).toBe(false);
    expect(result.supportsPicking).toBe(true);
  });

  it('preserves id, code, description unchanged', () => {
    const result = mapContainerTypeRowToDomain(baseRow);
    expect(result.id).toBe(baseRow.id);
    expect(result.code).toBe(baseRow.code);
    expect(result.description).toBe(baseRow.description);
  });
});

// ──────────────────────────────────────────────────────────────
// mapContainerRowToDomain
// ──────────────────────────────────────────────────────────────

describe('mapContainerRowToDomain', () => {
  const baseRow = {
    id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
    tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    system_code: 'CNT-000123',
    external_code: 'PALLET-001',
    container_type_id: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe',
    status: 'active' as const,
    operational_role: 'storage' as const,
    created_at: '2026-03-13T09:15:00.000Z',
    created_by: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d'
  };

  it('maps operational_role to camelCase domain field', () => {
    const result = mapContainerRowToDomain(baseRow);
    expect(result.operationalRole).toBe('storage');
  });

  it('maps pick operational role', () => {
    const result = mapContainerRowToDomain({ ...baseRow, operational_role: 'pick' });
    expect(result.operationalRole).toBe('pick');
  });

  it('maps external_code: null', () => {
    const result = mapContainerRowToDomain({ ...baseRow, external_code: null });
    expect(result.externalCode).toBeNull();
  });

  it('maps created_by: null', () => {
    const result = mapContainerRowToDomain({ ...baseRow, created_by: null });
    expect(result.createdBy).toBeNull();
  });

  it('preserves all identity fields', () => {
    const result = mapContainerRowToDomain(baseRow);
    expect(result.id).toBe(baseRow.id);
    expect(result.tenantId).toBe(baseRow.tenant_id);
    expect(result.systemCode).toBe(baseRow.system_code);
    expect(result.containerTypeId).toBe(baseRow.container_type_id);
    expect(result.status).toBe('active');
    expect(result.createdAt).toBe(baseRow.created_at);
  });
});

describe('mapContainerStorageSnapshotRowToDomain', () => {
  it('maps system_code into systemCode', () => {
    const result = mapContainerStorageSnapshotRowToDomain({
      tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      system_code: 'CNT-000555',
      external_code: null,
      container_type: 'pallet',
      container_status: 'active',
      item_ref: null,
      quantity: null,
      uom: null
    });

    expect(result.systemCode).toBe('CNT-000555');
    expect(result.externalCode).toBeNull();
  });
});

describe('mapLocationStorageSnapshotRowToDomain', () => {
  it('maps system_code into systemCode', () => {
    const result = mapLocationStorageSnapshotRowToDomain({
      tenant_id: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      floor_id: '288ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      location_id: '388ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      location_code: 'A-01-01',
      location_type: 'rack_slot',
      cell_id: '488ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      container_id: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      system_code: 'CNT-000556',
      external_code: null,
      container_type: 'pallet',
      container_status: 'active',
      placed_at: '2026-01-01T00:00:00.000Z',
      item_ref: null,
      quantity: null,
      uom: null
    });

    expect(result.systemCode).toBe('CNT-000556');
    expect(result.externalCode).toBeNull();
  });
});
