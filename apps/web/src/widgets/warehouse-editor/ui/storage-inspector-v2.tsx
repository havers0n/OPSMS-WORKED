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
import { useLocationEffectiveRole } from '@/entities/product-location-role/api/use-location-effective-role';
import { useLocationProductAssignments } from '@/entities/product-location-role/api/use-location-product-assignments';
import {
  useCreateProductLocationRole,
  useDeleteProductLocationRole
} from '@/entities/product-location-role/api/mutations';
import { productLocationRoleKeys } from '@/entities/product-location-role/api/queries';
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
  effectiveRoleSourceLabel,
  getActiveProducts,
  groupByContainer,
  hasInventoryRows,
  resolveStructuralDefaultFromPublishedLayout,
  semanticRoleLabel
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
import { AddProductToContainerTaskPanel } from './storage-inspector-v2/task-add-product-panel';
import { EditOverrideTaskPanel } from './storage-inspector-v2/task-edit-override-panel';
import { RepairConflictTaskPanel } from './storage-inspector-v2/task-repair-conflict-panel';

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
  const [editOverrideIsSubmitting, setEditOverrideIsSubmitting] = useState(false);
  const [editOverrideErrorMessage, setEditOverrideErrorMessage] = useState<string | null>(null);
  const [repairConflictIsSubmitting, setRepairConflictIsSubmitting] = useState(false);
  const [repairConflictErrorMessage, setRepairConflictErrorMessage] = useState<string | null>(null);

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
  const { data: locationProductAssignments = [] } = useLocationProductAssignments(locationId);
  const createProductLocationRole = useCreateProductLocationRole();
  const deleteProductLocationRole = useDeleteProductLocationRole(locationId);

  const mode = resolveActiveMode(resolvePanelMode(rackId, cellId, selectedContainerId), taskKind, moveTaskState);
  const effectiveRoleContainerRows =
    mode.kind === 'container-detail' ||
    mode.kind === 'task-edit-override' ||
    mode.kind === 'task-repair-conflict'
      ? storageRows.filter((row) => row.containerId === mode.containerId)
      : [];
  const effectiveRoleActiveProducts = getActiveProducts(effectiveRoleContainerRows);
  const effectiveRoleProductId =
    effectiveRoleActiveProducts.length === 1 ? effectiveRoleActiveProducts[0].id : null;
  const { data: effectiveRoleContext, isLoading: effectiveRoleLoading } = useLocationEffectiveRole(
    locationId,
    effectiveRoleProductId
  );

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

  const resetEditOverrideTaskState = () => {
    setEditOverrideIsSubmitting(false);
    setEditOverrideErrorMessage(null);
  };

  const resetRepairConflictTaskState = () => {
    setRepairConflictIsSubmitting(false);
    setRepairConflictErrorMessage(null);
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
    resetCreateTaskState();
    resetCreateWithProductTaskState();
    resetAddProductTaskState();
    resetEditOverrideTaskState();
    resetRepairConflictTaskState();
  }, [cellId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (taskKind !== 'edit-override') return;
    const baseMode = resolvePanelMode(rackId, cellId, selectedContainerId);
    if (baseMode.kind !== 'container-detail') {
      closeEditOverrideTask();
      return;
    }

    const containerRows = storageRows.filter((row) => row.containerId === baseMode.containerId);
    const activeProducts = getActiveProducts(containerRows);
    const productId = activeProducts.length === 1 ? activeProducts[0].id : null;
    const isConflict = effectiveRoleContext?.effectiveRoleSource === 'conflict';
    if (!locationId || !productId || isConflict) {
      closeEditOverrideTask();
    }
  }, [
    taskKind,
    rackId,
    cellId,
    selectedContainerId,
    storageRows,
    locationId,
    effectiveRoleContext?.effectiveRoleSource
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (taskKind !== 'repair-conflict') return;
    const baseMode = resolvePanelMode(rackId, cellId, selectedContainerId);
    if (baseMode.kind !== 'container-detail') {
      closeRepairConflictTask();
      return;
    }

    const containerRows = storageRows.filter((row) => row.containerId === baseMode.containerId);
    const activeProducts = getActiveProducts(containerRows);
    const productId = activeProducts.length === 1 ? activeProducts[0].id : null;
    if (!locationId || !productId) {
      closeRepairConflictTask();
      return;
    }

    // Do not close while canonical effective role is still loading.
    if (effectiveRoleLoading) return;

    const source = effectiveRoleContext?.effectiveRoleSource;
    if (source != null && source !== 'conflict') {
      closeRepairConflictTask();
    }
  }, [
    taskKind,
    rackId,
    cellId,
    selectedContainerId,
    storageRows,
    locationId,
    effectiveRoleLoading,
    effectiveRoleContext?.effectiveRoleSource
  ]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const closeEditOverrideTask = () => {
    if (editOverrideIsSubmitting) return;
    setTaskKind(null);
    resetEditOverrideTaskState();
  };

  const closeRepairConflictTask = () => {
    if (repairConflictIsSubmitting) return;
    setTaskKind(null);
    resetRepairConflictTaskState();
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

  const openRepairConflictTask = () => {
    resetRepairConflictTaskState();
    setTaskKind('repair-conflict');
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

  const refetchOverrideReadSurface = async (productId: string) => {
    if (!locationId) return;
    await Promise.all([
      queryClient.refetchQueries({
        queryKey: productLocationRoleKeys.byLocation(locationId),
        exact: true
      }),
      queryClient.refetchQueries({
        queryKey: productLocationRoleKeys.effectiveRole(locationId, productId),
        exact: true
      })
    ]);
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

  if (mode.kind === 'task-edit-override') {
    const containerRows = storageRows.filter((row) => row.containerId === mode.containerId);
    const activeProducts = getActiveProducts(containerRows);
    const selectedProduct = activeProducts.length === 1 ? activeProducts[0] : null;
    const selectedProductId = selectedProduct?.id ?? null;

    if (!locationId || !selectedProduct || !selectedProductId) {
      return <LoadingState />;
    }

    const explicitAssignments = locationProductAssignments.filter(
      (assignment) =>
        assignment.locationId === locationId &&
        assignment.productId === selectedProductId &&
        assignment.state === 'published'
    );
    const hasExplicitOverride = explicitAssignments.length > 0;
    const firstExplicitRole = explicitAssignments.find(
      (assignment) => assignment.role === 'primary_pick' || assignment.role === 'reserve'
    )?.role;
    const structuralDefaultText = semanticRoleLabel(effectiveRoleContext?.structuralDefaultRole ?? 'none');
    const effectiveRoleText =
      effectiveRoleContext == null
        ? 'Unknown'
        : effectiveRoleContext.effectiveRoleSource === 'conflict'
          ? 'Conflict'
          : semanticRoleLabel(effectiveRoleContext.effectiveRole ?? 'none');
    const sourceText =
      effectiveRoleContext == null ? 'Unknown' : effectiveRoleSourceLabel(effectiveRoleContext.effectiveRoleSource);
    const defaultRole = firstExplicitRole ?? 'primary_pick';

    const handleSaveOverride = async (role: 'primary_pick' | 'reserve') => {
      setEditOverrideIsSubmitting(true);
      setEditOverrideErrorMessage(null);
      try {
        for (const assignment of explicitAssignments) {
          await deleteProductLocationRole.mutateAsync(assignment.id);
        }

        await createProductLocationRole.mutateAsync({
          locationId,
          productId: selectedProductId,
          role
        });

        await refetchOverrideReadSurface(selectedProductId);
        setTaskKind(null);
        resetEditOverrideTaskState();
      } catch (error) {
        await refetchOverrideReadSurface(selectedProductId);
        setEditOverrideErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not save explicit override. Canonical state was refreshed.'
        );
      } finally {
        setEditOverrideIsSubmitting(false);
      }
    };

    const handleClearOverride = async () => {
      setEditOverrideIsSubmitting(true);
      setEditOverrideErrorMessage(null);
      try {
        for (const assignment of explicitAssignments) {
          await deleteProductLocationRole.mutateAsync(assignment.id);
        }
        await refetchOverrideReadSurface(selectedProductId);
        setTaskKind(null);
        resetEditOverrideTaskState();
      } catch (error) {
        await refetchOverrideReadSurface(selectedProductId);
        setEditOverrideErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not clear explicit override. Canonical state was refreshed.'
        );
      } finally {
        setEditOverrideIsSubmitting(false);
      }
    };

    return (
      <EditOverrideTaskPanel
        rackDisplayCode={rackDisplayCode}
        activeLevel={activeLevel}
        locationCode={locationCode}
        product={selectedProduct}
        structuralDefaultText={structuralDefaultText}
        effectiveRoleText={effectiveRoleText}
        sourceText={sourceText}
        hasExplicitOverride={hasExplicitOverride}
        defaultRole={defaultRole}
        isSubmitting={editOverrideIsSubmitting}
        errorMessage={editOverrideErrorMessage}
        onCancel={closeEditOverrideTask}
        onSave={handleSaveOverride}
        onClear={handleClearOverride}
      />
    );
  }

  if (mode.kind === 'task-repair-conflict') {
    const containerRows = storageRows.filter((row) => row.containerId === mode.containerId);
    const activeProducts = getActiveProducts(containerRows);
    const selectedProduct = activeProducts.length === 1 ? activeProducts[0] : null;
    const selectedProductId = selectedProduct?.id ?? null;

    if (!locationId || !selectedProduct || !selectedProductId) {
      return <LoadingState />;
    }

    const targetAssignments = locationProductAssignments.filter(
      (assignment) =>
        assignment.locationId === locationId &&
        assignment.productId === selectedProductId &&
        assignment.state === 'published'
    );
    const conflictingRoles =
      targetAssignments.length > 0
        ? Array.from(new Set(targetAssignments.map((assignment) => assignment.role)))
        : (effectiveRoleContext?.conflictingPublishedRoles ?? []);
    const conflictingRowCount = targetAssignments.length;
    const conflictingRowIds = targetAssignments.map((assignment) => assignment.id);
    const structuralDefaultText = semanticRoleLabel(effectiveRoleContext?.structuralDefaultRole ?? 'none');
    const effectiveRoleText = 'Conflict';
    const sourceText = 'Conflict';
    const canRepair = targetAssignments.length > 0;

    const resolveConflict = async (role: 'primary_pick' | 'reserve') => {
      if (!canRepair) {
        setRepairConflictErrorMessage(
          'Cannot repair conflict: missing published explicit rows for this product/location.'
        );
        return;
      }
      setRepairConflictIsSubmitting(true);
      setRepairConflictErrorMessage(null);
      try {
        for (const assignment of targetAssignments) {
          await deleteProductLocationRole.mutateAsync(assignment.id);
        }

        await createProductLocationRole.mutateAsync({
          locationId,
          productId: selectedProductId,
          role
        });

        await refetchOverrideReadSurface(selectedProductId);
        setTaskKind(null);
        resetRepairConflictTaskState();
      } catch (error) {
        await refetchOverrideReadSurface(selectedProductId);
        setRepairConflictErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not repair conflict. Canonical state was refreshed.'
        );
      } finally {
        setRepairConflictIsSubmitting(false);
      }
    };

    const clearConflictOverrides = async () => {
      if (!canRepair) {
        setRepairConflictErrorMessage(
          'Cannot repair conflict: missing published explicit rows for this product/location.'
        );
        return;
      }
      setRepairConflictIsSubmitting(true);
      setRepairConflictErrorMessage(null);
      try {
        for (const assignment of targetAssignments) {
          await deleteProductLocationRole.mutateAsync(assignment.id);
        }

        await refetchOverrideReadSurface(selectedProductId);
        setTaskKind(null);
        resetRepairConflictTaskState();
      } catch (error) {
        await refetchOverrideReadSurface(selectedProductId);
        setRepairConflictErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not clear explicit overrides. Canonical state was refreshed.'
        );
      } finally {
        setRepairConflictIsSubmitting(false);
      }
    };

    const noTargetsMessage = canRepair
      ? null
      : 'Cannot repair conflict because canonical published explicit rows are unavailable for this product/location.';
    const combinedErrorMessage =
      repairConflictErrorMessage ?? noTargetsMessage;

    return (
      <RepairConflictTaskPanel
        rackDisplayCode={rackDisplayCode}
        activeLevel={activeLevel}
        locationCode={locationCode}
        product={selectedProduct}
        structuralDefaultText={structuralDefaultText}
        effectiveRoleText={effectiveRoleText}
        sourceText={sourceText}
        conflictingRoles={conflictingRoles}
        conflictingRowCount={conflictingRowCount}
        conflictingRowIds={conflictingRowIds}
        isSubmitting={repairConflictIsSubmitting}
        errorMessage={combinedErrorMessage}
        onCancel={closeRepairConflictTask}
        onResolve={resolveConflict}
        onClear={clearConflictOverrides}
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
    const selectedProduct = activeProducts.length === 1 ? activeProducts[0] : null;
    const structuralDefaultFromLayout = resolveStructuralDefaultFromPublishedLayout(
      cellId,
      publishedCells,
      racks
    );
    const structuralDefaultRole = effectiveRoleContext?.structuralDefaultRole ?? structuralDefaultFromLayout;
    const structuralDefaultText =
      structuralDefaultRole === null ? 'Unknown' : semanticRoleLabel(structuralDefaultRole);
    const hasProductContext = selectedProduct !== null;
    const selectedProductId = selectedProduct?.id ?? null;
    const isEffectiveRoleLoading = hasProductContext && effectiveRoleLoading;
    const isConflict = effectiveRoleContext?.effectiveRoleSource === 'conflict';
    const explicitAssignments = selectedProductId
      ? locationProductAssignments.filter(
          (assignment) =>
            assignment.locationId === locationId &&
            assignment.productId === selectedProductId &&
            assignment.state === 'published'
        )
      : [];
    const hasExplicitOverride = explicitAssignments.length > 0;
    const canShowOverrideEntry = Boolean(locationId && selectedProductId && !isConflict);
    const canShowRepairConflictEntry = Boolean(locationId && selectedProductId && isConflict);

    const effectiveRoleText = hasProductContext
      ? isEffectiveRoleLoading
        ? 'Loading...'
        : isConflict
          ? 'Conflict'
          : effectiveRoleContext
            ? semanticRoleLabel(effectiveRoleContext.effectiveRole ?? 'none')
            : 'Unknown'
      : 'Not computed';

    const sourceText = hasProductContext
      ? isEffectiveRoleLoading
        ? 'Loading...'
        : effectiveRoleContext
          ? effectiveRoleSourceLabel(effectiveRoleContext.effectiveRoleSource)
          : 'Unknown'
      : 'Not computed';

    const showNoneExplanation =
      effectiveRoleContext?.structuralDefaultRole === 'none' &&
      effectiveRoleContext.effectiveRoleSource === 'none' &&
      effectiveRoleContext.effectiveRole === 'none';

    const openEditOverrideTask = () => {
      if (!canShowOverrideEntry) return;
      resetEditOverrideTaskState();
      setTaskKind('edit-override');
    };

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

          <SectionHeader title="Location Role" />
          <div className="px-4 py-3 border-b border-gray-200 space-y-2" data-testid="location-role-context">
            {selectedProduct && (
              <p className="text-xs text-gray-700">
                SKU: <span className="font-mono text-gray-900">{selectedProduct.sku ?? selectedProduct.name}</span>
              </p>
            )}
            <p className="text-xs text-gray-700">
              Structural default: <span className="font-medium text-gray-900">{structuralDefaultText}</span>
            </p>
            <p className="text-xs text-gray-700">
              Effective role: <span className="font-medium text-gray-900">{effectiveRoleText}</span>
            </p>
            <p className="text-xs text-gray-700">
              Source: <span className="font-medium text-gray-900">{sourceText}</span>
            </p>

            {!hasProductContext && (
              <p className="text-xs text-gray-500" data-testid="location-role-product-context-required">
                Product context required to resolve explicit override.
              </p>
            )}

            {isConflict && (
              <p className="text-xs text-amber-700" data-testid="location-role-conflict-note">
                Multiple published explicit roles exist for this product/location.
              </p>
            )}

            {showNoneExplanation && (
              <p className="text-xs text-gray-500" data-testid="location-role-none-note">
                No structural default or explicit override applies here.
              </p>
            )}
          </div>

          {canShowOverrideEntry && (
            <div className="px-4 py-3 border-b border-gray-200 space-y-2" data-testid="override-task-entry">
              <button
                onClick={openEditOverrideTask}
                className="w-full text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-3 py-2"
                data-testid="edit-override-action"
              >
                {hasExplicitOverride ? 'Edit override' : 'Set override'}
              </button>
            </div>
          )}

          {canShowRepairConflictEntry && (
            <div className="px-4 py-3 border-b border-gray-200 space-y-2" data-testid="repair-conflict-task-entry">
              <button
                onClick={openRepairConflictTask}
                className="w-full text-sm font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded px-3 py-2"
                data-testid="repair-conflict-action"
              >
                Repair conflict
              </button>
            </div>
          )}

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

        <SectionHeader title="Override" />
        <div className="px-4 py-3 border-b border-gray-200" data-testid="cell-override-hint">
          <p className="text-xs text-gray-600">Location role context is shown for container detail.</p>
          <p className="text-xs text-gray-500 mt-1">Select a container with one active SKU to resolve effective role.</p>
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
