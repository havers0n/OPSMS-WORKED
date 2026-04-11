import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cell, LocationStorageSnapshotRow } from '@wos/domain';
import { StorageCellContextPanel } from './storage-cell-context-panel';

let mockSelectedCellId: string | null = 'cell-1';
let mockPublishedCells: Cell[] = [];
let mockLocationRef: { locationId: string; locationCode: string; locationType: string } | null = null;
let mockLocationByCellPending = false;
let mockLocationByCellError = false;
let mockLocationRows: LocationStorageSnapshotRow[] = [];
let mockLocationStoragePending = false;
let mockLocationStorageError = false;
let mockPolicyAssignmentsPending = false;
let mockPolicyAssignmentsError = false;
let mockPolicyBridgeCandidate: {
  product: { id: string; name: string; sku: string | null };
  containerCount: number;
  missingPrimaryPick: boolean;
  missingReserve: boolean;
} | null = null;
let mockPolicyBridgeError: string | null = null;
let mockIsAssignPending = false;

const startPlaceContainerWorkflowSpy = vi.fn();
const startCreateAndPlaceWorkflowSpy = vi.fn();
const startPlacementMoveSpy = vi.fn();
const setSelectedContainerIdSpy = vi.fn();
const handleAssignPolicyRoleSpy = vi.fn();

vi.mock('@/widgets/warehouse-editor/model/storage-ui-facade', async () => {
  const actual = await vi.importActual<
    typeof import('@/widgets/warehouse-editor/model/storage-ui-facade')
  >(
    '@/widgets/warehouse-editor/model/storage-ui-facade'
  );

  return {
    ...actual,
    useStorageSelectedCellId: () => mockSelectedCellId,
    useStorageStartPlaceContainerWorkflow: () => startPlaceContainerWorkflowSpy,
    useStorageStartCreateAndPlaceWorkflow: () => startCreateAndPlaceWorkflowSpy,
    useStorageStartPlacementMove: () => startPlacementMoveSpy,
    useStorageSetSelectedContainerId: () => setSelectedContainerIdSpy
  };
});

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: () => ({ data: mockPublishedCells })
}));

vi.mock('@/entities/location/api/use-location-by-cell', () => ({
  useLocationByCell: () => ({
    data: mockLocationRef,
    isPending: mockLocationByCellPending,
    isError: mockLocationByCellError
  })
}));

vi.mock('@/entities/location/api/use-location-storage', () => ({
  useLocationStorage: () => ({
    data: mockLocationRows,
    isPending: mockLocationStoragePending,
    isError: mockLocationStorageError
  })
}));

vi.mock('@/entities/product-location-role/api/use-location-product-assignments', () => ({
  useLocationProductAssignments: () => ({
    data: [],
    isPending: mockPolicyAssignmentsPending,
    isError: mockPolicyAssignmentsError
  })
}));

vi.mock('@/entities/product-location-role/api/mutations', () => ({
  useCreateProductLocationRole: () => ({
    isPending: false,
    mutateAsync: vi.fn()
  })
}));

vi.mock('./use-policy-bridge-actions', () => ({
  usePolicyBridgeActions: () => ({
    policyBridgeCandidate: mockPolicyBridgeCandidate,
    policyBridgeError: mockPolicyBridgeError,
    isAssignPending: mockIsAssignPending,
    handleAssignPolicyRole: handleAssignPolicyRoleSpy
  })
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPanel() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(StorageCellContextPanel, { workspace: null, panelMode: 'compact' })
    );
  });
  return renderer;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, text: string) {
  return JSON.stringify(renderer.toJSON()).includes(text);
}

function findButtonByLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
  const buttons = renderer.root.findAll((node) => {
    if (node.type !== 'button') return false;
    const children = node.props.children;
    if (typeof children === 'string') return children === label;
    if (Array.isArray(children)) return children.includes(label);
    return false;
  });
  if (buttons.length !== 1) {
    throw new Error(`Expected exactly one button with label "${label}", found ${buttons.length}.`);
  }
  return buttons[0];
}

beforeEach(() => {
  startPlaceContainerWorkflowSpy.mockReset();
  startCreateAndPlaceWorkflowSpy.mockReset();
  startPlacementMoveSpy.mockReset();
  setSelectedContainerIdSpy.mockReset();
  handleAssignPolicyRoleSpy.mockReset();

  mockSelectedCellId = 'cell-1';
  mockPublishedCells = [
    {
      id: 'cell-1',
      layoutVersionId: 'lv-1',
      rackId: 'rack-1',
      rackFaceId: 'face-a',
      rackSectionId: 'section-a',
      rackLevelId: 'level-1',
      slotNo: 1,
      address: {
        raw: '01-A.01.01.01',
        parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: 1 },
        sortKey: '0001-A-01-01-01'
      },
      cellCode: 'CELL-1',
      status: 'active'
    }
  ];
  mockLocationRef = { locationId: 'loc-1', locationCode: 'LOC-1', locationType: 'rack_slot' };
  mockLocationByCellPending = false;
  mockLocationByCellError = false;
  mockLocationRows = [
    {
      tenantId: '11111111-1111-1111-1111-111111111111',
      floorId: '22222222-2222-2222-2222-222222222222',
      locationId: '33333333-3333-3333-3333-333333333333',
      locationCode: 'LOC-1',
      locationType: 'rack_slot',
      cellId: 'cell-1',
      containerId: '44444444-4444-4444-4444-444444444444',
      systemCode: 'CNT-1',
      externalCode: null,
      containerType: 'TOTE',
      containerStatus: 'active',
      placedAt: '2026-01-01T00:00:00.000Z',
      itemRef: null,
      product: null,
      quantity: null,
      uom: null
    }
  ];
  mockLocationStoragePending = false;
  mockLocationStorageError = false;
  mockPolicyAssignmentsPending = false;
  mockPolicyAssignmentsError = false;
  mockPolicyBridgeCandidate = null;
  mockPolicyBridgeError = null;
  mockIsAssignPending = false;
});

describe('StorageCellContextPanel', () => {
  it('renders identity + launchers only, without duplicate truth/detail summaries', () => {
    const renderer = renderPanel();

    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-cell-context-launcher' })).toHaveLength(1);
    expect(hasText(renderer, '01-A.01.01.01')).toBe(true);
    expect(hasText(renderer, 'LOC-1 | Rack Slot')).toBe(true);
    expect(hasText(renderer, 'Place')).toBe(true);
    expect(hasText(renderer, 'Create + place')).toBe(true);
    expect(hasText(renderer, 'Move')).toBe(true);

    expect(hasText(renderer, 'Containers')).toBe(false);
    expect(hasText(renderer, 'Inventory rows')).toBe(false);
    expect(hasText(renderer, 'Full containers, inventory, and policy detail stay in the inspector.')).toBe(false);
    expect(hasText(renderer, 'Stock has no location role')).toBe(false);
    expect(hasText(renderer, 'Present in')).toBe(false);
  });

  it('keeps launcher surface authority-only for starts and never exposes workflow submit/cancel controls', () => {
    const renderer = renderPanel();

    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-submit-action' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-cancel-action' })).toHaveLength(0);

    const placeButton = renderer.root.findByProps({ 'data-testid': 'storage-cell-context-launch-place' });
    const createAndPlaceButton = renderer.root.findByProps({
      'data-testid': 'storage-cell-context-launch-create-place'
    });

    act(() => {
      placeButton.props.onClick();
      createAndPlaceButton.props.onClick();
    });

    expect(startPlaceContainerWorkflowSpy).toHaveBeenCalledWith('cell-1');
    expect(startCreateAndPlaceWorkflowSpy).toHaveBeenCalledWith('cell-1');
  });

  it('keeps move launcher behavior for single-container source unchanged', () => {
    const renderer = renderPanel();
    const moveButton = renderer.root.findByProps({ 'data-testid': 'storage-cell-context-launch-move' });

    act(() => {
      moveButton.props.onClick();
    });

    expect(setSelectedContainerIdSpy).toHaveBeenCalledWith(
      '44444444-4444-4444-4444-444444444444',
      'cell-1'
    );
    expect(startPlacementMoveSpy).toHaveBeenCalledWith(
      '44444444-4444-4444-4444-444444444444',
      'cell-1'
    );
  });

  it('renders policy bridge as launcher-only action entry', () => {
    mockPolicyBridgeCandidate = {
      product: { id: 'product-1', name: 'Widget', sku: 'W-001' },
      containerCount: 3,
      missingPrimaryPick: true,
      missingReserve: false
    };

    const renderer = renderPanel();
    const policyCard = renderer.root.findAllByProps({ 'data-testid': 'stock-policy-bridge-card' });

    expect(policyCard).toHaveLength(1);
    expect(hasText(renderer, 'Policy quick action')).toBe(true);
    expect(hasText(renderer, 'Assign an operational role for this SKU.')).toBe(true);
    expect(hasText(renderer, 'Widget')).toBe(true);
    expect(hasText(renderer, 'W-001')).toBe(true);
    expect(hasText(renderer, 'Stock has no location role')).toBe(false);
    expect(hasText(renderer, 'Present in')).toBe(false);

    const assignPrimaryPickButton = findButtonByLabel(renderer, 'Assign primary pick');
    act(() => {
      assignPrimaryPickButton.props.onClick();
    });

    expect(handleAssignPolicyRoleSpy).toHaveBeenCalledWith('primary_pick');
  });
});
