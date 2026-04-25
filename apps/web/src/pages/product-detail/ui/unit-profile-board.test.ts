import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer, { act } from 'react-test-renderer';
import type { Product, ProductPackagingLevel, ProductUnitProfile, StoragePreset } from '@wos/domain';
import { PackagingHierarchyPanel } from './packaging-hierarchy-panel';
import { ProductFactsCard } from './product-facts-card';
import { StoragePresetsPanel } from './storage-presets-panel';
import { UnitProfileBoard } from './unit-profile-board';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const productId = '11111111-1111-4111-8111-111111111111';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: productId,
    source: 'test',
    externalProductId: overrides.externalProductId ?? 'ABC-123',
    sku: overrides.sku ?? 'SKU-123',
    name: overrides.name ?? 'Test Product',
    permalink: null,
    imageUrls: [],
    imageFiles: [],
    isActive: overrides.isActive ?? true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function makeProfile(overrides: Partial<ProductUnitProfile> = {}): ProductUnitProfile {
  return {
    productId,
    unitWeightG: overrides.unitWeightG ?? 100,
    unitWidthMm: overrides.unitWidthMm ?? 10,
    unitHeightMm: overrides.unitHeightMm ?? 20,
    unitDepthMm: overrides.unitDepthMm ?? 30,
    weightClass: overrides.weightClass ?? 'light',
    sizeClass: overrides.sizeClass ?? 'small',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function makeLevel(overrides: Partial<ProductPackagingLevel> = {}): ProductPackagingLevel {
  return {
    id: overrides.id ?? '22222222-2222-4222-8222-222222222222',
    productId,
    code: overrides.code ?? 'MASTER',
    name: overrides.name ?? 'Master',
    baseUnitQty: overrides.baseUnitQty ?? 40,
    isBase: overrides.isBase ?? false,
    canPick: overrides.canPick ?? true,
    canStore: overrides.canStore ?? true,
    isDefaultPickUom: overrides.isDefaultPickUom ?? false,
    barcode: overrides.barcode ?? null,
    packWeightG: overrides.packWeightG ?? null,
    packWidthMm: overrides.packWidthMm ?? null,
    packHeightMm: overrides.packHeightMm ?? null,
    packDepthMm: overrides.packDepthMm ?? null,
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
    code: overrides.code ?? 'PAL-12',
    name: overrides.name ?? 'Pallet 12 Master',
    profileType: 'storage',
    scopeType: 'tenant',
    scopeId: '44444444-4444-4444-8444-444444444444',
    validFrom: null,
    validTo: null,
    priority: 0,
    isDefault: overrides.isDefault ?? true,
    status: overrides.status ?? 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    levels:
      overrides.levels ??
      [
        {
          id: '55555555-5555-4555-8555-555555555555',
          profileId: '33333333-3333-4333-8333-333333333333',
          levelType: 'MASTER',
          qtyEach: 480,
          parentLevelType: null,
          qtyPerParent: null,
          containerType: 'PALLET',
          tareWeightG: null,
          nominalGrossWeightG: null,
          lengthMm: null,
          widthMm: null,
          heightMm: null,
          casesPerTier: null,
          tiersPerPallet: null,
          maxStackHeight: null,
          maxStackWeight: null,
          legacyProductPackagingLevelId: '22222222-2222-4222-8222-222222222222',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
  };
}

function renderBoard(args?: {
  product?: Product;
  unitProfile?: ProductUnitProfile | null;
  packagingLevels?: ProductPackagingLevel[];
  storagePresets?: StoragePreset[];
  onEditProductFacts?: () => void;
  onEditPackaging?: () => void;
  onCreateStoragePreset?: () => void;
}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(UnitProfileBoard, {
        product: args?.product ?? makeProduct(),
        unitProfile: args?.unitProfile === undefined ? makeProfile() : args.unitProfile,
        packagingLevels: args?.packagingLevels ?? [
          makeLevel({
            id: '22222222-2222-4222-8222-222222222221',
            code: 'EA',
            name: 'Each',
            baseUnitQty: 1,
            isBase: true
          }),
          makeLevel()
        ],
        storagePresets: args?.storagePresets ?? [makePreset()],
        onEditProductFacts: args?.onEditProductFacts ?? vi.fn(),
        onEditPackaging: args?.onEditPackaging ?? vi.fn(),
        onCreateStoragePreset: args?.onCreateStoragePreset ?? vi.fn()
      })
    );
  });
  return renderer;
}

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

describe('UnitProfileBoard', () => {
  it('renders the three read-only zones', () => {
    const text = flattenText(renderBoard().toJSON());

    expect(text).toContain('Product Facts');
    expect(text).toContain('Packaging Hierarchy');
    expect(text).toContain('Storage Presets');
    expect(text).toContain('Test Product');
    expect(text).toContain('Master');
  });

  it('derives divisible storage preset pack counts safely', () => {
    const text = flattenText(renderBoard().toJSON());

    expect(text).toContain('Count: 12 Master');
    expect(text).toContain('Total: 480 EA');
    expect(text).not.toContain('does not divide cleanly');
  });

  it('warns instead of showing a misleading pack count when qtyEach is not divisible', () => {
    const text = flattenText(
      renderBoard({
        storagePresets: [makePreset({ levels: [{ ...makePreset().levels[0], qtyEach: 485 }] })]
      }).toJSON()
    );

    expect(text).toContain('Total: 485 EA');
    expect(text).toContain('Does not divide cleanly by Master size 40 EA.');
    expect(text).not.toContain('Count: 12.125 Master');
  });

  it('shows product warnings for missing facts and empty dependent sections', () => {
    const text = flattenText(
      renderBoard({
        unitProfile: null,
        packagingLevels: [],
        storagePresets: []
      }).toJSON()
    );

    expect(text).toContain('Missing weight');
    expect(text).toContain('Missing dimensions');
    expect(text).toContain('No active packaging levels');
    expect(text).toContain('No storage presets');
  });

  it('wires board action callbacks', () => {
    const onEditProductFacts = vi.fn();
    const onEditPackaging = vi.fn();
    const onCreateStoragePreset = vi.fn();
    const renderer = renderBoard({
      storagePresets: [],
      onEditProductFacts,
      onEditPackaging,
      onCreateStoragePreset
    });

    act(() => {
      renderer.root.findAllByType('button').find((button) => button.children.includes('Edit facts'))?.props.onClick();
    });
    act(() => {
      renderer.root
        .findAllByType('button')
        .find((button) => button.children.includes('Configure packaging'))
        ?.props.onClick();
    });
    act(() => {
      renderer.root
        .findAllByType('button')
        .find((button) => button.children.includes('Create storage preset'))
        ?.props.onClick();
    });

    expect(onEditProductFacts).toHaveBeenCalled();
    expect(onEditPackaging).toHaveBeenCalled();
    expect(onCreateStoragePreset).toHaveBeenCalled();
  });
});

describe('ProductFactsCard', () => {
  it('clicking edit calls onEditProductFacts', () => {
    const onEditProductFacts = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(ProductFactsCard, {
          product: makeProduct(),
          unitProfile: makeProfile(),
          packagingLevels: [makeLevel()],
          storagePresetCount: 1,
          onEditProductFacts
        })
      );
    });

    act(() => {
      renderer.root.findByProps({ children: 'Edit facts' }).props.onClick();
    });

    expect(onEditProductFacts).toHaveBeenCalledTimes(1);
  });
});

describe('PackagingHierarchyPanel', () => {
  it('empty state renders configure button and calls onEditPackaging', () => {
    const onEditPackaging = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(PackagingHierarchyPanel, {
          levels: [],
          unitProfile: makeProfile(),
          onEditPackaging
        })
      );
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('No packaging levels defined yet.');
    expect(text).toContain('Packaging levels define how this product is picked, packed, and stored.');

    act(() => {
      renderer.root
        .findAllByType('button')
        .find((button) => button.children.includes('Configure packaging'))
        ?.props.onClick();
    });

    expect(onEditPackaging).toHaveBeenCalledTimes(1);
  });
});

describe('StoragePresetsPanel', () => {
  it('disables create storage preset when no packaging levels exist', () => {
    const onCreateStoragePreset = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(StoragePresetsPanel, {
          presets: [],
          packagingLevels: [],
          onCreateStoragePreset
        })
      );
    });

    const createButton = renderer.root.findByProps({ children: 'Create storage preset' });
    expect(createButton.props.disabled).toBe(true);
    expect(flattenText(renderer.toJSON())).toContain('Define packaging levels before creating storage presets.');
  });

  it('enables create storage preset when active packaging levels exist and calls callback', () => {
    const onCreateStoragePreset = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(StoragePresetsPanel, {
          presets: [],
          packagingLevels: [makeLevel()],
          onCreateStoragePreset
        })
      );
    });

    const createButton = renderer.root.findByProps({ children: 'Create storage preset' });
    expect(createButton.props.disabled).toBe(false);

    act(() => {
      createButton.props.onClick();
    });

    expect(onCreateStoragePreset).toHaveBeenCalledTimes(1);
  });
});
