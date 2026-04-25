import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer, { act } from 'react-test-renderer';
import type { Product, ProductPackagingLevel, ProductUnitProfile } from '@wos/domain';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const productId = '11111111-1111-4111-8111-111111111111';

const mockState = vi.hoisted(() => ({
  model: null as null | Record<string, unknown>
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) =>
    React.createElement('a', { href: to, className }, children),
  useLocation: () => ({ state: null }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ productId })
}));

vi.mock('../model/use-product-detail-page-model', () => ({
  getProfileCompleteness: (profile: ProductUnitProfile | null | undefined) => (profile ? 'Complete' : 'Missing'),
  useProductDetailPageModel: () => mockState.model
}));

async function loadPage() {
  return import('./product-detail-page');
}

function makeProduct(): Product {
  return {
    id: productId,
    source: 'test',
    externalProductId: 'ABC-123',
    sku: 'SKU-123',
    name: 'Board Mode Product',
    permalink: null,
    imageUrls: [],
    imageFiles: [],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function makeProfile(): ProductUnitProfile {
  return {
    productId,
    unitWeightG: 100,
    unitWidthMm: 10,
    unitHeightMm: 20,
    unitDepthMm: 30,
    weightClass: null,
    sizeClass: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function makeLevel(): ProductPackagingLevel {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    productId,
    code: 'CASE',
    name: 'Case',
    baseUnitQty: 12,
    isBase: false,
    canPick: true,
    canStore: true,
    isDefaultPickUom: false,
    barcode: null,
    packWeightG: null,
    packWidthMm: null,
    packHeightMm: null,
    packDepthMm: null,
    sortOrder: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function queryResult<T>(data: T) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn()
  };
}

function mutationResult() {
  return {
    isPending: false,
    mutateAsync: vi.fn()
  };
}

function makeModel(overrides: Record<string, unknown> = {}) {
  const level = makeLevel();

  return {
    productQuery: { ...queryResult(makeProduct()), isError: false },
    product: makeProduct(),
    unitProfileQuery: queryResult(makeProfile()),
    packagingLevelsQuery: queryResult([level]),
    storagePresetsQuery: queryResult([]),
    containerTypesQuery: queryResult([{ id: 'ct-1', code: 'PALLET', description: 'Pallet', supportsStorage: true }]),
    isNotFound: false,
    defaultPickLevel: null,
    upsertUnitProfileMutation: mutationResult(),
    replacePackagingLevelsMutation: mutationResult(),
    createStoragePresetMutation: mutationResult(),
    isUnitProfileEditing: true,
    unitProfileDraft: {
      unitWeightG: '100',
      unitWidthMm: '10',
      unitHeightMm: '20',
      unitDepthMm: '30',
      weightClass: '',
      sizeClass: ''
    },
    unitProfileFieldErrors: {},
    unitProfileSaveError: null,
    unitProfileDirty: false,
    isPackagingEditing: true,
    packagingDraft: [
      {
        draftId: 'row-1',
        id: level.id,
        code: level.code,
        name: level.name,
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
    packagingEditorSemantics: { rows: new Map(), sectionErrors: [] },
    displayImages: [],
    activeImageIndex: 0,
    selectedImageUrl: null,
    lightboxOpen: false,
    handleImageLoadError: vi.fn(),
    selectImage: vi.fn(),
    openLightbox: vi.fn(),
    closeLightbox: vi.fn(),
    goToNextImage: vi.fn(),
    goToPreviousImage: vi.fn(),
    updateUnitProfileDraftField: vi.fn(),
    updateUnitProfileDraftClassField: vi.fn(),
    beginUnitProfileEdit: vi.fn(),
    cancelUnitProfileEdit: vi.fn(),
    saveUnitProfile: vi.fn().mockResolvedValue(true),
    beginPackagingEdit: vi.fn(),
    cancelPackagingEdit: vi.fn(),
    updatePackagingRow: vi.fn(),
    addPackagingRow: vi.fn(),
    removePackagingRow: vi.fn(),
    savePackagingLevels: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  return node.children?.map((child) => (typeof child === 'string' ? child : flattenText(child))).join(' ') ?? '';
}

describe('ProductDetailPage board modes', () => {
  it('shows the board by default without duplicating old read-only sections', async () => {
    mockState.model = makeModel();
    const { ProductDetailPage } = await loadPage();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(ProductDetailPage));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Unit Profile Board');
    expect(text).not.toContain('1. Single Unit Profile');
    expect(text).not.toContain('2. Packaging Levels');
    expect(text).not.toContain('3. Storage Presets');
  });

  it('clicking edit facts switches to the existing unit profile edit surface', async () => {
    const model = makeModel();
    mockState.model = model;
    const { ProductDetailPage } = await loadPage();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(ProductDetailPage));
    });
    act(() => {
      renderer.root
        .findAllByType('button')
        .find((button) => button.children.includes('Edit facts'))
        ?.props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(model.beginUnitProfileEdit).toHaveBeenCalled();
    expect(text).toContain('Editing product facts');
    expect(text).toContain('1. Single Unit Profile');
    expect(text).toContain('Save unit profile');
  });

  it('clicking configure packaging switches to the existing packaging edit surface', async () => {
    const model = makeModel();
    mockState.model = model;
    const { ProductDetailPage } = await loadPage();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(ProductDetailPage));
    });
    act(() => {
      renderer.root
        .findAllByType('button')
        .find((button) => button.children.includes('Configure packaging'))
        ?.props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(model.beginPackagingEdit).toHaveBeenCalled();
    expect(text).toContain('Configuring packaging levels');
    expect(text).toContain('2. Packaging Levels');
    expect(text).toContain('Save packaging');
  });

  it('clicking create storage preset switches to the existing storage create surface', async () => {
    mockState.model = makeModel({ storagePresetsQuery: queryResult([]) });
    const { ProductDetailPage } = await loadPage();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(ProductDetailPage));
    });
    act(() => {
      renderer.root.findByProps({ children: 'Create storage preset' }).props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Creating storage preset');
    expect(text).toContain('3. Storage Presets');
    expect(text).toContain('Code');
    expect(text).toContain('Create storage preset');
  });
});
