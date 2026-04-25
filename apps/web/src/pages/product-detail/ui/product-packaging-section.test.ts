import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer, { act } from 'react-test-renderer';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { ProductPackagingLevel, ProductUnitProfile } from '@wos/domain';
import type { ReplaceProductPackagingLevelItem } from '@/entities/product/api/mutations';
import { ProductPackagingSection } from './product-packaging-section';

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

function mutationResult(): UseMutationResult<
  ProductPackagingLevel[],
  Error,
  { productId: string; levels: ReplaceProductPackagingLevelItem[] }
> {
  return {
    mutateAsync: vi.fn(),
    isPending: false
  } as unknown as UseMutationResult<
    ProductPackagingLevel[],
    Error,
    { productId: string; levels: ReplaceProductPackagingLevelItem[] }
  >;
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

function renderSection(packagingLevels: ProductPackagingLevel[]) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(ProductPackagingSection, {
        packagingLevelsQuery: queryResult({ data: packagingLevels }),
        replacePackagingLevelsMutation: mutationResult(),
        unitProfileQuery: queryResult<ProductUnitProfile | null>({ data: null }),
        isPackagingEditing: false,
        packagingDraft: [],
        packagingRowErrors: {},
        packagingSectionErrors: [],
        packagingSaveError: null,
        packagingDirty: false,
        packagingEditorSemantics: {},
        onBeginEdit: vi.fn(),
        onCancelEdit: vi.fn(),
        onSave: vi.fn(),
        onAddRow: vi.fn(),
        onRemoveRow: vi.fn(),
        onUpdateRow: vi.fn()
      })
    );
  });
  return renderer;
}

function renderEditingSection() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(ProductPackagingSection, {
        packagingLevelsQuery: queryResult({ data: [makePackagingLevel()] }),
        replacePackagingLevelsMutation: mutationResult(),
        unitProfileQuery: queryResult<ProductUnitProfile | null>({ data: null }),
        isPackagingEditing: true,
        packagingDraft: [
          {
            draftId: 'draft-case',
            id: null,
            code: 'case',
            name: 'Case',
            baseUnitQty: '12',
            isBase: false,
            canPick: true,
            canStore: true,
            isDefaultPickUom: false,
            barcode: '',
            packWeightG: '',
            packWidthMm: '',
            packHeightMm: '',
            packDepthMm: '',
            isActive: true
          }
        ],
        packagingRowErrors: {},
        packagingSectionErrors: [],
        packagingSaveError: null,
        packagingDirty: false,
        packagingEditorSemantics: {},
        onBeginEdit: vi.fn(),
        onCancelEdit: vi.fn(),
        onSave: vi.fn(),
        onAddRow: vi.fn(),
        onRemoveRow: vi.fn(),
        onUpdateRow: vi.fn()
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

describe('ProductPackagingSection', () => {
  it('renders the section subtitle', () => {
    const renderer = renderSection([makePackagingLevel()]);

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('2. Packaging Levels');
    expect(text).toContain('Define pack types built from the unit.');
    expect(text).toContain('Can be stored');
    expect(text).toContain('become Pack type options in Storage Presets.');
  });

  it('renders storable summary copy', () => {
    const available = renderSection([
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222221', canStore: true, isActive: true }),
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222222', canStore: true, isActive: true }),
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222223', canStore: true, isActive: false })
    ]);
    expect(flattenText(available.toJSON())).toContain('2 available as Pack type');

    const unavailable = renderSection([makePackagingLevel({ canStore: false })]);
    expect(flattenText(unavailable.toJSON())).toContain('No levels available as Pack type yet');
  });

  it('renders helpful empty state copy', () => {
    const renderer = renderSection([]);

    expect(flattenText(renderer.toJSON())).toContain(
      'No packaging levels yet. Start with Single unit, then add Box, Case, or Pallet if this product uses them.'
    );
  });

  it('renders operational usage badges for all pick and store combinations', () => {
    const renderer = renderSection([
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222221', code: 'both', canPick: true, canStore: true }),
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222222', code: 'pick', canPick: true, canStore: false }),
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222223', code: 'store', canPick: false, canStore: true }),
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222224', code: 'none', canPick: false, canStore: false })
    ]);

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Picking + Storage');
    expect(text).toContain('Picking');
    expect(text).toContain('Storage');
    expect(text).toContain('Not used operationally');
  });

  it('renders compact read-view status badges', () => {
    const renderer = renderSection([
      makePackagingLevel({ isBase: true, isDefaultPickUom: true, isActive: true }),
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222223', code: 'old', isActive: false })
    ]);

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Base');
    expect(text).toContain('Default pick');
    expect(text).toContain('Active');
    expect(text).toContain('Inactive');
  });

  it('renders Available as Pack type only for active storable levels', () => {
    const renderer = renderSection([
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222221', code: 'available', canStore: true, isActive: true }),
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222222', code: 'inactive', canStore: true, isActive: false }),
      makePackagingLevel({ id: '22222222-2222-4222-8222-222222222223', code: 'pick', canStore: false, isActive: true })
    ]);

    const text = flattenText(renderer.toJSON());
    expect((text.match(/Available as Pack type/g) ?? [])).toHaveLength(1);
  });

  it('renders human-readable edit checkbox labels', () => {
    const renderer = renderEditingSection();

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Base unit');
    expect(text).toContain('Default for picking');
    expect(text).toContain('Can be picked');
    expect(text).toContain('Can be stored');
  });
});
