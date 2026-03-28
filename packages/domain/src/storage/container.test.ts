import { describe, expect, it } from 'vitest';
import { containerOperationalRoleSchema, containerSchema, containerStatusSchema, containerTypeSchema } from './container';

describe('container storage contracts', () => {
  it('accepts supported container statuses', () => {
    expect(containerStatusSchema.parse('active')).toBe('active');
    expect(containerStatusSchema.parse('quarantined')).toBe('quarantined');
    expect(containerStatusSchema.parse('closed')).toBe('closed');
    expect(containerStatusSchema.parse('lost')).toBe('lost');
    expect(containerStatusSchema.parse('damaged')).toBe('damaged');
  });

  it('rejects unknown container status', () => {
    expect(() => containerStatusSchema.parse('decommissioned')).toThrow();
  });

  describe('containerOperationalRoleSchema', () => {
    it('accepts storage role', () => {
      expect(containerOperationalRoleSchema.parse('storage')).toBe('storage');
    });

    it('accepts pick role', () => {
      expect(containerOperationalRoleSchema.parse('pick')).toBe('pick');
    });

    it('rejects unknown role', () => {
      expect(() => containerOperationalRoleSchema.parse('transport')).toThrow();
    });
  });

  describe('containerTypeSchema', () => {
    it('parses a type with capability fields', () => {
      expect(
        containerTypeSchema.parse({
          id: 'e503c8ba-af56-4a1b-b4a8-c39ef09fdbcf',
          code: 'pallet',
          description: 'Standard pallet',
          supportsStorage: true,
          supportsPicking: true
        })
      ).toEqual({
        id: 'e503c8ba-af56-4a1b-b4a8-c39ef09fdbcf',
        code: 'pallet',
        description: 'Standard pallet',
        supportsStorage: true,
        supportsPicking: true
      });
    });

    it('parses a pick-only type (tote)', () => {
      const result = containerTypeSchema.parse({
        id: 'b1234567-0000-4000-8000-000000000001',
        code: 'tote',
        description: 'Reusable tote',
        supportsStorage: false,
        supportsPicking: true
      });
      expect(result.supportsStorage).toBe(false);
      expect(result.supportsPicking).toBe(true);
    });

    it('parses a dual-capability type (bin)', () => {
      const result = containerTypeSchema.parse({
        id: 'b1234567-0000-4000-8000-000000000002',
        code: 'bin',
        description: 'Storage bin',
        supportsStorage: true,
        supportsPicking: true
      });
      expect(result.supportsStorage).toBe(true);
      expect(result.supportsPicking).toBe(true);
    });

    it('rejects type missing supportsStorage', () => {
      expect(() =>
        containerTypeSchema.parse({
          id: 'e503c8ba-af56-4a1b-b4a8-c39ef09fdbcf',
          code: 'pallet',
          description: 'Standard pallet',
          supportsPicking: true
          // supportsStorage omitted
        })
      ).toThrow();
    });

    it('rejects type missing supportsPicking', () => {
      expect(() =>
        containerTypeSchema.parse({
          id: 'e503c8ba-af56-4a1b-b4a8-c39ef09fdbcf',
          code: 'pallet',
          description: 'Standard pallet',
          supportsStorage: true
          // supportsPicking omitted
        })
      ).toThrow();
    });
  });

  describe('containerSchema', () => {
    const baseContainer = {
      id: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
      tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
      externalCode: 'PALLET-001',
      containerTypeId: 'e503c8ba-af56-4a1b-b4a8-c39ef09fdbcf',
      status: 'active',
      operationalRole: 'storage',
      createdAt: '2026-03-13T10:00:00.000Z',
      createdBy: '945e796c-1fd6-471d-8992-a7810fd3567f'
    } as const;

    it('parses a storage container', () => {
      const result = containerSchema.parse(baseContainer);
      expect(result.operationalRole).toBe('storage');
      expect(result.status).toBe('active');
    });

    it('parses a pick container', () => {
      const result = containerSchema.parse({ ...baseContainer, operationalRole: 'pick' });
      expect(result.operationalRole).toBe('pick');
    });

    it('rejects a container with unknown operational role', () => {
      expect(() =>
        containerSchema.parse({ ...baseContainer, operationalRole: 'staging' })
      ).toThrow();
    });

    it('rejects a container missing operationalRole', () => {
      const { operationalRole: _omitted, ...rest } = baseContainer;
      expect(() => containerSchema.parse(rest)).toThrow();
    });

    it('preserves externalCode: null', () => {
      const result = containerSchema.parse({ ...baseContainer, externalCode: null });
      expect(result.externalCode).toBeNull();
    });

    it('preserves createdBy: null', () => {
      const result = containerSchema.parse({ ...baseContainer, createdBy: null });
      expect(result.createdBy).toBeNull();
    });
  });
});
