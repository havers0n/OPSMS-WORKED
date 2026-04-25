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

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

describe('ProductPackagingSection', () => {
  it('renders the section subtitle', () => {
    const renderer = renderSection([makePackagingLevel()]);

    expect(flattenText(renderer.toJSON())).toContain(
      'How individual units are grouped into boxes, cases, or pallets.'
    );
  });

  it('renders helpful empty state copy', () => {
    const renderer = renderSection([]);

    expect(flattenText(renderer.toJSON())).toContain(
      'No packaging levels yet. Start with Single unit, then add Box, Case, or Pallet if this product uses them.'
    );
  });
});
