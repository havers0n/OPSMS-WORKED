import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContainerType, LocationStorageSnapshotRow, Product } from '@wos/domain';
import type { LocationProductAssignment } from '@/entities/product-location-role/api/queries';
import { CellPlacementInspector } from './cell-placement-inspector';
import {
  filterStorableTypes,
  formatCreateAndPlacePlacementFailure,
  getContainerDisplayLabel,
  getContainerDisplaySecondary,
  getCreateAndPlaceDisabledReasons,
  summarizeInventory
} from './cell-placement-inspector.lib';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

let mockSelection: { type: string; cellId: string | null } = { type: 'cell', cellId: 'cell-1' };
let mockViewMode: 'view' | 'storage' | 'layout' = 'storage';
let mockPublishedCells = [{ id: 'cell-1', address: { raw: 'A-01-01' } }];
let mockLocationRef: { locationId: string } | null = { locationId: 'loc-1' };
let mockStorageData: LocationStorageSnapshotRow[] = [];
let mockContainerTypes: ContainerType[] = [];
let mockPolicyAssignments: LocationProductAssignment[] = [];
let mockProductSearchResults: Array<{ id: string; name: string; sku: string | null }> = [];
const mockCreateContainerMutateAsync = vi.fn();
const mockPlaceContainerMutateAsync = vi.fn();
const mockCreatePolicyMutateAsync = vi.fn();
const mockDeletePolicyMutateAsync = vi.fn();

vi.mock('@/entities/layout-version/model/editor-selectors', () => ({
  useEditorSelection: () => mockSelection,
  useSetSelectedContainerId: () => vi.fn(),
  useViewMode: () => mockViewMode
}));

vi.mock('@/entities/location/api/use-location-by-cell', () => ({
  useLocationByCell: () => ({ data: mockLocationRef, error: null })
}));

vi.mock('@/entities/location/api/use-location-storage', () => ({
  useLocationStorage: () => ({
    data: mockStorageData,
    error: null,
    isPending: false,
    isError: false
  })
}));

vi.mock('@/entities/container/api/use-container-types', () => ({
  useContainerTypes: () => ({
    data: mockContainerTypes,
    isPending: false,
    isError: false
  })
}));

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: () => ({ data: mockPublishedCells })
}));

vi.mock('@/features/container-create/model/use-create-container', () => ({
  useCreateContainer: () => ({
    isPending: false,
    status: 'idle',
    error: null,
    mutateAsync: mockCreateContainerMutateAsync
  })
}));

vi.mock('@/features/placement-actions/model/use-place-container', () => ({
  usePlaceContainer: () => ({
    isPending: false,
    status: 'idle',
    error: null,
    mutateAsync: mockPlaceContainerMutateAsync
  })
}));

vi.mock('@/entities/product-location-role/api/use-location-product-assignments', () => ({
  useLocationProductAssignments: () => ({
    data: mockPolicyAssignments,
    isPending: false
  })
}));

vi.mock('@/entities/product-location-role/api/mutations', () => ({
  useCreateProductLocationRole: () => ({
    isPending: false,
    mutateAsync: mockCreatePolicyMutateAsync
  }),
  useDeleteProductLocationRole: () => ({
    isPending: false,
    mutateAsync: mockDeletePolicyMutateAsync
  })
}));

vi.mock('@/entities/product/api/use-products-search', () => ({
  useProductsSearch: () => ({
    data: mockProductSearchResults
  })
}));

function renderInspector(): string {
  return renderToStaticMarkup(
    createElement(CellPlacementInspector, {
      workspace: { floorId: 'floor-1' } as never
    })
  );
}

function expectTextOrder(markup: string, first: string, second: string) {
  const firstIndex = markup.indexOf(first);
  const secondIndex = markup.indexOf(second);
  expect(firstIndex).toBeGreaterThan(-1);
  expect(secondIndex).toBeGreaterThan(-1);
  expect(firstIndex).toBeLessThan(secondIndex);
}

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

function makeProduct(overrides: Partial<Product> & { id: string; name: string }): Product {
  return {
    id: overrides.id,
    source: overrides.source ?? 'catalog',
    externalProductId: overrides.externalProductId ?? overrides.id,
    sku: overrides.sku ?? null,
    name: overrides.name,
    permalink: overrides.permalink ?? null,
    imageUrls: overrides.imageUrls ?? [],
    imageFiles: overrides.imageFiles ?? [],
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z'
  };
}

function makePolicyAssignment(
  overrides: Partial<LocationProductAssignment> & {
    id: string;
    product: LocationProductAssignment['product'];
  }
): LocationProductAssignment {
  return {
    id: overrides.id,
    productId: overrides.productId ?? overrides.product.id,
    locationId: overrides.locationId ?? 'loc-1',
    role: overrides.role ?? 'primary_pick',
    state: overrides.state ?? 'published',
    layoutVersionId: overrides.layoutVersionId ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    product: overrides.product
  };
}

function makeStorageRow(
  overrides: Partial<LocationStorageSnapshotRow> & {
    containerId: string;
  }
): LocationStorageSnapshotRow {
  return {
    tenantId: overrides.tenantId ?? '11111111-1111-1111-1111-111111111111',
    floorId: overrides.floorId ?? '22222222-2222-2222-2222-222222222222',
    locationId: overrides.locationId ?? '33333333-3333-3333-3333-333333333333',
    locationCode: overrides.locationCode ?? 'A-01-01',
    locationType: overrides.locationType ?? 'rack_slot',
    cellId: overrides.cellId ?? '44444444-4444-4444-4444-444444444444',
    containerId: overrides.containerId,
    systemCode: overrides.systemCode ?? 'CNT-000001',
    externalCode: overrides.externalCode ?? null,
    containerType: overrides.containerType ?? 'Pallet',
    containerStatus: overrides.containerStatus ?? 'active',
    placedAt: overrides.placedAt ?? '2026-01-01T00:00:00.000Z',
    itemRef: overrides.itemRef ?? null,
    product: overrides.product ?? null,
    quantity: overrides.quantity ?? null,
    uom: overrides.uom ?? null
  };
}

beforeEach(() => {
  mockSelection = { type: 'cell', cellId: 'cell-1' };
  mockViewMode = 'storage';
  mockPublishedCells = [{ id: 'cell-1', address: { raw: 'A-01-01' } }];
  mockLocationRef = { locationId: 'loc-1' };
  mockStorageData = [];
  mockContainerTypes = [];
  mockPolicyAssignments = [];
  mockProductSearchResults = [];
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  mockCreateContainerMutateAsync.mockReset();
  mockPlaceContainerMutateAsync.mockReset();
  mockCreatePolicyMutateAsync.mockReset();
  mockDeletePolicyMutateAsync.mockReset();
});

describe('CellPlacementInspector render hierarchy', () => {
  it('renders current containers and inventory before placement actions for occupied locations', () => {
    mockStorageData = [
      makeStorageRow({
        containerId: 'c1',
        locationId: 'loc-1',
        cellId: 'cell-1'
      })
    ];

    const markup = renderInspector();

    expectTextOrder(markup, 'Current containers', 'Placement actions');
    expectTextOrder(markup, 'Current inventory', 'Placement actions');
    expectTextOrder(markup, 'Placement actions', 'Location Policy');
  });
});

function renderInteractiveInspector() {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(CellPlacementInspector, {
        workspace: { floorId: 'floor-1' } as never
      })
    );
  });

  const root = renderer!.root;

  const rerender = () => {
    act(() => {
      renderer!.update(
        createElement(CellPlacementInspector, {
          workspace: { floorId: 'floor-1' } as never
        })
      );
    });
  };

  const text = () => JSON.stringify(renderer!.toJSON());

  const findButtonByText = (label: string) =>
    root.findAll((node: ReactTestInstance) => node.type === 'button' && node.props.children?.includes?.(label))[0] ??
    root.findAll((node: ReactTestInstance) => {
      if (node.type !== 'button') return false;
      const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
      return children.some((child: unknown) => typeof child === 'string' && child.trim() === label);
    })[0] ??
    null;

  const findByTestId = (testId: string) =>
    root.findAll((node: ReactTestInstance) => node.props['data-testid'] === testId)[0] ?? null;

  const findInput = () => root.findAllByType('input')[0] ?? null;

  return {
    root,
    rerender,
    text,
    findButtonByText,
    findByTestId,
    findInput,
    unmount: () => {
      act(() => {
        renderer!.unmount();
      });
    }
  };
}

describe('CellPlacementInspector placement mode transitions', () => {
  beforeEach(() => {
    mockContainerTypes = [pallet];
  });

  it('defaults to details mode and hides placement task forms', () => {
    const view = renderInteractiveInspector();

    expect(view.findByTestId('cell-placement-details-view')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-view')).toBeNull();
    expect(view.text()).toContain('Current containers');
    expect(view.text()).toContain('Current inventory');
    expect(view.text()).toContain('Placement actions');
    expect(view.text()).toContain('Location Policy');
    expect(view.findByTestId('cell-placement-task-place-existing')).toBeNull();
    expect(view.findByTestId('cell-placement-task-create-and-place')).toBeNull();
    expect(view.text()).not.toContain('Confirm place');
    expect(view.text()).not.toContain('Create and place');
    expect(view.text()).not.toContain('Dev details');

    view.unmount();
  });

  it('opens only the place-existing task body from the launcher', () => {
    const view = renderInteractiveInspector();

    const openPlace = view.findButtonByText('Place existing container');
    expect(openPlace).not.toBeNull();

    act(() => {
      openPlace?.props.onClick();
    });

    expect(view.findByTestId('cell-placement-task-view')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-shell')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-header')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-body')).not.toBeNull();
    expect(view.text()).toContain('Inspector task');
    expect(view.text()).toContain('Place existing container');
    expect(view.findByTestId('cell-placement-task-place-existing')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-create-and-place')).toBeNull();
    expect(view.text()).not.toContain('Current containers');
    expect(view.text()).not.toContain('Location Policy');

    view.unmount();
  });

  it('opens only the create-and-place task body from the launcher', () => {
    const view = renderInteractiveInspector();

    const openCreate = view.findButtonByText('+ Create container');
    expect(openCreate).not.toBeNull();

    act(() => {
      openCreate?.props.onClick();
    });

    expect(view.findByTestId('cell-placement-task-header')).not.toBeNull();
    expect(view.text()).toContain('Inspector task');
    expect(view.text()).toContain('Create new container');
    expect(view.findByTestId('cell-placement-task-create-and-place')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-place-existing')).toBeNull();
    expect(view.text()).not.toContain('Current containers');
    expect(view.text()).not.toContain('Location Policy');

    view.unmount();
  });

  it('returns to details mode when backing out of a task', () => {
    const view = renderInteractiveInspector();

    act(() => {
      view.findButtonByText('Place existing container')?.props.onClick();
    });

    act(() => {
      view.findButtonByText('Back')?.props.onClick();
    });

    expect(view.findByTestId('cell-placement-details-view')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-view')).toBeNull();
    expect(view.text()).toContain('Current containers');
    expect(view.text()).toContain('Current inventory');
    expect(view.findByTestId('cell-placement-task-place-existing')).toBeNull();

    view.unmount();
  });

  it('resets to details mode when the selected cell changes', () => {
    const view = renderInteractiveInspector();

    act(() => {
      view.findButtonByText('+ Create container')?.props.onClick();
    });

    mockSelection = { type: 'cell', cellId: 'cell-2' };
    mockPublishedCells = [{ id: 'cell-2', address: { raw: 'A-01-02' } }];
    mockLocationRef = { locationId: 'loc-2' };

    view.rerender();

    expect(view.text()).toContain('A-01-02');
    expect(view.text()).toContain('Current containers');
    expect(view.findByTestId('cell-placement-task-create-and-place')).toBeNull();

    view.unmount();
  });

  it('returns to details mode after successful place-existing completion', async () => {
    mockPlaceContainerMutateAsync.mockResolvedValue({
      ok: true,
      containerId: 'container-1',
      locationId: 'loc-1'
    });

    const view = renderInteractiveInspector();

    act(() => {
      view.findButtonByText('Place existing container')?.props.onClick();
    });

    const input = view.findInput();
    expect(input).not.toBeNull();

    act(() => {
      input?.props.onChange({ target: { value: 'CNT-000001' } });
    });

    const confirmPlace = view.findButtonByText('Confirm place');
    expect(confirmPlace).not.toBeNull();

    await act(async () => {
      await confirmPlace?.props.onClick();
    });

    expect(mockPlaceContainerMutateAsync).toHaveBeenCalledWith({
      containerId: 'CNT-000001',
      locationId: 'loc-1'
    });
    expect(view.text()).toContain('Current containers');
    expect(view.findByTestId('cell-placement-task-place-existing')).toBeNull();

    view.unmount();
  });

  it('keeps policy compact in details mode and hides inline policy editing UI', () => {
    mockPolicyAssignments = [
      makePolicyAssignment({
        id: 'role-1',
        role: 'primary_pick',
        product: {
          id: 'product-1',
          name: 'Widget',
          sku: 'W-1',
          imageUrl: null
        }
      })
    ];

    const view = renderInteractiveInspector();

    expect(view.findByTestId('cell-placement-policy-summary')).not.toBeNull();
    expect(view.findByTestId('cell-placement-policy-editor')).toBeNull();
    expect(view.text()).toContain('Edit policy');
    expect(view.text()).not.toContain('+ Add SKU policy');
    expect(view.text()).not.toContain('Search by name or SKU');
    expect(view.text()).not.toContain('Save policy');

    view.unmount();
  });

  it('opens only the edit-policy task body from the launcher', () => {
    mockPolicyAssignments = [
      makePolicyAssignment({
        id: 'role-1',
        role: 'reserve',
        product: {
          id: 'product-1',
          name: 'Widget',
          sku: 'W-1',
          imageUrl: null
        }
      })
    ];

    const view = renderInteractiveInspector();

    act(() => {
      view.findButtonByText('Edit policy')?.props.onClick();
    });

    expect(view.findByTestId('cell-placement-task-header')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-body')).not.toBeNull();
    expect(view.text()).toContain('Inspector task');
    expect(view.text()).toContain('Edit location policy');
    expect(view.findByTestId('cell-placement-task-edit-policy')).not.toBeNull();
    expect(view.findByTestId('cell-placement-policy-editor')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-place-existing')).toBeNull();
    expect(view.findByTestId('cell-placement-task-create-and-place')).toBeNull();
    expect(view.text()).toContain('+ Add SKU policy');
    expect(view.text()).not.toContain('Current containers');

    view.unmount();
  });

  it('returns to details mode when backing out of policy task mode', () => {
    const view = renderInteractiveInspector();

    act(() => {
      view.findButtonByText('Edit policy')?.props.onClick();
    });

    act(() => {
      view.findButtonByText('Back')?.props.onClick();
    });

    expect(view.findByTestId('cell-placement-details-view')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-edit-policy')).toBeNull();
    expect(view.findByTestId('cell-placement-policy-summary')).not.toBeNull();
    expect(view.text()).toContain('Current containers');

    view.unmount();
  });

  it('resets to details mode when selection changes during policy editing', () => {
    const view = renderInteractiveInspector();

    act(() => {
      view.findButtonByText('Edit policy')?.props.onClick();
    });

    mockSelection = { type: 'cell', cellId: 'cell-2' };
    mockPublishedCells = [{ id: 'cell-2', address: { raw: 'A-01-02' } }];
    mockLocationRef = { locationId: 'loc-2' };

    view.rerender();

    expect(view.findByTestId('cell-placement-task-edit-policy')).toBeNull();
    expect(view.findByTestId('cell-placement-policy-summary')).not.toBeNull();
    expect(view.text()).toContain('A-01-02');

    view.unmount();
  });

  it('keeps details sections out of the task body while task mode is active', () => {
    const view = renderInteractiveInspector();

    act(() => {
      view.findButtonByText('Place existing container')?.props.onClick();
    });

    expect(view.findByTestId('cell-placement-task-view')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-body')).not.toBeNull();
    expect(view.findByTestId('cell-placement-details-view')).toBeNull();
    expect(view.findByTestId('cell-placement-task-place-existing')).not.toBeNull();
    expect(view.findByTestId('cell-placement-policy-summary')).toBeNull();
    expect(view.text()).not.toContain('Current containers');
    expect(view.text()).not.toContain('Current inventory');
    expect(view.text()).not.toContain('Placement actions');
    expect(view.text()).not.toContain('Location Policy');

    view.unmount();
  });

  it('supports switching directly between task modes without returning to details first', () => {
    const view = renderInteractiveInspector();

    act(() => {
      view.findButtonByText('Place existing container')?.props.onClick();
    });

    act(() => {
      view.findButtonByText('Back')?.props.onClick();
    });

    act(() => {
      view.findButtonByText('Edit policy')?.props.onClick();
    });

    expect(view.findByTestId('cell-placement-task-place-existing')).toBeNull();
    expect(view.findByTestId('cell-placement-task-edit-policy')).not.toBeNull();
    expect(view.findByTestId('cell-placement-task-header')).not.toBeNull();

    view.unmount();
  });
});

describe('CellPlacementInspector view mode read-only gating', () => {
  beforeEach(() => {
    mockViewMode = 'view';
    mockContainerTypes = [pallet];
    mockPolicyAssignments = [
      makePolicyAssignment({
        id: 'role-1',
        role: 'primary_pick',
        product: {
          id: 'product-1',
          name: 'Widget',
          sku: 'W-1',
          imageUrl: null
        }
      })
    ];
  });

  it('keeps object detail visible but hides storage mutation launchers in view mode', () => {
    mockStorageData = [
      makeStorageRow({
        containerId: 'c1',
        locationId: 'loc-1',
        cellId: 'cell-1'
      })
    ];

    const view = renderInteractiveInspector();

    expect(view.text()).toContain('View');
    expect(view.text()).toContain('Current containers');
    expect(view.text()).toContain('Current inventory');
    expect(view.text()).toContain('Location Policy');
    expect(view.text()).not.toContain('Placement actions');
    expect(view.text()).not.toContain('Place existing container');
    expect(view.text()).not.toContain('+ Create container');
    expect(view.text()).not.toContain('Edit policy');
    expect(view.findByTestId('cell-placement-task-view')).toBeNull();

    view.unmount();
  });
});

describe('summarizeInventory', () => {
  it('returns an empty array when no inventory rows are present', () => {
    const rows = [makeStorageRow({ containerId: 'c1' })];
    expect(summarizeInventory(rows)).toEqual([]);
  });

  it('aggregates matching product rows across containers', () => {
    const product = makeProduct({ id: '55555555-5555-5555-5555-555555555555', name: 'Widget', sku: 'W-1' });

    const rows = [
      makeStorageRow({
        containerId: 'c1',
        itemRef: 'product:55555555-5555-5555-5555-555555555555',
        product,
        quantity: 4,
        uom: 'ea'
      }),
      makeStorageRow({
        containerId: 'c2',
        itemRef: 'product:55555555-5555-5555-5555-555555555555',
        product,
        quantity: 6,
        uom: 'ea'
      })
    ];

    expect(summarizeInventory(rows)).toEqual([
      expect.objectContaining({
        itemRef: 'product:55555555-5555-5555-5555-555555555555',
        totalQuantity: 10,
        uom: 'ea',
        containerCount: 2,
        product
      })
    ]);
  });

  it('keeps separate rows when item or unit differ', () => {
    const widget = makeProduct({ id: '55555555-5555-5555-5555-555555555555', name: 'Widget' });
    const rows = [
      makeStorageRow({
        containerId: 'c1',
        itemRef: 'product:55555555-5555-5555-5555-555555555555',
        product: widget,
        quantity: 4,
        uom: 'ea'
      }),
      makeStorageRow({
        containerId: 'c2',
        itemRef: 'LEGACY-ITEM-42',
        product: null,
        quantity: 2,
        uom: 'box'
      })
    ];

    const result = summarizeInventory(rows);
    expect(result).toHaveLength(2);
    expect(result.map((row) => row.totalQuantity)).toEqual([4, 2]);
  });
});

describe('getCreateAndPlaceDisabledReasons', () => {
  it('does not require container code to enable create-and-place', () => {
    expect(
      getCreateAndPlaceDisabledReasons({
        isActionPending: false,
        locationId: '33333333-3333-3333-3333-333333333333',
        containerTypeId: 'pallet',
        storableTypeCount: 1
      })
    ).toEqual([]);
  });

  it('still requires a container type', () => {
    expect(
      getCreateAndPlaceDisabledReasons({
        isActionPending: false,
        locationId: '33333333-3333-3333-3333-333333333333',
        containerTypeId: '',
        storableTypeCount: 1
      })
    ).toEqual(['missing type']);
  });
});

describe('formatCreateAndPlacePlacementFailure', () => {
  it('uses the generated system code in the partial-failure message', () => {
    expect(
      formatCreateAndPlacePlacementFailure('CNT-000123', 'Placement failed.')
    ).toBe(
      'Container CNT-000123 was created, but it could not be placed into this cell and remains unplaced. Placement failed.'
    );
  });
});

describe('container identity display helpers', () => {
  it('uses systemCode as the primary display label even when externalCode is null', () => {
    expect(
      getContainerDisplayLabel({
        systemCode: 'CNT-000321',
        externalCode: null
      })
    ).toBe('CNT-000321');
  });

  it('keeps externalCode only in secondary metadata when present', () => {
    expect(
      getContainerDisplaySecondary({
        externalCode: 'PALLET-001',
        containerType: 'Pallet',
        placedAt: 'Jan 1, 2026'
      })
    ).toBe('PALLET-001 · Pallet · placed Jan 1, 2026');
  });

  it('omits the old No code-style secondary fallback when externalCode is absent', () => {
    expect(
      getContainerDisplaySecondary({
        externalCode: null,
        containerType: 'Pallet',
        placedAt: 'Jan 1, 2026'
      })
    ).toBe('Pallet · placed Jan 1, 2026');
  });
});
