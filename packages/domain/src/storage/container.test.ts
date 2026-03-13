import { describe, expect, it } from 'vitest';
import { containerSchema, containerStatusSchema, containerTypeSchema } from './container';

describe('container storage contracts', () => {
  it('accepts supported container statuses', () => {
    expect(containerStatusSchema.parse('active')).toBe('active');
    expect(containerStatusSchema.parse('quarantined')).toBe('quarantined');
    expect(containerStatusSchema.parse('closed')).toBe('closed');
    expect(containerStatusSchema.parse('lost')).toBe('lost');
    expect(containerStatusSchema.parse('damaged')).toBe('damaged');
  });

  it('parses a container type', () => {
    expect(
      containerTypeSchema.parse({
        id: 'e503c8ba-af56-4a1b-b4a8-c39ef09fdbcf',
        code: 'pallet',
        description: 'Standard pallet'
      })
    ).toEqual({
      id: 'e503c8ba-af56-4a1b-b4a8-c39ef09fdbcf',
      code: 'pallet',
      description: 'Standard pallet'
    });
  });

  it('parses a container record', () => {
    expect(
      containerSchema.parse({
        id: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        externalCode: 'PALLET-001',
        containerTypeId: 'e503c8ba-af56-4a1b-b4a8-c39ef09fdbcf',
        status: 'active',
        createdAt: '2026-03-13T10:00:00.000Z',
        createdBy: '945e796c-1fd6-471d-8992-a7810fd3567f'
      })
    ).toMatchObject({
      externalCode: 'PALLET-001',
      status: 'active'
    });
  });
});
