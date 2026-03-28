import { describe, expect, it } from 'vitest';
import type { ContainerType } from '@wos/domain';
import { filterStorableTypes } from './cell-placement-inspector.lib';

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeType(overrides: Partial<ContainerType> & { id: string }): ContainerType {
  return {
    id: overrides.id,
    code: overrides.code ?? overrides.id,
    description: overrides.description ?? '',
    supportsStorage: overrides.supportsStorage ?? true,
    supportsPicking: overrides.supportsPicking ?? false
  };
}

const pallet = makeType({ id: 'pallet', code: 'pallet', supportsStorage: true,  supportsPicking: true });
const tote   = makeType({ id: 'tote',   code: 'tote',   supportsStorage: false, supportsPicking: true });
const bin    = makeType({ id: 'bin',    code: 'bin',    supportsStorage: true,  supportsPicking: true });
const carton = makeType({ id: 'carton', code: 'carton', supportsStorage: true,  supportsPicking: false });

// ── filterStorableTypes ───────────────────────────────────────────────────────

describe('filterStorableTypes', () => {
  it('returns an empty array for an empty input', () => {
    expect(filterStorableTypes([])).toEqual([]);
  });

  it('includes types with supportsStorage = true', () => {
    const result = filterStorableTypes([pallet, bin, carton]);
    expect(result.map((t) => t.id)).toEqual(['pallet', 'bin', 'carton']);
  });

  it('excludes types with supportsStorage = false', () => {
    const result = filterStorableTypes([tote]);
    expect(result).toHaveLength(0);
  });

  it('excludes pick-only types (supportsStorage = false) from a mixed list', () => {
    const result = filterStorableTypes([pallet, tote, bin]);
    expect(result.map((t) => t.id)).toEqual(['pallet', 'bin']);
    expect(result.some((t) => t.id === 'tote')).toBe(false);
  });

  it('includes dual-capable types (supportsStorage = true AND supportsPicking = true)', () => {
    const result = filterStorableTypes([pallet, bin]);
    expect(result.map((t) => t.id)).toEqual(['pallet', 'bin']);
  });

  it('includes storage-only types (supportsStorage = true, supportsPicking = false)', () => {
    const result = filterStorableTypes([carton]);
    expect(result.map((t) => t.id)).toEqual(['carton']);
  });

  it('does not mutate the input array', () => {
    const input = [pallet, tote, bin];
    const original = [...input];
    filterStorableTypes(input);
    expect(input).toEqual(original);
  });

  it('preserves the original order of storage-capable types', () => {
    const result = filterStorableTypes([carton, pallet, tote, bin]);
    expect(result.map((t) => t.id)).toEqual(['carton', 'pallet', 'bin']);
  });
});
