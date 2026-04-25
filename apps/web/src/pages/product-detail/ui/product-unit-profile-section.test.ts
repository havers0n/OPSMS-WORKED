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

describe('ProductUnitProfileSection', () => {
  it('renders the section subtitle', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(ProductUnitProfileSection, {
          unitProfileQuery: queryResult<ProductUnitProfile | null>({ data: null }),
          upsertUnitProfileMutation: mutationResult(),
          isUnitProfileEditing: false,
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

    expect(flattenText(renderer.toJSON())).toContain('Measurements for one individual unit.');
  });
});
