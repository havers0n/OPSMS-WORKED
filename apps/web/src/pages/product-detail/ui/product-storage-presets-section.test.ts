import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer, { act } from 'react-test-renderer';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { ContainerType, ProductPackagingLevel, StoragePreset } from '@wos/domain';
import { ProductStoragePresetsSection } from './product-storage-presets-section';
import type { CreateStoragePresetInput } from '@/entities/product/api/mutations';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const productId = '11111111-1111-4111-8111-111111111111';

function queryResult<T>(overrides: {
  data?: T;
  error?: Error | null;
  isLoading?: boolean;
  isError?: boolean;
}): UseQueryResult<T, Error> {
  return {
    data: overrides.data,
    error: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides
  } as unknown as UseQueryResult<T, Error>;
}

function mutationResult(mutateAsync = vi.fn()): UseMutationResult<StoragePreset, Error, CreateStoragePresetInput> {
  return {
    mutateAsync,
    isPending: false
  } as unknown as UseMutationResult<StoragePreset, Error, CreateStoragePresetInput>;
}

function makeContainerType(overrides: Partial<ContainerType> & { id: string; code: string }): ContainerType {
  return {
    id: overrides.id,
    code: overrides.code,
    description: overrides.description ?? overrides.code,
    supportsStorage: overrides.supportsStorage ?? true,
    supportsPicking: overrides.supportsPicking ?? false
  };
}

function makePackagingLevel(overrides: Partial<ProductPackagingLevel> = {}): ProductPackagingLevel {
  return {
    id: overrides.id ?? '22222222-2222-4222-8222-222222222222',
    productId,
    code: overrides.code ?? 'case',
    name: overrides.name ?? 'Case',
    baseUnitQty: overrides.baseUnitQty ?? 12,
    isBase: overrides.isBase ?? false,
    canPick: overrides.canPick ?? true,
    canStore: overrides.canStore ?? true,
    isDefaultPickUom: overrides.isDefaultPickUom ?? false,
    barcode: null,
    packWeightG: null,
    packWidthMm: null,
    packHeightMm: null,
    packDepthMm: null,
    sortOrder: overrides.sortOrder ?? 1,
    isActive: overrides.isActive ?? true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function makePreset(overrides: Partial<StoragePreset> = {}): StoragePreset {
  return {
    id: overrides.id ?? '33333333-3333-4333-8333-333333333333',
    tenantId: '44444444-4444-4444-8444-444444444444',
    productId,
    code: overrides.code ?? 'PAL-24',
    name: overrides.name ?? 'Pallet 24',
    profileType: 'storage',
    scopeType: 'tenant',
    scopeId: '44444444-4444-4444-8444-444444444444',
    validFrom: null,
    validTo: null,
    priority: 0,
    isDefault: false,
    status: overrides.status ?? 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    levels: overrides.levels ?? []
  };
}

function renderSection(args?: {
  containerTypes?: ContainerType[];
  storagePresets?: StoragePreset[];
  packagingLevels?: ProductPackagingLevel[];
  containerTypesQuery?: { isLoading?: boolean; isError?: boolean; error?: Error | null };
  mutateAsync?: ReturnType<typeof vi.fn>;
}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(ProductStoragePresetsSection, {
        productId,
        storagePresetsQuery: queryResult({ data: args?.storagePresets ?? [] }),
        packagingLevelsQuery: queryResult({ data: args?.packagingLevels ?? [makePackagingLevel()] }),
        containerTypesQuery: queryResult({
          data: args?.containerTypes ?? [
            makeContainerType({ id: '55555555-5555-4555-8555-555555555555', code: 'pallet' }),
            makeContainerType({
              id: '66666666-6666-4666-8666-666666666666',
              code: 'tote',
              supportsStorage: false,
              supportsPicking: true
            })
          ],
          ...args?.containerTypesQuery
        }),
        createStoragePresetMutation: mutationResult(args?.mutateAsync)
      })
    );
  });
  return renderer;
}

function openCreateForm(root: TestRenderer.ReactTestInstance) {
  act(() => {
    root.findByType('button').props.onClick();
  });
}

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

describe('ProductStoragePresetsSection', () => {
  it('uses canonical storage-capable container types and defaults to pallet', () => {
    const renderer = renderSection();
    openCreateForm(renderer.root);

    const containerTypeSelect = renderer.root.findByProps({ 'aria-label': 'Container type' });
    expect(containerTypeSelect.props.value).toBe('pallet');
    expect(containerTypeSelect.findAllByType('option').map((option) => option.props.value)).toEqual([
      '',
      'pallet'
    ]);
    expect(renderer.root.findAllByProps({ value: 'random-invalid-container-type' })).toHaveLength(0);
  });

  it('shows helper text for loading, failed, and empty canonical container type states', () => {
    const loading = renderSection({
      containerTypes: [],
      containerTypesQuery: { isLoading: true }
    });
    openCreateForm(loading.root);
    expect(flattenText(loading.toJSON())).toContain('Loading container types...');

    const failed = renderSection({
      containerTypes: [],
      containerTypesQuery: { isError: true, error: new Error('Nope') }
    });
    openCreateForm(failed.root);
    expect(flattenText(failed.toJSON())).toContain('Failed to load container types.');

    const empty = renderSection({ containerTypes: [] });
    openCreateForm(empty.root);
    expect(flattenText(empty.toJSON())).toContain('No storage-capable container types available.');
  });

  it('creates with the selected canonical container type code and computed qtyEach', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(makePreset());
    const renderer = renderSection({
      mutateAsync,
      containerTypes: [
        makeContainerType({ id: '55555555-5555-4555-8555-555555555555', code: 'pallet' }),
        makeContainerType({ id: '77777777-7777-4777-8777-777777777777', code: 'bin' })
      ]
    });
    openCreateForm(renderer.root);

    const inputs = renderer.root.findAllByType('input');
    act(() => {
      inputs[0].props.onChange({ target: { value: 'PAL-36' } });
      inputs[1].props.onChange({ target: { value: 'Pallet 36' } });
      inputs[2].props.onChange({ target: { value: '3' } });
      renderer.root.findByProps({ 'aria-label': 'Container type' }).props.onChange({ target: { value: 'bin' } });
    });

    await act(async () => {
      renderer.root.findAllByType('button').at(-1)!.props.onClick();
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      productId,
      code: 'PAL-36',
      name: 'Pallet 36',
      levels: [
        {
          levelType: 'case',
          qtyEach: 36,
          containerType: 'bin',
          legacyProductPackagingLevelId: '22222222-2222-4222-8222-222222222222'
        }
      ]
    });
  });

  it('blocks invalid pack counts with friendly validation', async () => {
    const mutateAsync = vi.fn();
    const renderer = renderSection({ mutateAsync });
    openCreateForm(renderer.root);

    const inputs = renderer.root.findAllByType('input');
    act(() => {
      inputs[0].props.onChange({ target: { value: 'PAL-0' } });
      inputs[1].props.onChange({ target: { value: 'Pallet zero' } });
      inputs[2].props.onChange({ target: { value: '0' } });
    });

    await act(async () => {
      renderer.root.findAllByType('button').at(-1)!.props.onClick();
    });

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(flattenText(renderer.toJSON())).toContain('Pack count must be a positive whole number.');
  });

  it('renders all preset levels compactly', () => {
    const renderer = renderSection({
      storagePresets: [
        makePreset({
          levels: [
            {
              id: '88888888-8888-4888-8888-888888888888',
              profileId: '33333333-3333-4333-8333-333333333333',
              levelType: 'case',
              qtyEach: 12,
              parentLevelType: null,
              qtyPerParent: null,
              containerType: 'bin',
              tareWeightG: null,
              nominalGrossWeightG: null,
              lengthMm: null,
              widthMm: null,
              heightMm: null,
              casesPerTier: null,
              tiersPerPallet: null,
              maxStackHeight: null,
              maxStackWeight: null,
              legacyProductPackagingLevelId: null,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z'
            },
            {
              id: '99999999-9999-4999-8999-999999999999',
              profileId: '33333333-3333-4333-8333-333333333333',
              levelType: 'pallet',
              qtyEach: 144,
              parentLevelType: 'case',
              qtyPerParent: 12,
              containerType: 'pallet',
              tareWeightG: null,
              nominalGrossWeightG: null,
              lengthMm: null,
              widthMm: null,
              heightMm: null,
              casesPerTier: null,
              tiersPerPallet: null,
              maxStackHeight: null,
              maxStackWeight: null,
              legacyProductPackagingLevelId: null,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z'
            }
          ]
        })
      ]
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('case');
    expect(text).toContain('12');
    expect(text).toContain('bin');
    expect(text).toContain('pallet');
    expect(text).toContain('144');
  });
});
