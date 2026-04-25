import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer, { act } from 'react-test-renderer';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { ProductUnitProfile } from '@wos/domain';
import type { UpsertProductUnitProfileBody } from '@/entities/product/api/mutations';
import { ProductUnitProfileSection } from './product-unit-profile-section';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  ProductUnitProfile,
  Error,
  { productId: string; body: UpsertProductUnitProfileBody }
> {
  return {
    mutateAsync: vi.fn(),
    isPending: false
  } as unknown as UseMutationResult<ProductUnitProfile, Error, { productId: string; body: UpsertProductUnitProfileBody }>;
}

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

function makeProfile(): ProductUnitProfile {
  return {
    productId: '11111111-1111-4111-8111-111111111111',
    unitWeightG: null,
    unitWidthMm: null,
    unitHeightMm: null,
    unitDepthMm: null,
    weightClass: 'medium',
    sizeClass: 'small',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function renderSection(args: { data: ProductUnitProfile | null; isEditing?: boolean }) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(ProductUnitProfileSection, {
        unitProfileQuery: queryResult<ProductUnitProfile | null>({ data: args.data }),
        upsertUnitProfileMutation: mutationResult(),
        isUnitProfileEditing: args.isEditing ?? false,
        unitProfileDraft: {
          unitWeightG: '',
          unitWidthMm: '',
          unitHeightMm: '',
          unitDepthMm: '',
          weightClass: '',
          sizeClass: ''
        },
        unitProfileFieldErrors: {},
        unitProfileSaveError: null,
        unitProfileDirty: false,
        onBeginEdit: vi.fn(),
        onCancelEdit: vi.fn(),
        onSave: vi.fn(),
        onNumericFieldChange: vi.fn(),
        onClassFieldChange: vi.fn()
      })
    );
  });
  return renderer;
}

describe('ProductUnitProfileSection', () => {
  it('renders the section subtitle', () => {
    const renderer = renderSection({ data: null });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('1. Single Unit Profile');
    expect(text).toContain(
      'Describes one individual unit of this product. Packaging levels are built from this unit.'
    );
  });

  it('renders fallback class copy in read and edit modes', () => {
    const read = renderSection({ data: makeProfile() });
    const edit = renderSection({ data: makeProfile(), isEditing: true });

    expect(flattenText(read.toJSON())).toContain('Estimated size / weight class');
    expect(flattenText(read.toJSON())).toContain('Used only when exact measurements are missing.');
    expect(flattenText(edit.toJSON())).toContain('Estimated size / weight class');
    expect(flattenText(edit.toJSON())).toContain('Used only when exact measurements are missing.');
  });
});
