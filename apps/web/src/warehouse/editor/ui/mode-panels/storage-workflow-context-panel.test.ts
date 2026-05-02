import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveStorageWorkflow } from '@/warehouse/editor/model/editor-types';
import { StorageWorkflowContextPanel } from './storage-workflow-context-panel';

let mockActiveStorageWorkflow: ActiveStorageWorkflow = null;
let mockPublishedCells = [
  {
    id: 'cell-source',
    address: { raw: '01-A.01.01.01' }
  },
  {
    id: 'cell-target',
    address: { raw: '01-A.01.01.02' }
  }
];
let mockLocationByCell: { locationId: string } | null = { locationId: 'loc-1' };
let mockContainerTypes = [
  {
    id: 'type-1',
    code: 'TOTE',
    canStoreItems: true
  }
];
let mockContainerTypesPending = false;
let mockContainerTypesError = false;
let mockIsSubmitting = false;

const cancelPlacementInteractionSpy = vi.fn();
const markActiveStorageWorkflowSubmittingSpy = vi.fn();
const setActiveStorageWorkflowErrorSpy = vi.fn();
const setCreateAndPlacePlacementRetrySpy = vi.fn();
const setSelectedCellIdSpy = vi.fn();

const handleConfirmMoveSpy = vi.fn();
const handleConfirmPlaceSpy = vi.fn();
const handleCreateAndPlaceSpy = vi.fn();
const handleRetryCreatedContainerPlacementSpy = vi.fn();

vi.mock('@/warehouse/editor/model/storage-ui-facade', async () => {
  const actual = await vi.importActual<
    typeof import('@/warehouse/editor/model/storage-ui-facade')
  >(
    '@/warehouse/editor/model/storage-ui-facade'
  );

  return {
    ...actual,
    useStorageActiveWorkflow: () => mockActiveStorageWorkflow,
    useStorageCancelPlacementInteraction: () => cancelPlacementInteractionSpy,
    useStorageMarkWorkflowSubmitting: () => markActiveStorageWorkflowSubmittingSpy,
    useStorageSetWorkflowError: () => setActiveStorageWorkflowErrorSpy,
    useStorageSetCreateAndPlacePlacementRetry: () => setCreateAndPlacePlacementRetrySpy,
    useStorageSetSelectedCellId: () => setSelectedCellIdSpy
  };
});

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: () => ({ data: mockPublishedCells })
}));

vi.mock('@/entities/location/api/use-location-by-cell', () => ({
  useLocationByCell: () => ({ data: mockLocationByCell })
}));

vi.mock('@/entities/container/api/use-container-types', () => ({
  useContainerTypes: () => ({
    data: mockContainerTypes,
    isPending: mockContainerTypesPending,
    isError: mockContainerTypesError
  })
}));

vi.mock('./use-storage-workflow-actions', () => ({
  useStorageWorkflowActions: () => ({
    isSubmitting: mockIsSubmitting,
    handleConfirmMove: handleConfirmMoveSpy,
    handleConfirmPlace: handleConfirmPlaceSpy,
    handleCreateAndPlace: handleCreateAndPlaceSpy,
    handleRetryCreatedContainerPlacement: handleRetryCreatedContainerPlacementSpy
  })
}));

vi.mock('./cell-placement-inspector.lib', () => ({
  filterStorableTypes: (types: Array<{ canStoreItems?: boolean }>) =>
    types.filter((type) => type.canStoreItems !== false),
  getCreateAndPlaceDisabledReasons: ({
    isActionPending,
    locationId,
    containerTypeId,
    storableTypeCount
  }: {
    isActionPending: boolean;
    locationId: string | null;
    containerTypeId: string;
    storableTypeCount: number;
  }) => {
    const reasons: string[] = [];
    if (isActionPending) reasons.push('pending');
    if (!locationId) reasons.push('missing-location');
    if (!containerTypeId) reasons.push('missing-container-type');
    if (storableTypeCount <= 0) reasons.push('no-storable-types');
    return reasons;
  }
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPanel() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(StorageWorkflowContextPanel, { workspace: null, panelMode: 'compact' })
    );
  });
  return renderer;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, text: string) {
  return JSON.stringify(renderer.toJSON()).includes(text);
}

beforeEach(() => {
  mockActiveStorageWorkflow = null;
  mockPublishedCells = [
    {
      id: 'cell-source',
      address: { raw: '01-A.01.01.01' }
    },
    {
      id: 'cell-target',
      address: { raw: '01-A.01.01.02' }
    }
  ];
  mockLocationByCell = { locationId: 'loc-1' };
  mockContainerTypes = [
    {
      id: 'type-1',
      code: 'TOTE',
      canStoreItems: true
    }
  ];
  mockContainerTypesPending = false;
  mockContainerTypesError = false;
  mockIsSubmitting = false;

  cancelPlacementInteractionSpy.mockReset();
  markActiveStorageWorkflowSubmittingSpy.mockReset();
  setActiveStorageWorkflowErrorSpy.mockReset();
  setCreateAndPlacePlacementRetrySpy.mockReset();
  setSelectedCellIdSpy.mockReset();
  handleConfirmMoveSpy.mockReset();
  handleConfirmPlaceSpy.mockReset();
  handleCreateAndPlaceSpy.mockReset();
  handleRetryCreatedContainerPlacementSpy.mockReset();
});

describe('StorageWorkflowContextPanel', () => {
  it('shows non-authoritative placeholder when there is no active workflow', () => {
    const renderer = renderPanel();

    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-context-owner' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-submit-action' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-cancel-action' })).toHaveLength(0);
    expect(hasText(renderer, 'Workflow state will appear here while a storage operation is active.')).toBe(true);
  });

  it('keeps active move workflow authority inside owner root and blocks submit until target is valid', () => {
    mockActiveStorageWorkflow = {
      kind: 'move-container',
      status: 'targeting',
      containerId: 'container-1',
      sourceCellId: 'cell-source',
      targetCellId: null,
      errorMessage: null
    };

    const renderer = renderPanel();
    const submitButton = renderer.root.findByProps({ 'data-testid': 'storage-workflow-submit-action' });
    const cancelButton = renderer.root.findByProps({ 'data-testid': 'storage-workflow-cancel-action' });

    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-context-owner' })).toHaveLength(1);
    expect(hasText(renderer, 'Click a destination cell on the canvas.')).toBe(true);
    expect(submitButton.props.disabled).toBe(true);

    act(() => {
      cancelButton.props.onClick();
    });

    expect(cancelPlacementInteractionSpy).toHaveBeenCalledTimes(1);
    expect(handleConfirmMoveSpy).not.toHaveBeenCalled();
  });

  it('routes move submit authority through workflow actions when target is valid', () => {
    mockActiveStorageWorkflow = {
      kind: 'move-container',
      status: 'targeting',
      containerId: 'container-1',
      sourceCellId: 'cell-source',
      targetCellId: 'cell-target',
      errorMessage: null
    };

    const renderer = renderPanel();
    const submitButton = renderer.root.findByProps({ 'data-testid': 'storage-workflow-submit-action' });

    expect(submitButton.props.disabled).toBe(false);

    act(() => {
      void submitButton.props.onClick();
    });

    expect(handleConfirmMoveSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps place workflow submit/cancel authority in workflow owner root', () => {
    mockActiveStorageWorkflow = {
      kind: 'place-container',
      status: 'editing',
      cellId: 'cell-source',
      errorMessage: null
    };

    const renderer = renderPanel();
    const submitButton = renderer.root.findByProps({ 'data-testid': 'storage-workflow-submit-action' });
    const cancelButton = renderer.root.findByProps({ 'data-testid': 'storage-workflow-cancel-action' });
    const input = renderer.root.findByType('input');

    expect(submitButton.props.disabled).toBe(true);
    act(() => {
      input.props.onChange({ target: { value: 'CNT-123' } });
    });
    const enabledSubmitButton = renderer.root.findByProps({ 'data-testid': 'storage-workflow-submit-action' });
    expect(enabledSubmitButton.props.disabled).toBe(false);

    act(() => {
      void enabledSubmitButton.props.onClick();
      cancelButton.props.onClick();
    });

    expect(handleConfirmPlaceSpy).toHaveBeenCalledTimes(1);
    expect(cancelPlacementInteractionSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps create-and-place submit authority in workflow owner root', () => {
    mockActiveStorageWorkflow = {
      kind: 'create-and-place',
      status: 'editing',
      cellId: 'cell-source',
      errorMessage: null,
      createdContainer: null
    };

    const renderer = renderPanel();
    const submitButton = renderer.root.findByProps({ 'data-testid': 'storage-workflow-submit-action' });
    const cancelButton = renderer.root.findByProps({ 'data-testid': 'storage-workflow-cancel-action' });

    expect(submitButton.props.disabled).toBe(false);

    act(() => {
      void submitButton.props.onClick();
      cancelButton.props.onClick();
    });

    expect(handleCreateAndPlaceSpy).toHaveBeenCalledTimes(1);
    expect(cancelPlacementInteractionSpy).toHaveBeenCalledTimes(1);
  });
});
