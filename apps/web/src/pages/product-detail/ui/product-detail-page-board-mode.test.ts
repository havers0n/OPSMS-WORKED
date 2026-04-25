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

function makeLevel(overrides: Partial<ProductPackagingLevel> = {}): ProductPackagingLevel {
  return {
    id: overrides.id ?? '22222222-2222-4222-8222-222222222222',
    productId,
    code: overrides.code ?? 'CASE',
    name: overrides.name ?? 'Case',
    baseUnitQty: overrides.baseUnitQty ?? 12,
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

  it('clicking edit facts opens the existing unit profile edit surface inside the workbench', async () => {
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
    expect(text).toContain('Unit Profile Board');
    expect(text).toContain('Product Facts');
    expect(text).toContain('Workbench');
    expect(text).toContain('Editing product facts');
    expect(text).toContain('Selected area:');
    expect(text).toContain('Product Facts');
    expect(text).toContain('Product facts');
    expect(text).toContain('Selected');
    expect(text).not.toContain('1. Single Unit Profile');
    expect(text).toContain('Save unit profile');
  });

  it('save success returns product facts editing to the read workspace', async () => {
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
    await act(async () => {
      await renderer.root.findByProps({ children: 'Save unit profile' }).props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(model.saveUnitProfile).toHaveBeenCalled();
    expect(text).toContain('Unit Profile Board');
    expect(text).not.toContain('Workbench');
    expect(text).not.toContain('1. Single Unit Profile');
    expect(text).not.toContain('Selected area: Product Facts');
  });

  it('save failure keeps product facts editing visible in the workbench', async () => {
    const model = makeModel({
      saveUnitProfile: vi.fn().mockResolvedValue(false),
      unitProfileSaveError: 'Failed to save unit profile.'
    });
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
    await act(async () => {
      await renderer.root.findByProps({ children: 'Save unit profile' }).props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(model.saveUnitProfile).toHaveBeenCalled();
    expect(text).toContain('Unit Profile Board');
    expect(text).toContain('Workbench');
    expect(text).toContain('Editing product facts');
    expect(text).toContain('Selected area:');
    expect(text).toContain('Product Facts');
    expect(text).toContain('Failed to save unit profile.');
  });

  it('cancel from product facts editing returns to the read workspace and resets draft state', async () => {
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
    act(() => {
      renderer.root.findByProps({ children: 'Back to workspace' }).props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(model.cancelUnitProfileEdit).toHaveBeenCalled();
    expect(text).toContain('Unit Profile Board');
    expect(text).not.toContain('Workbench');
    expect(text).not.toContain('1. Single Unit Profile');
  });

  it('clicking configure packaging opens the existing packaging edit surface inside the workbench', async () => {
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
    expect(text).toContain('Unit Profile Board');
    expect(text).toContain('Packaging Hierarchy');
    expect(text).toContain('Workbench');
    expect(text).toContain('Configuring packaging hierarchy');
    expect(text).toContain('Selected area:');
    expect(text).toContain('Packaging Hierarchy');
    expect(text).toContain('Packaging hierarchy');
    expect(text).toContain('Selected');
    expect(text).not.toContain('2. Packaging Levels');
    expect(text).toContain('Save packaging');
  });

  it('save success returns packaging editing to the read workspace', async () => {
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
    await act(async () => {
      await renderer.root.findByProps({ children: 'Save packaging levels' }).props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(model.savePackagingLevels).toHaveBeenCalled();
    expect(text).toContain('Unit Profile Board');
    expect(text).not.toContain('Workbench');
    expect(text).not.toContain('2. Packaging Levels');
  });

  it('save failure keeps packaging editing visible in the workbench', async () => {
    const model = makeModel({
      savePackagingLevels: vi.fn().mockResolvedValue(false),
      packagingSaveError: 'Failed to save packaging levels.'
    });
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
    await act(async () => {
      await renderer.root.findByProps({ children: 'Save packaging levels' }).props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(model.savePackagingLevels).toHaveBeenCalled();
    expect(text).toContain('Unit Profile Board');
    expect(text).toContain('Workbench');
    expect(text).toContain('Configuring packaging hierarchy');
    expect(text).toContain('Selected area:');
    expect(text).toContain('Packaging Hierarchy');
    expect(text).toContain('Failed to save packaging levels.');
  });

  it('cancel from packaging editing returns to the read workspace and resets draft state', async () => {
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
    act(() => {
      renderer.root.findByProps({ children: 'Back to workspace' }).props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(model.cancelPackagingEdit).toHaveBeenCalled();
    expect(text).toContain('Unit Profile Board');
    expect(text).not.toContain('Workbench');
    expect(text).not.toContain('2. Packaging Levels');
  });

  it('clicking create storage preset opens the existing storage create surface inside the workbench', async () => {
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
    expect(text).toContain('Unit Profile Board');
    expect(text).toContain('Storage Presets');
    expect(text).toContain('Workbench');
    expect(text).toContain('Creating storage preset');
    expect(text).toContain('Selected area:');
    expect(text).toContain('Storage Presets');
    expect(text).toContain('Storage preset');
    expect(text).toContain('Selected');
    expect(text).not.toContain('3. Storage Presets');
    expect(text).toContain('Code');
    expect(text).toContain('Create storage preset');
  });

  it('create success returns storage preset creation to the read workspace', async () => {
    const createMutation = mutationResult();
    createMutation.mutateAsync.mockResolvedValue({});
    mockState.model = makeModel({
      storagePresetsQuery: queryResult([]),
      createStoragePresetMutation: createMutation
    });
    const { ProductDetailPage } = await loadPage();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(ProductDetailPage));
    });
    act(() => {
      renderer.root.findByProps({ children: 'Create storage preset' }).props.onClick();
    });

    const inputs = renderer.root.findAllByType('input');
    act(() => {
      inputs[0]?.props.onChange({ target: { value: 'PAL-1' } });
      inputs[1]?.props.onChange({ target: { value: 'Pallet 1' } });
    });
    await act(async () => {
      const createButtons = renderer.root
        .findAllByType('button')
        .filter((button) => button.children.includes('Create storage preset'));
      await createButtons[createButtons.length - 1]?.props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(createMutation.mutateAsync).toHaveBeenCalled();
    expect(text).toContain('Unit Profile Board');
    expect(text).not.toContain('Workbench');
    expect(text).not.toContain('3. Storage Presets');
  });

  it('create failure keeps storage preset creation visible in the workbench', async () => {
    const createMutation = mutationResult();
    createMutation.mutateAsync.mockRejectedValue(new Error('Failed to create storage preset.'));
    mockState.model = makeModel({
      storagePresetsQuery: queryResult([]),
      createStoragePresetMutation: createMutation
    });
    const { ProductDetailPage } = await loadPage();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(ProductDetailPage));
    });
    act(() => {
      renderer.root.findByProps({ children: 'Create storage preset' }).props.onClick();
    });

    const inputs = renderer.root.findAllByType('input');
    act(() => {
      inputs[0]?.props.onChange({ target: { value: 'PAL-1' } });
      inputs[1]?.props.onChange({ target: { value: 'Pallet 1' } });
    });
    await act(async () => {
      const createButtons = renderer.root
        .findAllByType('button')
        .filter((button) => button.children.includes('Create storage preset'));
      await createButtons[createButtons.length - 1]?.props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(createMutation.mutateAsync).toHaveBeenCalled();
    expect(text).toContain('Unit Profile Board');
    expect(text).toContain('Workbench');
    expect(text).toContain('Creating storage preset');
    expect(text).toContain('Selected area:');
    expect(text).toContain('Storage Presets');
    expect(text).toContain('Failed to create storage preset.');
  });

  it('cancel from storage preset creation returns to the read workspace', async () => {
    mockState.model = makeModel({ storagePresetsQuery: queryResult([]) });
    const { ProductDetailPage } = await loadPage();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(ProductDetailPage));
    });
    act(() => {
      renderer.root.findByProps({ children: 'Create storage preset' }).props.onClick();
    });
    act(() => {
      renderer.root.findByProps({ children: 'Back to workspace' }).props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Unit Profile Board');
    expect(text).not.toContain('Workbench');
    expect(text).not.toContain('3. Storage Presets');
  });

  it('keeps storage create disabled without active storable packaging levels', async () => {
    mockState.model = makeModel({
      storagePresetsQuery: queryResult([]),
      packagingLevelsQuery: queryResult([makeLevel({ canStore: false })])
    });
    const { ProductDetailPage } = await loadPage();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(React.createElement(ProductDetailPage));
    });

    const createButton = renderer.root.findByProps({ children: 'Create storage preset' });
    expect(createButton.props.disabled).toBe(true);

    act(() => {
      createButton.props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Unit Profile Board');
    expect(text).not.toContain('Workbench');
    expect(text).not.toContain('3. Storage Presets');
  });
});
