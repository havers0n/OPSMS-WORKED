import React from 'react';
import { describe, expect, it } from 'vitest';
import TestRenderer, { act } from 'react-test-renderer';
import type { ProductPackagingLevel, ProductUnitProfile, StoragePreset } from '@wos/domain';
import { ProductSetupFlowStrip } from './product-detail-page';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const productId = '11111111-1111-4111-8111-111111111111';

function makeProfile(overrides: Partial<ProductUnitProfile> = {}): ProductUnitProfile {
  return {
    productId,
    unitWeightG: overrides.unitWeightG ?? 100,
    unitWidthMm: overrides.unitWidthMm ?? 10,
    unitHeightMm: overrides.unitHeightMm ?? 20,
    unitDepthMm: overrides.unitDepthMm ?? 30,
    weightClass: overrides.weightClass ?? null,
    sizeClass: overrides.sizeClass ?? null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
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

function renderStrip(args?: {
  unitProfile?: ProductUnitProfile | null;
  packagingLevels?: ProductPackagingLevel[];
  storagePresets?: StoragePreset[];
}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(ProductSetupFlowStrip, {
        unitProfile: args?.unitProfile ?? makeProfile(),
        packagingLevels: args?.packagingLevels ?? [],
        storagePresets: args?.storagePresets ?? []
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

describe('ProductSetupFlowStrip', () => {
  it('renders the strip title and helper', () => {
    const renderer = renderStrip();

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Product setup flow');
    expect(text).toContain('Single Unit Profile');
    expect(text).toContain(
      'Define the unit, create pack types from it, then use storable pack types in storage presets.'
    );
  });

  it('shows Packaging Missing when no levels exist', () => {
    const renderer = renderStrip({ packagingLevels: [] });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Packaging Levels');
    expect(text).toContain('Missing');
  });

  it('shows Packaging No storable levels when levels exist but none are eligible', () => {
    const renderer = renderStrip({
      packagingLevels: [makePackagingLevel({ canStore: false }), makePackagingLevel({ isActive: false })]
    });

    expect(flattenText(renderer.toJSON())).toContain('No storable levels');
  });

  it('shows Packaging Ready and storable count when eligible levels exist', () => {
    const renderer = renderStrip({
      packagingLevels: [
        makePackagingLevel({ id: '22222222-2222-4222-8222-222222222221' }),
        makePackagingLevel({ id: '22222222-2222-4222-8222-222222222222' }),
        makePackagingLevel({ id: '22222222-2222-4222-8222-222222222223', canStore: false })
      ]
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Ready');
    expect(text).toContain('3 levels, 2 storable');
  });

  it('shows Storage Blocked, Not set, or Ready based on prerequisites and presets', () => {
    const blocked = renderStrip({ packagingLevels: [] });
    expect(flattenText(blocked.toJSON())).toContain('Blocked');

    const notSet = renderStrip({ packagingLevels: [makePackagingLevel()], storagePresets: [] });
    expect(flattenText(notSet.toJSON())).toContain('Not set');

    const ready = renderStrip({ packagingLevels: [makePackagingLevel()], storagePresets: [makePreset()] });
    expect(flattenText(ready.toJSON())).toContain('1 preset');
  });
});
