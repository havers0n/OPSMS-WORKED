import type { FloorWorkspace, Product, Rack } from '@wos/domain';
import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useContainerTypes } from '@/entities/container/api/use-container-types';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { locationKeys } from '@/entities/location/api/queries';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import { useProductsSearch } from '@/entities/product/api/use-products-search';
import { useRackInspector } from '@/entities/rack/api/use-rack-inspector';
import { useLocationProductAssignments } from '@/entities/product-location-role/api/use-location-product-assignments';
import {
  useCreateProductLocationRole,
  useDeleteProductLocationRole
} from '@/entities/product-location-role/api/mutations';
import { createContainer } from '@/features/container-create/api/mutations';
import { addInventoryItem } from '@/features/inventory-add/api/mutations';
import { moveContainer as moveContainerApi, placeContainer } from '@/features/placement-actions/api/mutations';
import { invalidatePlacementQueries } from '@/features/placement-actions/model/invalidation';
import { containerKeys, containerStorageQueryOptions } from '@/entities/container/api/queries';
import { useAddInventoryToContainer } from '@/features/container-inventory/model/use-add-inventory-to-container';
import {
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId,
  useStorageFocusActiveLevel,
  useStorageFocusSelectCell
} from '../model/v2/v2-selectors';
import {
  INVENTORY_PREVIEW_LIMIT,
  getActiveProducts,
  getPolicyEditGuardReason,
  groupByContainer,
  hasInventoryRows,
  policySummaryText,
  resolvePolicySummaryState,
  type PolicyRoleChoice
} from './storage-inspector-v2/helpers';
import {
  resolveActiveMode,
  resolvePanelMode,
  type MoveTaskState,
  type TaskKind
} from './storage-inspector-v2/mode';
import {
  ContainerTypeSelect,
  InspectorFooter,
  OccupancyBar,
  SectionHeader,
  StatusBadge
} from './storage-inspector-v2/shared';
import { CreateContainerTaskPanel } from './storage-inspector-v2/task-create-container-panel';
import { CreateContainerWithProductTaskPanel } from './storage-inspector-v2/task-create-container-with-product-panel';
import { MoveContainerTaskPanel } from './storage-inspector-v2/task-move-container-panel';
import { EditPolicyTaskPanel } from './storage-inspector-v2/task-edit-policy-panel';
import { AddProductToContainerTaskPanel } from './storage-inspector-v2/task-add-product-panel';

export { resolvePanelMode, resolveActiveMode } from './storage-inspector-v2/mode';
export type { MoveTaskState } from './storage-inspector-v2/mode';

interface StorageInspectorV2Props {
  workspace: FloorWorkspace | null;
}

function EmptyState() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
      <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">No location selected</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">Select a location from the navigator to view details</p>
      </div>
      <InspectorFooter />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
      <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
        <p className="text-sm text-gray-400">Loading location…</p>
      </div>
      <InspectorFooter />
    </div>
  );
}

function RackOverviewPanel({ rackId }: { rackId: string }) {
  const { data, isLoading, isError } = useRackInspector(rackId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <p className="text-sm text-gray-400">Loading rack…</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <p className="text-sm text-red-500">Failed to load rack data</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden" role="complementary" aria-label={`Rack overview: ${data.displayCode}`}>
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-mono font-semibold text-gray-900">{data.displayCode}</span>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="capitalize">{data.kind}</span>
            <span className="text-gray-300">·</span>
            <span>{data.axis}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SectionHeader title="Occupancy" />
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <OccupancyBar rate={data.occupancySummary.occupancyRate} />
          <div className="text-xs text-gray-500">
            {data.occupancySummary.occupiedCells} / {data.occupancySummary.totalCells} cells occupied
          </div>
        </div>

        <SectionHeader title="Levels" />
        <div className="px-4 py-3 space-y-1.5">
          {data.levels.map((level) => (
            <div key={level.levelOrdinal} className="flex justify-between items-center text-xs text-gray-700">
              <span className="font-medium">L{level.levelOrdinal}:</span>
              <span className="text-gray-500">{level.occupiedCells}/{level.totalCells}</span>
            </div>
          ))}
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}

export function StorageInspectorV2({ workspace }: StorageInspectorV2Props) {
  const queryClient = useQueryClient();
  const racks: Record<string, Rack> | undefined = workspace?.latestPublished?.racks;
  const floorId = workspace?.floorId ?? null;
  const { data: publishedCells = [] } = usePublishedCells(floorId);

  const cellId = useStorageFocusSelectedCellId();
  const rackId = useStorageFocusSelectedRackId();
  const activeLevel = useStorageFocusActiveLevel() ?? 1;
  const rackDisplayCode = rackId ? (racks?.[rackId]?.displayCode ?? rackId) : '—';

  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [taskKind, setTaskKind] = useState<TaskKind | null>(null);
  const [moveTaskState, setMoveTaskState] = useState<MoveTaskState | null>(null);
  const [policyTaskError, setPolicyTaskError] = useState<string | null>(null);
  const [isPolicyTaskSaving, setIsPolicyTaskSaving] = useState(false);

  const [createContainerTypeId, setCreateContainerTypeId] = useState('');
  const [createExternalCode, setCreateExternalCode] = useState('');
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const [createIsSubmitting, setCreateIsSubmitting] = useState(false);

  const [createWithProductContainerTypeId, setCreateWithProductContainerTypeId] = useState('');
  const [createWithProductExternalCode, setCreateWithProductExternalCode] = useState('');
  const [createWithProductSearch, setCreateWithProductSearch] = useState('');
  const [createWithProductSelectedProduct, setCreateWithProductSelectedProduct] = useState<Product | null>(null);
  const [createWithProductQuantity, setCreateWithProductQuantity] = useState('');
  const [createWithProductUom, setCreateWithProductUom] = useState('');
  const [createWithProductErrorMessage, setCreateWithProductErrorMessage] = useState<string | null>(null);
  const [createWithProductIsSubmitting, setCreateWithProductIsSubmitting] = useState(false);

  const [addProductSearch, setAddProductSearch] = useState('');
  const [addProductSelectedProduct, setAddProductSelectedProduct] = useState<Product | null>(null);
  const [addProductQuantity, setAddProductQuantity] = useState('');
  const [addProductUom, setAddProductUom] = useState('');
  const [addProductErrorMessage, setAddProductErrorMessage] = useState<string | null>(null);

  const taskKindRef = useRef<TaskKind | null>(null);
  taskKindRef.current = taskKind;
  const moveTaskRef = useRef<MoveTaskState | null>(null);
  moveTaskRef.current = moveTaskState;

  const selectCell = useStorageFocusSelectCell();

  const { data: containerTypes = [] } = useContainerTypes();
  const { data: createWithProductSearchResults = [] } = useProductsSearch(createWithProductSearch.trim() || null);
  const { data: addProductSearchResults = [] } = useProductsSearch(addProductSearch.trim() || null);

  const { data: locationRef, isLoading: locationRefLoading } = useLocationByCell(cellId);
  const locationId = locationRef?.locationId ?? null;

  const { data: storageRows = [], isLoading: storageLoading } = useLocationStorage(locationId);
  const { data: policyAssignments = [] } = useLocationProductAssignments(locationId);
  const createProductLocationRole = useCreateProductLocationRole();
  const deleteProductLocationRole = useDeleteProductLocationRole(locationId);

  const mode = resolveActiveMode(resolvePanelMode(rackId, cellId, selectedContainerId), taskKind, moveTaskState);

  const addProductContainerId = mode.kind === 'task-add-product-to-container' ? mode.containerId : null;
  const addProductSourceCellId = mode.kind === 'task-add-product-to-container' ? mode.cellId : null;
  const addInventoryToContainer = useAddInventoryToContainer({
    floorId,
    sourceCellId: addProductSourceCellId,
    containerId: addProductContainerId
  });

  const moveTargetCellId = moveTaskState?.targetCellId ?? null;
  const { data: moveTargetLocationRef, isLoading: moveTargetLocationLoading } = useLocationByCell(moveTargetCellId);

  const resetCreateTaskState = () => {
    setCreateContainerTypeId('');
    setCreateExternalCode('');
    setCreateErrorMessage(null);
    setCreateIsSubmitting(false);
  };

  const resetCreateWithProductTaskState = () => {
    setCreateWithProductContainerTypeId('');
    setCreateWithProductExternalCode('');
    setCreateWithProductSearch('');
    setCreateWithProductSelectedProduct(null);
    setCreateWithProductQuantity('');
    setCreateWithProductUom('');
    setCreateWithProductErrorMessage(null);
    setCreateWithProductIsSubmitting(false);
  };

  const resetAddProductTaskState = () => {
    setAddProductSearch('');
    setAddProductSelectedProduct(null);
    setAddProductQuantity('');
    setAddProductUom('');
    setAddProductErrorMessage(null);
  };

  useEffect(() => {
    if (taskKindRef.current === 'move-container') {
      const current = moveTaskRef.current;
      if (cellId && current && cellId !== current.sourceCellId) {
        setMoveTaskState((prev) => (prev ? { ...prev, targetCellId: cellId } : null));
      }
      return;
    }

    setSelectedContainerId(null);
    setTaskKind(null);
    setMoveTaskState(null);
    setPolicyTaskError(null);
    setIsPolicyTaskSaving(false);
    resetCreateTaskState();
    resetCreateWithProductTaskState();
    resetAddProductTaskState();
  }, [cellId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCellAddress = publishedCells.find((cell) => cell.id === cellId)?.address.raw ?? null;
  const locationCode = storageRows[0]?.locationCode ?? selectedCellAddress ?? cellId;

  const closeCreateTask = () => {
    setTaskKind(null);
    resetCreateTaskState();
  };

  const closeCreateWithProductTask = () => {
    setTaskKind(null);
    resetCreateWithProductTaskState();
  };

  const closeAddProductTask = () => {
    setTaskKind(null);
    resetAddProductTaskState();
  };

  const openCreateTask = () => {
    resetCreateTaskState();
    setTaskKind('create-container');
  };

  const openCreateWithProductTask = () => {
    resetCreateWithProductTaskState();
    setTaskKind('create-container-with-product');
  };

  const openAddProductTask = () => {
    resetAddProductTaskState();
    setTaskKind('add-product-to-container');
  };

  const handleCreateTaskConfirm = async () => {
    if (!locationId || !createContainerTypeId || createIsSubmitting) return;

    setCreateIsSubmitting(true);
    setCreateErrorMessage(null);

    try {
      let containerId: string;
      try {
        const result = await createContainer({
          containerTypeId: createContainerTypeId,
          externalCode: createExternalCode.trim() || undefined
        });
        containerId = result.containerId;
      } catch {
        setCreateErrorMessage('Failed to create container.');
        return;
      }

      try {
        await placeContainer({ containerId, locationId });
      } catch {
        setCreateErrorMessage('Failed to place container at this location.');
        return;
      }

      await invalidatePlacementQueries(queryClient, { floorId, containerId });
      await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
      closeCreateTask();
    } finally {
      setCreateIsSubmitting(false);
    }
  };

  const handleCreateWithProductSelect = (product: Product) => {
    setCreateWithProductSelectedProduct(product);
    setCreateWithProductSearch(product.name ?? product.sku ?? '');
  };

  const handleCreateWithProductSearchChange = (value: string) => {
    setCreateWithProductSearch(value);
    setCreateWithProductSelectedProduct(null);
  };

  const handleCreateWithProductConfirm = async () => {
    if (
      !locationId ||
      !createWithProductContainerTypeId ||
      !createWithProductSelectedProduct ||
      createWithProductQuantity.trim() === '' ||
      Number(createWithProductQuantity) <= 0 ||
      createWithProductUom.trim() === '' ||
      createWithProductIsSubmitting
    ) {
      return;
    }

    setCreateWithProductIsSubmitting(true);
    setCreateWithProductErrorMessage(null);

    try {
      let containerId: string;
      try {
        const result = await createContainer({
          containerTypeId: createWithProductContainerTypeId,
          externalCode: createWithProductExternalCode.trim() || undefined
        });
        containerId = result.containerId;
      } catch {
        setCreateWithProductErrorMessage('Failed to create container.');
        return;
      }

      try {
        await placeContainer({ containerId, locationId });
      } catch {
        setCreateWithProductErrorMessage('Failed to place container at this location.');
        return;
      }

      try {
        await addInventoryItem({
          containerId,
          productId: createWithProductSelectedProduct.id,
          quantity: Number(createWithProductQuantity),
          uom: createWithProductUom.trim()
        });
      } catch {
        await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
        setCreateWithProductErrorMessage(
          'Container was created and placed, but inventory could not be added. The container is now empty at this location.'
        );
        return;
      }

      await invalidatePlacementQueries(queryClient, { floorId, containerId });
      await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
      closeCreateWithProductTask();
    } finally {
      setCreateWithProductIsSubmitting(false);
    }
  };

  const handleMoveStageChange = (stage: MoveTaskState['stage'], error?: string | null) => {
    setMoveTaskState((prev) => (prev ? { ...prev, stage, errorMessage: error ?? null } : null));
  };

  const handleMoveConfirm = async () => {
    if (!moveTaskState) return;
    const resolvedTargetLocationId = moveTargetLocationRef?.locationId ?? null;
    if (!resolvedTargetLocationId) return;

    handleMoveStageChange('moving');

    try {
      await moveContainerApi({
        containerId: moveTaskState.sourceContainerId,
        targetLocationId: resolvedTargetLocationId
      });
      await invalidatePlacementQueries(queryClient, {
        floorId,
        sourceCellId: moveTaskState.sourceCellId,
        containerId: moveTaskState.sourceContainerId
      });
      await queryClient.invalidateQueries({
        queryKey: containerKeys.currentLocation(moveTaskState.sourceContainerId)
      });
      handleMoveStageChange('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Move failed. Please try again.';
      handleMoveStageChange('error', message);
    }
  };

  const handleMoveCancel = () => {
    const source = moveTaskState!;
    setTaskKind(null);
    setMoveTaskState(null);
    setSelectedContainerId(null);

    const restoreRackId = source.sourceRackId ?? rackId;
    if (!restoreRackId) return;

    selectCell({
      cellId: source.sourceCellId,
      rackId: restoreRackId,
      level: source.sourceLevel ?? activeLevel ?? null
    });
  };

  const handleMoveDone = () => {
    const movedContainerId = moveTaskState!.sourceContainerId;
    setTaskKind(null);
    setMoveTaskState(null);
    setSelectedContainerId(movedContainerId);
  };

  const normalizePolicyForProductAtLocation = async (productId: string, choice: PolicyRoleChoice) => {
    if (!locationId) return;

    const publishedRows = policyAssignments.filter(
      (assignment) =>
        assignment.state === 'published' &&
        assignment.productId === productId &&
        assignment.locationId === locationId
    );

    const toDelete: string[] = [];

    if (choice === 'none') {
      for (const assignment of publishedRows) {
        toDelete.push(assignment.id);
      }
    } else {
      const selectedRows = publishedRows.filter((assignment) => assignment.role === choice);
      if (selectedRows.length === 0) {
        await createProductLocationRole.mutateAsync({
          locationId,
          productId,
          role: choice
        });
      }
      if (selectedRows.length > 1) {
        for (const duplicate of selectedRows.slice(1)) {
          toDelete.push(duplicate.id);
        }
      }
      for (const assignment of publishedRows) {
        if (assignment.role !== choice) {
          toDelete.push(assignment.id);
        }
      }
    }

    const uniqueDeletes = Array.from(new Set(toDelete));
    for (const roleId of uniqueDeletes) {
      await deleteProductLocationRole.mutateAsync(roleId);
    }
  };

  if (mode.kind === 'empty') {
    return <EmptyState />;
  }

  if (mode.kind === 'rack-overview') {
    return <RackOverviewPanel rackId={mode.rackId} />;
  }

  if (mode.kind === 'task-move-container') {
    const isTargetSameAsSource = moveTaskState?.targetCellId === moveTaskState?.sourceCellId;
    const resolvedTargetLocationId = moveTargetLocationRef?.locationId ?? null;
    const canConfirm =
      moveTaskState !== null &&
      moveTaskState.targetCellId !== null &&
      !isTargetSameAsSource &&
      resolvedTargetLocationId !== null &&
      moveTaskState.stage === 'selecting-target';

    return (
      <MoveContainerTaskPanel
        moveTaskState={moveTaskState!}
        rackDisplayCode={rackDisplayCode}
        targetLocationLoading={moveTargetLocationLoading}
        resolvedTargetLocationId={resolvedTargetLocationId}
        canConfirm={canConfirm}
        onConfirm={() => void handleMoveConfirm()}
        onCancel={handleMoveCancel}
        onDone={handleMoveDone}
      />
    );
  }

  if (locationRefLoading || (locationId && storageLoading)) {
    return <LoadingState />;
  }

  const isOccupied = storageRows.length > 0;
  const containers = groupByContainer(storageRows);

  if (mode.kind === 'task-create-container') {
    return (
      <CreateContainerTaskPanel
        containerTypes={containerTypes}
        containerTypeId={createContainerTypeId}
        externalCode={createExternalCode}
        isSubmitting={createIsSubmitting}
        locationId={locationId}
        errorMessage={createErrorMessage}
        rackDisplayCode={rackDisplayCode}
        locationCode={locationCode}
        activeLevel={activeLevel}
        onContainerTypeChange={setCreateContainerTypeId}
        onExternalCodeChange={setCreateExternalCode}
        onConfirm={() => void handleCreateTaskConfirm()}
        onCancel={closeCreateTask}
      />
    );
  }

  if (mode.kind === 'task-create-container-with-product') {
    return (
      <CreateContainerWithProductTaskPanel
        containerTypes={containerTypes}
        containerTypeId={createWithProductContainerTypeId}
        externalCode={createWithProductExternalCode}
        productSearch={createWithProductSearch}
        selectedProduct={createWithProductSelectedProduct}
        searchResults={createWithProductSearchResults}
        quantity={createWithProductQuantity}
        uom={createWithProductUom}
        isSubmitting={createWithProductIsSubmitting}
        locationId={locationId}
        errorMessage={createWithProductErrorMessage}
        rackDisplayCode={rackDisplayCode}
        locationCode={locationCode}
        activeLevel={activeLevel}
        onContainerTypeChange={setCreateWithProductContainerTypeId}
        onExternalCodeChange={setCreateWithProductExternalCode}
        onProductSearchChange={handleCreateWithProductSearchChange}
        onProductSelect={handleCreateWithProductSelect}
        onQuantityChange={setCreateWithProductQuantity}
        onUomChange={setCreateWithProductUom}
        onConfirm={() => void handleCreateWithProductConfirm()}
        onCancel={closeCreateWithProductTask}
      />
    );
  }

  if (mode.kind === 'task-edit-policy') {
    const containerRows = storageRows.filter((row) => row.containerId === mode.containerId);
    const activeProducts = getActiveProducts(containerRows);
    const editableProduct = activeProducts.length === 1 ? activeProducts[0] : null;
    const summaryState = editableProduct === null ? null : resolvePolicySummaryState(policyAssignments, editableProduct.id);

    if (editableProduct === null || summaryState === null) {
      return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden" role="complementary" aria-label="Edit policy unavailable">
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => setTaskKind(null)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2"
              aria-label="Back to container detail"
            >
              ← Back
            </button>
            <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
              <span>{rackDisplayCode}</span>
              <span className="text-gray-300">/</span>
              <span>Level {activeLevel}</span>
              <span className="text-gray-300">/</span>
              <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
            </div>
          </div>
          <div className="flex-1 px-4 py-4">
            <p className="text-sm text-gray-600">{getPolicyEditGuardReason(activeProducts)}</p>
          </div>
          <InspectorFooter />
        </div>
      );
    }

    const handleSave = async (choice: PolicyRoleChoice) => {
      setPolicyTaskError(null);
      setIsPolicyTaskSaving(true);
      try {
        await normalizePolicyForProductAtLocation(editableProduct.id, choice);
        setTaskKind(null);
      } catch (error) {
        setPolicyTaskError(error instanceof Error ? error.message : 'Failed to save policy for this location.');
      } finally {
        setIsPolicyTaskSaving(false);
      }
    };

    return (
      <EditPolicyTaskPanel
        rackDisplayCode={rackDisplayCode}
        activeLevel={activeLevel}
        locationCode={locationCode}
        product={editableProduct}
        summaryState={summaryState}
        isSaving={isPolicyTaskSaving}
        errorMessage={policyTaskError}
        onCancel={() => setTaskKind(null)}
        onSave={handleSave}
      />
    );
  }

  if (mode.kind === 'task-add-product-to-container') {
    const containerRows = storageRows.filter((row) => row.containerId === mode.containerId);
    const first = containerRows[0];
    const displayCode = first ? (first.externalCode ?? first.systemCode) : mode.containerId;
    const isContainerEmpty = !hasInventoryRows(containerRows);

    const handleAddProductSelect = (product: Product) => {
      setAddProductSelectedProduct(product);
      setAddProductSearch(product.name ?? product.sku ?? '');
    };

    const handleAddProductSearchChange = (value: string) => {
      setAddProductSearch(value);
      setAddProductSelectedProduct(null);
    };

    const handleAddProductConfirm = async () => {
      if (!locationId || !addProductSelectedProduct || addProductContainerId === null) return;
      setAddProductErrorMessage(null);

      if (!isContainerEmpty) {
        setAddProductErrorMessage('This container is no longer empty. Return to details to continue.');
        return;
      }

      try {
        const latestRows = await queryClient.fetchQuery(containerStorageQueryOptions(addProductContainerId));
        if (hasInventoryRows(latestRows)) {
          setAddProductErrorMessage('This container is no longer empty. Return to details to continue.');
          return;
        }

        await addInventoryToContainer.mutateAsync({
          containerId: addProductContainerId,
          productId: addProductSelectedProduct.id,
          quantity: Number(addProductQuantity),
          uom: addProductUom.trim()
        });

        await Promise.all([
          queryClient.refetchQueries({
            queryKey: locationKeys.storage(locationId),
            exact: true
          }),
          queryClient.refetchQueries({
            queryKey: containerKeys.storage(addProductContainerId),
            exact: true
          })
        ]);

        closeAddProductTask();
      } catch (error) {
        setAddProductErrorMessage(error instanceof Error ? error.message : 'Could not add product.');
      }
    };

    return (
      <AddProductToContainerTaskPanel
        rackDisplayCode={rackDisplayCode}
        activeLevel={activeLevel}
        locationCode={locationCode}
        containerDisplayCode={displayCode}
        isContainerEmpty={isContainerEmpty}
        locationId={locationId}
        isSubmitting={addInventoryToContainer.isPending}
        errorMessage={addProductErrorMessage}
        productSearch={addProductSearch}
        selectedProduct={addProductSelectedProduct}
        searchResults={addProductSearchResults}
        quantity={addProductQuantity}
        uom={addProductUom}
        onProductSearchChange={handleAddProductSearchChange}
        onProductSelect={handleAddProductSelect}
        onQuantityChange={setAddProductQuantity}
        onUomChange={setAddProductUom}
        onConfirm={() => void handleAddProductConfirm()}
        onCancel={closeAddProductTask}
      />
    );
  }

  if (mode.kind === 'container-detail') {
    const containerRows = storageRows.filter((row) => row.containerId === mode.containerId);
    const first = containerRows[0];
    const displayCode = first ? (first.externalCode ?? first.systemCode) : mode.containerId;
    const items = containerRows.filter((row) => row.itemRef !== null || row.quantity !== null);
    const isEmptyContainer = items.length === 0;
    const activeProducts = getActiveProducts(containerRows);
    const editableProduct = activeProducts.length === 1 ? activeProducts[0] : null;
    const guardReason = getPolicyEditGuardReason(activeProducts);
    const policyState = editableProduct === null ? null : resolvePolicySummaryState(policyAssignments, editableProduct.id);

    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden" role="complementary" aria-label={`Container detail: ${displayCode}`}>
        <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <button onClick={() => setSelectedContainerId(null)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2" aria-label="Back to cell overview">
            ← Back
          </button>
          <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
            <span>{rackDisplayCode}</span>
            <span className="text-gray-300">/</span>
            <span>Level {activeLevel}</span>
            <span className="text-gray-300">/</span>
            <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SectionHeader title="Container" />
          <div className="px-4 py-3 border-b border-gray-200 space-y-1">
            <div className="font-mono text-sm font-semibold text-gray-900">{displayCode}</div>
            {first && (
              <>
                <div className="text-xs text-gray-500 capitalize">Type: {first.containerType}</div>
                <div className="text-xs text-gray-500 capitalize">Status: {first.containerStatus}</div>
              </>
            )}
          </div>

          <SectionHeader title="Picking Policy" />
          <div className="px-4 py-3 border-b border-gray-200 space-y-2" data-testid="location-policy-summary">
            <p className="text-xs text-gray-500">Policy for SKU at this location</p>
            {editableProduct ? (
              <>
                <p className="text-xs text-gray-700">
                  SKU: <span className="font-mono text-gray-900">{editableProduct.sku ?? editableProduct.name}</span>
                </p>
                <p className="text-xs text-gray-700">
                  Location: <span className="font-mono text-gray-900">{locationCode}</span>
                </p>
                {policyState && (
                  <p className="text-xs text-gray-700">
                    Current role: <span className="font-medium text-gray-900">{policySummaryText(policyState)}</span>
                  </p>
                )}
                {policyState?.kind === 'legacy-conflict' && (
                  <p className="text-xs text-amber-700" data-testid="policy-legacy-conflict">
                    Legacy conflict detected for this SKU at this location.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-amber-700">{guardReason}</p>
            )}
            {editableProduct ? (
              <button
                onClick={() => {
                  setPolicyTaskError(null);
                  setTaskKind('edit-policy');
                }}
                className="w-full text-left text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-3 py-2"
                data-testid="edit-policy-action"
              >
                Edit policy
              </button>
            ) : (
              <p className="text-xs text-gray-500">
                Edit policy is available only when this container resolves to exactly one active SKU.
              </p>
            )}
          </div>

          <div className="px-4 py-3 border-b border-gray-200">
            {isEmptyContainer && (
              <button
                onClick={openAddProductTask}
                className="w-full text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-3 py-2 mb-2"
                data-testid="add-product-action"
              >
                Add product
              </button>
            )}
            <button
              onClick={() => {
                if (!cellId || !locationId) return;
                setMoveTaskState({
                  sourceContainerId: mode.containerId,
                  sourceCellId: cellId,
                  sourceLocationId: locationId,
                  sourceRackId: rackId,
                  sourceLevel: activeLevel,
                  sourceLocationCode: locationCode,
                  sourceContainerDisplayCode: displayCode,
                  targetCellId: null,
                  stage: 'selecting-target',
                  errorMessage: null
                });
                setTaskKind('move-container');
              }}
              className="w-full text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-3 py-2"
              data-testid="move-container-action"
            >
              Move container
            </button>
          </div>

          <SectionHeader title="Inventory" />
          <div className="px-4 py-3">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Empty container</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((row, idx) => {
                  const label = row.product?.name ?? row.product?.sku ?? row.itemRef ?? '—';
                  const qty = row.quantity ?? 0;
                  const uom = row.uom ?? '';
                  return (
                    <div key={`${row.containerId}-${row.itemRef ?? idx}`} className="flex items-baseline justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        {row.product?.sku && <span className="font-mono text-gray-500">{row.product.sku}</span>}
                        <span className="text-gray-600 ml-1.5 truncate">{label}</span>
                      </div>
                      <span className="font-medium text-gray-700 flex-shrink-0 tabular-nums">{qty} {uom}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <InspectorFooter />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden" role="complementary" aria-label={`Location inspector: ${locationCode}`}>
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
          <span>{rackDisplayCode}</span>
          <span className="text-gray-300">/</span>
          <span>Level {activeLevel}</span>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SectionHeader title="Status" />
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <StatusBadge occupied={isOccupied} />
          {storageRows[0]?.locationType && (
            <div className="text-xs text-gray-600">
              <span className="text-gray-400">Type:</span> {storageRows[0].locationType.replace('_', ' ')}
            </div>
          )}
        </div>

        <SectionHeader title="Current Contents" />
        <div className="px-4 py-3 border-b border-gray-200">
          {!isOccupied ? (
            <p className="text-sm text-gray-400 italic">None</p>
          ) : (
            <div className="space-y-2">
              {containers.map(({ containerId, rows }) => {
                const first = rows[0];
                const displayCode = first.externalCode ?? first.systemCode;
                return (
                  <button
                    key={containerId}
                    onClick={() => setSelectedContainerId(containerId)}
                    className="w-full text-left bg-gray-50 border border-gray-200 rounded px-3 py-2 space-y-1 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                    aria-label={`View container ${displayCode}`}
                  >
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Container</div>
                    <div className="font-mono text-sm font-semibold text-gray-900">{displayCode}</div>
                    <div className="text-xs text-gray-500 capitalize">Status: {first.containerStatus}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <SectionHeader title="Inventory" />
        <div className="px-4 py-3">
          {!isOccupied ? (
            <p className="text-sm text-gray-400 italic">0 items</p>
          ) : (
            (() => {
              const allItems = storageRows.filter((row) => row.itemRef !== null || row.quantity !== null);
              const preview = allItems.slice(0, INVENTORY_PREVIEW_LIMIT);
              const overflow = allItems.length - INVENTORY_PREVIEW_LIMIT;

              if (allItems.length === 0) {
                return <p className="text-sm text-gray-400 italic">0 items</p>;
              }

              return (
                <div className="space-y-1.5">
                  {preview.map((row, idx) => {
                    const label = row.product?.name ?? row.product?.sku ?? row.itemRef ?? '—';
                    const qty = row.quantity ?? 0;
                    const uom = row.uom ?? '';
                    return (
                      <div key={`${row.containerId}-${row.itemRef ?? idx}`} className="flex items-baseline justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          {row.product?.sku && <span className="font-mono text-gray-500">{row.product.sku}</span>}
                          <span className="text-gray-600 ml-1.5 truncate">{label}</span>
                        </div>
                        <span className="font-medium text-gray-700 flex-shrink-0 tabular-nums">{qty} {uom}</span>
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <p className="text-xs text-gray-400 pt-0.5">
                      +{overflow} more item{overflow > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              );
            })()
          )}
        </div>

        <SectionHeader title="Policy" />
        <div className="px-4 py-3 border-b border-gray-200" data-testid="cell-policy-hint">
          <p className="text-xs text-gray-600">Picking policy is defined for SKU at this location.</p>
          <p className="text-xs text-gray-500 mt-1">To edit policy, open a container detail that resolves to exactly one active SKU.</p>
        </div>

        <SectionHeader title="Actions" />
        <div className="px-4 py-3 space-y-2">
          <button
            onClick={openCreateTask}
            className="w-full text-left px-3 py-2 text-sm rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            aria-label="Create container at this location"
          >
            Create container
          </button>
          <button
            onClick={openCreateWithProductTask}
            className="w-full text-left px-3 py-2 text-sm rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            aria-label="Create container with product at this location"
          >
            Create container with product
          </button>
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}
