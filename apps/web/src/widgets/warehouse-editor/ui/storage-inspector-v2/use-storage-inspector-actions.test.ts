import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useStorageInspectorActions } from './use-storage-inspector-actions';
import {
  refreshAfterAddProduct,
  refreshAfterCreateOrPlace,
  refreshAfterMove,
  refreshOverrideReadSurface
} from './use-storage-inspector-actions.refresh';

const mockCreateContainer = vi.fn();
const mockPlaceContainer = vi.fn();
const mockMoveContainer = vi.fn();
const mockAddInventoryItem = vi.fn();
const mockAddInventoryToContainerMutateAsync = vi.fn();
const mockCreateProductLocationRoleMutateAsync = vi.fn();
const mockDeleteProductLocationRoleMutateAsync = vi.fn();
const mockInvalidatePlacementQueries = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockRefetchQueries = vi.fn();
const mockFetchQuery = vi.fn();

vi.mock('@/features/container-create/api/mutations', () => ({
  createContainer: (...args: unknown[]) => mockCreateContainer(...args)
}));

vi.mock('@/features/placement-actions/api/mutations', () => ({
  placeContainer: (...args: unknown[]) => mockPlaceContainer(...args),
  moveContainer: (...args: unknown[]) => mockMoveContainer(...args)
}));

vi.mock('@/features/inventory-add/api/mutations', () => ({
  addInventoryItem: (...args: unknown[]) => mockAddInventoryItem(...args)
}));

vi.mock('@/features/container-inventory/model/use-add-inventory-to-container', () => ({
  useAddInventoryToContainer: () => ({
    mutateAsync: (...args: unknown[]) => mockAddInventoryToContainerMutateAsync(...args),
    isPending: false
  })
}));

vi.mock('@/entities/product-location-role/api/mutations', () => ({
  useCreateProductLocationRole: () => ({
    mutateAsync: (...args: unknown[]) => mockCreateProductLocationRoleMutateAsync(...args),
    isPending: false
  }),
  useDeleteProductLocationRole: () => ({
    mutateAsync: (...args: unknown[]) => mockDeleteProductLocationRoleMutateAsync(...args),
    isPending: false
  })
}));

vi.mock('@/features/placement-actions/model/invalidation', () => ({
  invalidatePlacementQueries: (...args: unknown[]) => mockInvalidatePlacementQueries(...args)
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
      refetchQueries: mockRefetchQueries,
      fetchQuery: mockFetchQuery
    })
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('use-storage-inspector-actions.refresh', () => {
  beforeEach(() => {
    mockInvalidatePlacementQueries.mockReset();
    mockInvalidateQueries.mockReset();
    mockRefetchQueries.mockReset();
  });

  it('groups create/place refresh calls', async () => {
    const queryClient = {
      invalidateQueries: mockInvalidateQueries,
      refetchQueries: mockRefetchQueries
    } as unknown as Parameters<typeof refreshAfterCreateOrPlace>[0]['queryClient'];

    await refreshAfterCreateOrPlace({
      queryClient,
      floorId: 'floor-1',
      locationId: 'loc-1',
      containerId: 'c-1'
    });

    expect(mockInvalidatePlacementQueries).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['location', 'storage', 'loc-1'] });
  });

  it('groups add-product and override refresh calls', async () => {
    const queryClient = {
      refetchQueries: mockRefetchQueries
    } as unknown as Parameters<typeof refreshAfterAddProduct>[0]['queryClient'];

    await refreshAfterAddProduct({ queryClient, locationId: 'loc-1', containerId: 'c-1' });
    await refreshOverrideReadSurface({ queryClient, locationId: 'loc-1', productId: 'p-1' });

    expect(mockRefetchQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'storage', 'loc-1'],
      exact: true
    });
    expect(mockRefetchQueries).toHaveBeenCalledWith({
      queryKey: ['container', 'storage', 'c-1'],
      exact: true
    });
    expect(mockRefetchQueries).toHaveBeenCalledWith({
      queryKey: ['product-location-role', 'effective-role', 'loc-1', 'p-1'],
      exact: true
    });
  });

  it('groups move refresh calls', async () => {
    const queryClient = {
      invalidateQueries: mockInvalidateQueries
    } as unknown as Parameters<typeof refreshAfterMove>[0]['queryClient'];

    await refreshAfterMove({
      queryClient,
      floorId: 'floor-1',
      sourceCellId: 'cell-1',
      containerId: 'c-1'
    });

    expect(mockInvalidatePlacementQueries).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['container', 'current-location', 'c-1']
    });
  });
});

describe('useStorageInspectorActions intents', () => {
  beforeEach(() => {
    mockCreateContainer.mockReset();
    mockPlaceContainer.mockReset();
    mockInvalidatePlacementQueries.mockReset();
    mockInvalidateQueries.mockReset();
    mockRefetchQueries.mockReset();
    mockFetchQuery.mockReset();
  });

  it('executes create-container intent and runs grouped refresh', async () => {
    mockCreateContainer.mockResolvedValue({ containerId: 'c-1' });
    mockPlaceContainer.mockResolvedValue(undefined);

    let intents!: ReturnType<typeof useStorageInspectorActions>;

    function Harness() {
      intents = useStorageInspectorActions({
        floorId: 'floor-1',
        locationId: 'loc-1',
        addProductSourceCellId: null,
        addProductContainerId: null
      });
      return null;
    }

    act(() => {
      TestRenderer.create(createElement(Harness));
    });

    const onSuccess = vi.fn();
    const setSubmitting = vi.fn();
    const setError = vi.fn();

    await act(async () => {
      await intents.onCreateContainer({
        containerTypeId: 'ct-1',
        externalCode: 'EXT-1',
        isSubmitting: false,
        setIsSubmitting: setSubmitting,
        setErrorMessage: setError,
        onSuccess
      });
    });

    expect(mockCreateContainer).toHaveBeenCalledWith({
      containerTypeId: 'ct-1',
      externalCode: 'EXT-1'
    });
    expect(mockPlaceContainer).toHaveBeenCalledWith({ containerId: 'c-1', locationId: 'loc-1' });
    expect(mockInvalidatePlacementQueries).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
