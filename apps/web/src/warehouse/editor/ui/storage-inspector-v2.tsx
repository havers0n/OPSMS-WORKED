import type { FloorWorkspace, LocationStorageSnapshotRow, Product, Rack } from '@wos/domain';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CellStatusChip } from '@/entities/cell/ui/cell-status-chip';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useContainerTypes } from '@/entities/container/api/use-container-types';
import { LocationAddress } from '@/entities/location/ui/location-address';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { locationKeys } from '@/entities/location/api/queries';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import { useProductsSearch } from '@/entities/product/api/use-products-search';
import { productStoragePresetsQueryOptions } from '@/entities/product/api/queries';
import { useLocationEffectiveRole } from '@/entities/product-location-role/api/use-location-effective-role';
import { useLocationProductAssignments } from '@/entities/product-location-role/api/use-location-product-assignments';
import {
  useCreateProductLocationRole,
  useDeleteProductLocationRole
} from '@/entities/product-location-role/api/mutations';
import { productLocationRoleKeys } from '@/entities/product-location-role/api/queries';
import { createContainer } from '@/features/container-create/api/mutations';
import { addInventoryItem } from '@/features/inventory-add/api/mutations';
import {
  moveContainer as moveContainerApi,
  placeContainer,
  removeContainer,
  swapContainers as swapContainersApi
} from '@/features/placement-actions/api/mutations';
import { invalidatePlacementQueries } from '@/features/placement-actions/model/invalidation';
import {
  containerKeys,
  containerListQueryOptions,
  containerStorageQueryOptions
} from '@/entities/container/api/queries';
import { transferInventoryToContainer } from '@/features/container-inventory/api/mutations';
import { invalidateContainerInventoryQueries } from '@/features/container-inventory/model/invalidation';
import { useAddInventoryToContainer } from '@/features/container-inventory/model/use-add-inventory-to-container';
import {
  createContainerFromStoragePreset,
  setPreferredStoragePreset
} from '@/features/storage-presets/api/mutations';
import {
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId,
  useStorageFocusActiveLevel,
  useStorageFocusSelectCell
} from '../model/v2/v2-selectors';
import {
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
  type SwapTaskState,
  type TaskKind
} from './storage-inspector-v2/mode';
import { EmptyState } from './storage-inspector-v2/empty-state';
import { LoadingErrorState, LoadingState } from './storage-inspector-v2/loading-state';
import { RackOverviewPanel } from './storage-inspector-v2/rack-overview-panel';
import { ContainerDetailPanel } from './storage-inspector-v2/container-detail-panel';
import { CreateContainerTaskPanel } from './storage-inspector-v2/task-create-container-panel';
import { CreateContainerFromPresetTaskPanel } from './storage-inspector-v2/task-create-container-from-preset-panel';
import { CreateContainerWithProductTaskPanel } from './storage-inspector-v2/task-create-container-with-product-panel';
import { MoveContainerTaskPanel } from './storage-inspector-v2/task-move-container-panel';
import { SwapContainerTaskPanel } from './storage-inspector-v2/task-swap-container-panel';
import { PlaceExistingContainerTaskPanel } from './storage-inspector-v2/task-place-existing-panel';
import { RemoveContainerTaskPanel } from './storage-inspector-v2/task-remove-container-panel';
import { AddProductToContainerTaskPanel } from './storage-inspector-v2/task-add-product-panel';
import { TransferToContainerTaskPanel } from './storage-inspector-v2/task-transfer-to-container-panel';
import {
  ExtractQuantityTaskPanel,
  type ExtractTargetMode
} from './storage-inspector-v2/task-extract-quantity-panel';
import { EditOverrideTaskPanel } from './storage-inspector-v2/task-edit-override-panel';
import { RepairConflictTaskPanel } from './storage-inspector-v2/task-repair-conflict-panel';
import {
  CurrentContainersSectionView,
  CurrentInventorySectionView,
  LocationPolicySummarySectionView,
  type CurrentContainerCardViewModel,
  type CurrentInventorySummaryItemViewModel,
  type LocationPolicySummaryAssignmentViewModel
} from './storage-location-detail-sections-view';
import {
  InspectorFooter,
  inspectorScrollBodyClassName,
  inspectorSectionClassName,
  inspectorSectionTitleClassName,
  inspectorShellClassName
} from './storage-inspector-v2/shared';

export { resolvePanelMode, resolveActiveMode } from './storage-inspector-v2/mode';
export type { MoveTaskState } from './storage-inspector-v2/mode';

interface StorageInspectorV2Props {
  workspace: FloorWorkspace | null;
}

type MaterializationWarning = {
  containerId: string;
  message: string;
};

const partialMaterializationWarningCopy =
  'Container shell was created, but contents could not be materialized. The shell was selected so you can inspect it or retry later.';

type GroupedContainer = {
  containerId: string;
  rows: LocationStorageSnapshotRow[];
};

function containerDisplayCode(row: LocationStorageSnapshotRow | undefined, fallback: string) {
  return row ? (row.externalCode ?? row.systemCode ?? fallback) : fallback;
}

function buildCurrentContainerCards(containers: GroupedContainer[]): CurrentContainerCardViewModel[] {
  return containers.map(({ containerId, rows }) => {
    const first = rows[0];
    const displayCode = containerDisplayCode(first, containerId);
    const containerType = first?.containerType ?? 'Container';
    const status = first?.containerStatus ?? 'active';
    const inventoryEntryCount = rows.filter((row) => row.itemRef !== null || row.quantity !== null).length;

    return {
      containerId,
      title: displayCode,
      secondaryText: `${containerType} / ${status}`,
      status,
      presetUsageText: `${presetUsageLabel(first?.presetUsageStatus)} / ${presetMaterializationLabel(
        first?.presetMaterializationStatus
      )}`,
      inventoryEntryCount
    };
  });
}

function buildCurrentInventoryItems(rows: LocationStorageSnapshotRow[]): CurrentInventorySummaryItemViewModel[] {
  const itemMap = new Map<
    string,
    CurrentInventorySummaryItemViewModel & { containerIds: Set<string> }
  >();

  rows
    .filter((row) => row.itemRef !== null || row.quantity !== null)
    .forEach((row, index) => {
      const product = row.product as
        | {
            id?: string;
            sku?: string | null;
            name?: string | null;
            imageUrl?: string | null;
          }
        | null
        | undefined;
      const uom = row.uom ?? '';
      const key = `${product?.id ?? product?.sku ?? row.itemRef ?? `item-${index}`}::${uom}`;
      const existing = itemMap.get(key);
      const title = product?.name ?? product?.sku ?? row.itemRef ?? 'Inventory item';

      if (existing) {
        existing.totalQuantity += row.quantity ?? 0;
        existing.containerIds.add(row.containerId);
        existing.containerCount = existing.containerIds.size;
        return;
      }

      itemMap.set(key, {
        key,
        imageUrl: product?.imageUrl ?? null,
        title,
        meta: product?.sku ?? row.itemRef ?? null,
        totalQuantity: row.quantity ?? 0,
        uom,
        containerCount: 1,
        containerIds: new Set([row.containerId])
      });
    });

  return Array.from(itemMap.values()).map(({ containerIds: _containerIds, ...item }) => item);
}

function buildPolicyAssignments(
  assignments: Array<{
    id: string;
    productId: string;
    role: string;
    state: string;
    product?: {
      name?: string | null;
      sku?: string | null;
    } | null;
  }>
): LocationPolicySummaryAssignmentViewModel[] {
  return assignments
    .filter((assignment) => assignment.state === 'published')
    .map((assignment) => ({
      id: assignment.id,
      productName: assignment.product?.name ?? assignment.product?.sku ?? assignment.productId,
      productSku: assignment.product?.sku ?? null,
      role: assignment.role
    }));
}

function errorMessageFromUnknown(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function parsePositiveQuantity(value: string) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity : null;
}

function validateContentsQuantity(sourceLine: LocationStorageSnapshotRow | null, quantityText: string) {
  if (!sourceLine?.inventoryUnitId) return 'Inventory unit is not available for this row.';
  if (quantityText.trim() === '') return 'Quantity is required.';
  const quantity = parsePositiveQuantity(quantityText);
  if (quantity === null || quantity <= 0) return 'Quantity must be greater than zero.';
  if (sourceLine.quantity !== null && quantity > sourceLine.quantity) {
    return 'Quantity cannot exceed the source quantity.';
  }
  return null;
}

function validateTargetContainer(
  sourceLine: LocationStorageSnapshotRow | null,
  targetContainerId: string
) {
  if (!targetContainerId) return 'Target container is required.';
  if (sourceLine && targetContainerId === sourceLine.containerId) {
    return 'Target container must be different from the source container.';
  }
  return null;
}

function presetUsageLabel(status: LocationStorageSnapshotRow['presetUsageStatus'] | undefined) {
  switch (status) {
    case 'preferred_match':
      return 'Preferred preset';
    case 'standard_non_preferred':
      return 'Standard preset';
    case 'manual':
      return 'Manual';
    default:
      return 'Preset unknown';
  }
}

function presetMaterializationLabel(status: LocationStorageSnapshotRow['presetMaterializationStatus'] | undefined) {
  switch (status) {
    case 'shell':
      return 'Preset shell';
    case 'materialized':
      return 'Materialized preset';
    case 'manual':
      return 'Manual contents';
    default:
      return 'Materialization unknown';
  }
}

function CellSectionOverviewPanel({
  rackDisplayCode,
  activeLevel,
  locationCode,
  locationType,
  isOccupied,
  containers,
  inventoryItems,
  policyAssignments,
  policyPending,
  sourceCellId,
  onSelectContainer,
  onOpenPlaceExistingTask,
  onOpenCreateTask,
  onOpenCreateFromPresetTask,
  onOpenCreateWithProductTask
}: {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
  locationType: string | null;
  isOccupied: boolean;
  containers: CurrentContainerCardViewModel[];
  inventoryItems: CurrentInventorySummaryItemViewModel[];
  policyAssignments: LocationPolicySummaryAssignmentViewModel[];
  policyPending: boolean;
  sourceCellId: string | null;
  onSelectContainer: (containerId: string) => void;
  onOpenPlaceExistingTask: () => void;
  onOpenCreateTask: () => void;
  onOpenCreateFromPresetTask: () => void;
  onOpenCreateWithProductTask: () => void;
}) {
  const hasContainers = containers.length > 0;
  const hasInventory = inventoryItems.length > 0;

  return (
    <div
      className={inspectorShellClassName}
      role="complementary"
      aria-label={`Location inspector: ${locationCode}`}
    >
      <div className={inspectorSectionClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-gray-900">{locationCode}</div>
            <div className="mt-1">
              <LocationAddress
                rackDisplayCode={rackDisplayCode}
                activeLevel={activeLevel}
                locationCode={locationCode}
              />
            </div>
          </div>
          {locationType ? (
            <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
              {locationType.replace('_', ' ')}
            </span>
          ) : null}
        </div>
        <div className="mt-2">
          <CellStatusChip occupied={isOccupied} />
        </div>
      </div>

      <div className={inspectorScrollBodyClassName}>
        <div className="space-y-3 px-3 py-3">
          {hasContainers ? (
            <CurrentContainersSectionView
              containers={containers}
              sourceCellId={sourceCellId}
              onContainerClick={(containerId) => onSelectContainer(containerId)}
            />
          ) : null}
          {hasInventory ? (
            <CurrentInventorySectionView
              inventoryItems={inventoryItems}
              hasContainers={hasContainers}
            />
          ) : null}
          <div
            className="rounded-lg"
            style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
          >
            <div className="px-3 py-2.5">
              <div className={inspectorSectionTitleClassName}>Actions</div>
            </div>
            <div className="grid gap-2 border-t border-[var(--border-muted)] px-3 py-3">
              <button
                onClick={onOpenPlaceExistingTask}
                className="h-8 rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                aria-label="Place existing container at this location"
              >
                Place existing
              </button>
              <button
                onClick={onOpenCreateTask}
                className="h-8 rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                aria-label="Create container at this location"
              >
                Create and place here
              </button>
              <button
                onClick={onOpenCreateWithProductTask}
                className="h-8 rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                aria-label="Create container with product at this location"
              >
                Create container with product
              </button>
              <button
                onClick={onOpenCreateFromPresetTask}
                className="h-8 rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                aria-label="Create container from storage preset at this location"
                data-testid="create-from-preset-action"
              >
                Create from preset
              </button>
            </div>
          </div>
          {hasContainers ? (
            <LocationPolicySummarySectionView
              isPending={policyPending}
              assignments={policyAssignments}
            />
          ) : null}
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
  const [swapTaskState, setSwapTaskState] = useState<SwapTaskState | null>(null);

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

  const [createFromPresetProductSearch, setCreateFromPresetProductSearch] = useState('');
  const [createFromPresetSelectedProduct, setCreateFromPresetSelectedProduct] = useState<Product | null>(null);
  const [createFromPresetPresetId, setCreateFromPresetPresetId] = useState('');
  const [createFromPresetExternalCode, setCreateFromPresetExternalCode] = useState('');
  const [createFromPresetMaterializeContents, setCreateFromPresetMaterializeContents] = useState(false);
  const [createFromPresetErrorMessage, setCreateFromPresetErrorMessage] = useState<string | null>(null);
  const [createFromPresetIsSubmitting, setCreateFromPresetIsSubmitting] = useState(false);
  const [materializationWarning, setMaterializationWarning] = useState<MaterializationWarning | null>(null);

  const [placeExistingContainerId, setPlaceExistingContainerId] = useState('');
  const [placeExistingErrorMessage, setPlaceExistingErrorMessage] = useState<string | null>(null);
  const [placeExistingIsSubmitting, setPlaceExistingIsSubmitting] = useState(false);

  const [addProductSearch, setAddProductSearch] = useState('');
  const [addProductSelectedProduct, setAddProductSelectedProduct] = useState<Product | null>(null);
  const [addProductQuantity, setAddProductQuantity] = useState('');
  const [addProductUom, setAddProductUom] = useState('');
  const [addProductErrorMessage, setAddProductErrorMessage] = useState<string | null>(null);
  const [removeContainerIsSubmitting, setRemoveContainerIsSubmitting] = useState(false);
  const [removeContainerErrorMessage, setRemoveContainerErrorMessage] = useState<string | null>(null);
  const [editOverrideIsSubmitting, setEditOverrideIsSubmitting] = useState(false);
  const [editOverrideErrorMessage, setEditOverrideErrorMessage] = useState<string | null>(null);
  const [repairConflictIsSubmitting, setRepairConflictIsSubmitting] = useState(false);
  const [repairConflictErrorMessage, setRepairConflictErrorMessage] = useState<string | null>(null);
  const [transferSourceRow, setTransferSourceRow] = useState<LocationStorageSnapshotRow | null>(null);
  const [transferTargetContainerId, setTransferTargetContainerId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [transferIsSubmitting, setTransferIsSubmitting] = useState(false);
  const [transferErrorMessage, setTransferErrorMessage] = useState<string | null>(null);
  const [extractSourceRow, setExtractSourceRow] = useState<LocationStorageSnapshotRow | null>(null);
  const [extractTargetMode, setExtractTargetMode] = useState<ExtractTargetMode>('existing-container');
  const [extractTargetContainerId, setExtractTargetContainerId] = useState('');
  const [extractNewContainerTypeId, setExtractNewContainerTypeId] = useState('');
  const [extractNewContainerExternalCode, setExtractNewContainerExternalCode] = useState('');
  const [extractQuantity, setExtractQuantity] = useState('');
  const [extractIsSubmitting, setExtractIsSubmitting] = useState(false);
  const [extractErrorMessage, setExtractErrorMessage] = useState<string | null>(null);

  const taskKindRef = useRef<TaskKind | null>(null);
  taskKindRef.current = taskKind;
  const moveTaskRef = useRef<MoveTaskState | null>(null);
  moveTaskRef.current = moveTaskState;
  const swapTaskRef = useRef<SwapTaskState | null>(null);
  swapTaskRef.current = swapTaskState;

  const selectCell = useStorageFocusSelectCell();

  const { data: containerTypes = [] } = useContainerTypes();
  const {
    data: storageContainers = [],
    isLoading: storageContainersLoading
  } = useQuery(containerListQueryOptions({ operationalRole: 'storage' }));
  const { data: createWithProductSearchResults = [] } = useProductsSearch(createWithProductSearch.trim() || null);
  const { data: createFromPresetSearchResults = [] } = useProductsSearch(createFromPresetProductSearch.trim() || null);
  const { data: addProductSearchResults = [] } = useProductsSearch(addProductSearch.trim() || null);
  const {
    data: createFromPresetPresets = [],
    isLoading: createFromPresetPresetsLoading
  } = useQuery({
    ...productStoragePresetsQueryOptions(createFromPresetSelectedProduct?.id ?? null),
    enabled: Boolean(createFromPresetSelectedProduct)
  });

  const {
    data: locationRef,
    isLoading: locationRefLoading,
    isError: locationRefIsError,
    error: locationRefError,
    refetch: refetchLocationRef
  } = useLocationByCell(cellId);
  const locationId = locationRef?.locationId ?? null;

  const {
    data: storageRows = [],
    isLoading: storageLoading,
    isError: storageIsError,
    error: storageError,
    refetch: refetchStorageRows
  } = useLocationStorage(locationId);
  const {
    data: locationProductAssignments = [],
    isLoading: locationProductAssignmentsLoading
  } = useLocationProductAssignments(locationId);
  const createProductLocationRole = useCreateProductLocationRole();
  const deleteProductLocationRole = useDeleteProductLocationRole(locationId);

  const mode = resolveActiveMode(
    resolvePanelMode(rackId, cellId, selectedContainerId),
    taskKind,
    moveTaskState,
    swapTaskState
  );
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
  const { data: effectiveProductStoragePresets = [] } = useQuery({
    ...productStoragePresetsQueryOptions(effectiveRoleProductId),
    enabled: Boolean(effectiveRoleProductId)
  });
  const [preferredPresetIsSubmitting, setPreferredPresetIsSubmitting] = useState(false);

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

  const resetCreateFromPresetTaskState = () => {
    setCreateFromPresetProductSearch('');
    setCreateFromPresetSelectedProduct(null);
    setCreateFromPresetPresetId('');
    setCreateFromPresetExternalCode('');
    setCreateFromPresetMaterializeContents(false);
    setCreateFromPresetErrorMessage(null);
    setCreateFromPresetIsSubmitting(false);
  };

  const resetPlaceExistingTaskState = () => {
    setPlaceExistingContainerId('');
    setPlaceExistingErrorMessage(null);
    setPlaceExistingIsSubmitting(false);
  };

  const resetAddProductTaskState = () => {
    setAddProductSearch('');
    setAddProductSelectedProduct(null);
    setAddProductQuantity('');
    setAddProductUom('');
    setAddProductErrorMessage(null);
  };

  const resetRemoveContainerTaskState = () => {
    setRemoveContainerIsSubmitting(false);
    setRemoveContainerErrorMessage(null);
  };

  const resetEditOverrideTaskState = () => {
    setEditOverrideIsSubmitting(false);
    setEditOverrideErrorMessage(null);
  };

  const resetRepairConflictTaskState = () => {
    setRepairConflictIsSubmitting(false);
    setRepairConflictErrorMessage(null);
  };

  const resetTransferTaskState = () => {
    setTransferSourceRow(null);
    setTransferTargetContainerId('');
    setTransferQuantity('');
    setTransferIsSubmitting(false);
    setTransferErrorMessage(null);
  };

  const resetExtractTaskState = () => {
    setExtractSourceRow(null);
    setExtractTargetMode('existing-container');
    setExtractTargetContainerId('');
    setExtractNewContainerTypeId('');
    setExtractNewContainerExternalCode('');
    setExtractQuantity('');
    setExtractIsSubmitting(false);
    setExtractErrorMessage(null);
  };

  const resetSwapTaskState = () => {
    setSwapTaskState(null);
  };

  useEffect(() => {
    if (taskKindRef.current === 'move-container') {
      const current = moveTaskRef.current;
      if (cellId && current && cellId !== current.sourceCellId) {
        setMoveTaskState((prev) => (prev ? { ...prev, targetCellId: cellId } : null));
      }
      return;
    }

    if (taskKindRef.current === 'swap-container') {
      const current = swapTaskRef.current;
      if (cellId && current && cellId !== current.sourceCellId) {
        setSwapTaskState((prev) => (prev ? { ...prev, targetCellId: cellId, errorMessage: null } : null));
      }
      return;
    }

    setSelectedContainerId(null);
    setTaskKind(null);
    setMoveTaskState(null);
    setSwapTaskState(null);
    setMaterializationWarning(null);
    resetCreateTaskState();
    resetCreateWithProductTaskState();
    resetCreateFromPresetTaskState();
    resetPlaceExistingTaskState();
    resetAddProductTaskState();
    resetRemoveContainerTaskState();
    resetEditOverrideTaskState();
    resetRepairConflictTaskState();
    resetTransferTaskState();
    resetExtractTaskState();
  }, [cellId]);

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
  ]);

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
  ]);

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

  const closeCreateFromPresetTask = () => {
    setTaskKind(null);
    resetCreateFromPresetTaskState();
  };

  const closePlaceExistingTask = () => {
    if (placeExistingIsSubmitting) return;
    setTaskKind(null);
    resetPlaceExistingTaskState();
  };

  const closeAddProductTask = () => {
    setTaskKind(null);
    resetAddProductTaskState();
  };

  const closeRemoveContainerTask = () => {
    if (removeContainerIsSubmitting) return;
    setTaskKind(null);
    resetRemoveContainerTaskState();
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

  const closeTransferTask = () => {
    if (transferIsSubmitting) return;
    setTaskKind(null);
    resetTransferTaskState();
  };

  const closeExtractTask = () => {
    if (extractIsSubmitting) return;
    setTaskKind(null);
    resetExtractTaskState();
  };

  const closeSwapTask = () => {
    if (swapTaskState?.stage === 'swapping') return;
    const current = swapTaskState;
    setTaskKind(null);
    resetSwapTaskState();
    if (current) {
      selectCell({
        cellId: current.sourceCellId,
        rackId: current.sourceRackId ?? '',
        level: current.sourceLevel
      });
      setSelectedContainerId(current.sourceContainerId);
    }
  };

  const openCreateTask = () => {
    resetCreateTaskState();
    setTaskKind('create-container');
  };

  const openCreateWithProductTask = () => {
    resetCreateWithProductTaskState();
    setTaskKind('create-container-with-product');
  };

  const openCreateFromPresetTask = () => {
    resetCreateFromPresetTaskState();
    setMaterializationWarning(null);
    setTaskKind('create-container-from-preset');
  };

  const openPlaceExistingTask = () => {
    resetPlaceExistingTaskState();
    setTaskKind('place-existing');
  };

  const openAddProductTask = () => {
    resetAddProductTaskState();
    setTaskKind('add-product-to-container');
  };

  const openRemoveContainerTask = () => {
    resetRemoveContainerTaskState();
    setTaskKind('remove-container');
  };

  const openSwapContainerTask = () => {
    if (!cellId || !locationId || !selectedContainerId) return;
    setSwapTaskState({
      sourceContainerId: selectedContainerId,
      sourceCellId: cellId,
      sourceLocationId: locationId,
      sourceRackId: rackId,
      sourceLevel: activeLevel,
      sourceLocationCode: locationCode,
      sourceContainerDisplayCode:
        storageRows.find((row) => row.containerId === selectedContainerId)?.externalCode ??
        storageRows.find((row) => row.containerId === selectedContainerId)?.systemCode ??
        selectedContainerId,
      targetCellId: null,
      stage: 'selecting-target',
      errorMessage: null
    });
    setTaskKind('swap-container');
  };

  const openTransferToContainerTask = (row: LocationStorageSnapshotRow) => {
    if (!row.inventoryUnitId) return;
    resetTransferTaskState();
    setTransferSourceRow(row);
    setTransferQuantity(row.quantity !== null ? String(row.quantity) : '');
    setTaskKind('transfer-to-container');
  };

  const openExtractQuantityTask = (row: LocationStorageSnapshotRow) => {
    if (!row.inventoryUnitId) return;
    resetExtractTaskState();
    setExtractSourceRow(row);
    setExtractQuantity(row.quantity !== null ? String(row.quantity) : '');
    setTaskKind('extract-quantity');
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
      } catch (error) {
        setCreateErrorMessage(errorMessageFromUnknown(error, 'Failed to create container.'));
        return;
      }

      try {
        await placeContainer({ containerId, locationId });
      } catch (error) {
        setCreateErrorMessage(errorMessageFromUnknown(error, 'Failed to place container at this location.'));
        return;
      }

      await invalidatePlacementQueries(queryClient, { floorId, containerId });
      await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
      setSelectedContainerId(null);
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

  const handleCreateFromPresetSelect = (product: Product) => {
    setCreateFromPresetSelectedProduct(product);
    setCreateFromPresetProductSearch(product.name ?? product.sku ?? '');
    setCreateFromPresetPresetId('');
  };

  const handleCreateFromPresetSearchChange = (value: string) => {
    setCreateFromPresetProductSearch(value);
    setCreateFromPresetSelectedProduct(null);
    setCreateFromPresetPresetId('');
  };

  const handleCreateFromPresetConfirm = async () => {
    if (!locationId || !createFromPresetSelectedProduct || !createFromPresetPresetId || createFromPresetIsSubmitting) {
      return;
    }

    setCreateFromPresetIsSubmitting(true);
    setCreateFromPresetErrorMessage(null);

    try {
      const result = await createContainerFromStoragePreset({
        presetId: createFromPresetPresetId,
        locationId,
        externalCode: createFromPresetExternalCode.trim() || undefined,
        materializeContents: createFromPresetMaterializeContents
      });
      await invalidatePlacementQueries(queryClient, { floorId, containerId: result.containerId });
      await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
      await queryClient.invalidateQueries({ queryKey: containerKeys.list() });
      if (result.materializationStatus === 'partial_failed') {
        setMaterializationWarning({
          containerId: result.containerId,
          message: result.materializationErrorMessage
            ? `${partialMaterializationWarningCopy} Reason: ${result.materializationErrorMessage}`
            : partialMaterializationWarningCopy
        });
      } else {
        setMaterializationWarning(null);
      }
      setSelectedContainerId(result.containerId);
      closeCreateFromPresetTask();
    } catch (error) {
      if (createFromPresetMaterializeContents) {
        await invalidatePlacementQueries(queryClient, { floorId });
        await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
        await queryClient.invalidateQueries({ queryKey: containerKeys.list() });
      }
      setCreateFromPresetErrorMessage(
        errorMessageFromUnknown(
          error,
          createFromPresetMaterializeContents
            ? 'Container may have been created/placed, but preset contents materialization failed.'
            : 'Failed to create container from preset.'
        )
      );
    } finally {
      setCreateFromPresetIsSubmitting(false);
    }
  };

  const handlePreferredPresetChange = async (presetId: string | null) => {
    if (!locationId || !effectiveRoleProductId) return;
    setPreferredPresetIsSubmitting(true);
    try {
      await setPreferredStoragePreset({
        locationId,
        productId: effectiveRoleProductId,
        preferredPackagingProfileId: presetId
      });
      await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
    } finally {
      setPreferredPresetIsSubmitting(false);
    }
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
      } catch (error) {
        setCreateWithProductErrorMessage(errorMessageFromUnknown(error, 'Failed to create container.'));
        return;
      }

      try {
        await placeContainer({ containerId, locationId });
      } catch (error) {
        setCreateWithProductErrorMessage(
          errorMessageFromUnknown(error, 'Failed to place container at this location.')
        );
        return;
      }

      try {
        await addInventoryItem({
          containerId,
          productId: createWithProductSelectedProduct.id,
          quantity: Number(createWithProductQuantity),
          uom: createWithProductUom.trim()
        });
      } catch (error) {
        await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
        setCreateWithProductErrorMessage(
          errorMessageFromUnknown(
            error,
            'Container was created and placed, but inventory could not be added. The container is now empty at this location.'
          )
        );
        return;
      }

      await invalidatePlacementQueries(queryClient, { floorId, containerId });
      await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
      setSelectedContainerId(null);
      closeCreateWithProductTask();
    } finally {
      setCreateWithProductIsSubmitting(false);
    }
  };

  const handlePlaceExistingConfirm = async () => {
    if (!locationId || !placeExistingContainerId || placeExistingIsSubmitting) return;

    setPlaceExistingIsSubmitting(true);
    setPlaceExistingErrorMessage(null);

    try {
      await placeContainer({ containerId: placeExistingContainerId, locationId });
      await invalidatePlacementQueries(queryClient, {
        floorId,
        containerId: placeExistingContainerId
      });
      await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
      setSelectedContainerId(null);
      setTaskKind(null);
      resetPlaceExistingTaskState();
    } catch (error) {
      setPlaceExistingErrorMessage(
        errorMessageFromUnknown(error, 'Failed to place container at this location.')
      );
    } finally {
      setPlaceExistingIsSubmitting(false);
    }
  };

  const invalidateContentsActionReadSurface = async (
    sourceContainerId: string,
    targetContainerId: string,
    invalidateContainerList = false
  ) => {
    await invalidateContainerInventoryQueries(queryClient, {
      floorId,
      sourceCellId: cellId,
      containerId: sourceContainerId,
      targetContainerId,
      locationId,
      invalidateContainerList
    });
  };

  const submitTransferToExistingContainer = async (
    sourceLine: LocationStorageSnapshotRow,
    targetContainerId: string,
    quantity: number
  ) => {
    if (!sourceLine.inventoryUnitId) {
      throw new Error('Inventory unit is not available for this row.');
    }

    await transferInventoryToContainer({
      inventoryUnitId: sourceLine.inventoryUnitId,
      targetContainerId,
      quantity
    });
    await invalidateContentsActionReadSurface(sourceLine.containerId, targetContainerId);
  };

  const handleTransferConfirm = async () => {
    const quantityError = validateContentsQuantity(transferSourceRow, transferQuantity);
    const targetError = validateTargetContainer(transferSourceRow, transferTargetContainerId);
    if (quantityError || targetError || !transferSourceRow || transferIsSubmitting) {
      setTransferErrorMessage(quantityError ?? targetError);
      return;
    }

    const quantity = parsePositiveQuantity(transferQuantity);
    if (quantity === null) return;

    setTransferIsSubmitting(true);
    setTransferErrorMessage(null);
    try {
      await submitTransferToExistingContainer(transferSourceRow, transferTargetContainerId, quantity);
      setTaskKind(null);
      resetTransferTaskState();
    } catch (error) {
      setTransferErrorMessage(errorMessageFromUnknown(error, 'Could not transfer inventory.'));
    } finally {
      setTransferIsSubmitting(false);
    }
  };

  const handleExtractConfirm = async () => {
    const quantityError = validateContentsQuantity(extractSourceRow, extractQuantity);
    const targetError =
      extractTargetMode === 'existing-container'
        ? validateTargetContainer(extractSourceRow, extractTargetContainerId)
        : extractTargetMode === 'new-container'
          ? extractNewContainerTypeId
            ? null
            : 'Container type is required.'
          : 'Loose extract is not available yet.';
    if (quantityError || targetError || !extractSourceRow || extractIsSubmitting) {
      setExtractErrorMessage(quantityError ?? targetError);
      return;
    }

    const quantity = parsePositiveQuantity(extractQuantity);
    if (quantity === null) return;

    setExtractIsSubmitting(true);
    setExtractErrorMessage(null);
    let createdContainerId: string | null = null;
    let createdContainerPlaced = false;
    try {
      if (extractTargetMode === 'existing-container') {
        await submitTransferToExistingContainer(extractSourceRow, extractTargetContainerId, quantity);
      } else if (extractTargetMode === 'new-container') {
        if (!locationId) {
          setExtractErrorMessage('Current location is required.');
          return;
        }

        const result = await createContainer({
          containerTypeId: extractNewContainerTypeId,
          externalCode: extractNewContainerExternalCode.trim() || undefined
        });
        createdContainerId = result.containerId;
        await placeContainer({ containerId: result.containerId, locationId });
        createdContainerPlaced = true;
        await transferInventoryToContainer({
          inventoryUnitId: extractSourceRow.inventoryUnitId as string,
          targetContainerId: result.containerId,
          quantity
        });
        await invalidateContentsActionReadSurface(extractSourceRow.containerId, result.containerId, true);
      }

      setTaskKind(null);
      resetExtractTaskState();
    } catch (error) {
      if (createdContainerId) {
        await invalidateContentsActionReadSurface(
          extractSourceRow.containerId,
          createdContainerId,
          true
        );
      }

      if (createdContainerPlaced) {
        const backendMessage = errorMessageFromUnknown(error, 'Transfer failed.');
        setExtractErrorMessage(
          `Container was created and placed, but transfer failed. The empty container remains at this location. ${backendMessage}`
        );
      } else {
        setExtractErrorMessage(errorMessageFromUnknown(error, 'Could not extract inventory.'));
      }
    } finally {
      setExtractIsSubmitting(false);
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
      setTaskKind(null);
      setMoveTaskState(null);
      setSelectedContainerId(null);
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

  const handleSwapConfirm = async (targetContainerId: string, targetLocationId: string) => {
    if (!swapTaskState || !cellId || swapTaskState.stage === 'swapping') return;

    if (targetContainerId === swapTaskState.sourceContainerId) {
      setSwapTaskState((prev) =>
        prev
          ? { ...prev, stage: 'error', errorMessage: 'Target container must be different from source container.' }
          : null
      );
      return;
    }

    if (targetLocationId === swapTaskState.sourceLocationId) {
      setSwapTaskState((prev) =>
        prev
          ? { ...prev, stage: 'error', errorMessage: 'Target location must be different from source location.' }
          : null
      );
      return;
    }

    const targetCellId = cellId;
    const targetRackId = rackId;
    const targetLevel = activeLevel;

    setSwapTaskState((prev) => (prev ? { ...prev, stage: 'swapping', errorMessage: null } : null));

    try {
      await swapContainersApi({
        sourceContainerId: swapTaskState.sourceContainerId,
        targetContainerId
      });
      await invalidatePlacementQueries(queryClient, {
        floorId,
        sourceCellId: swapTaskState.sourceCellId,
        targetCellId,
        containerId: swapTaskState.sourceContainerId,
        targetContainerId
      });
      setTaskKind(null);
      resetSwapTaskState();
      selectCell({ cellId: targetCellId, rackId: targetRackId ?? '', level: targetLevel });
      setSelectedContainerId(swapTaskState.sourceContainerId);
    } catch (error) {
      setSwapTaskState((prev) =>
        prev
          ? {
              ...prev,
              stage: 'error',
              errorMessage: errorMessageFromUnknown(error, 'Could not swap containers.')
            }
          : null
      );
    }
  };

  const handleRemoveContainerConfirm = async (containerId: string) => {
    if (removeContainerIsSubmitting) return;

    setRemoveContainerIsSubmitting(true);
    setRemoveContainerErrorMessage(null);

    try {
      await removeContainer({ containerId });
      await invalidatePlacementQueries(queryClient, { floorId, containerId });
      if (locationId) {
        await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
      }
      setSelectedContainerId(null);
      setTaskKind(null);
      resetRemoveContainerTaskState();
    } catch (error) {
      setRemoveContainerErrorMessage(
        errorMessageFromUnknown(error, 'Failed to remove container from location.')
      );
    } finally {
      setRemoveContainerIsSubmitting(false);
    }
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
      />
    );
  }

  if (mode.kind === 'task-swap-container') {
    const targetCellSelected = Boolean(swapTaskState?.targetCellId);
    const targetContainers = targetCellSelected ? groupByContainer(storageRows) : [];
    const targetContainerCount = targetContainers.length;
    const targetContainerId = targetContainerCount === 1 ? targetContainers[0].containerId : null;
    const targetFirstRow = targetContainerId
      ? storageRows.find((row) => row.containerId === targetContainerId)
      : null;
    const targetDisplayCode = targetFirstRow
      ? (targetFirstRow.externalCode ?? targetFirstRow.systemCode ?? targetContainerId)
      : null;
    const isSameTargetContainer =
      targetContainerId !== null && targetContainerId === swapTaskState?.sourceContainerId;
    const isSameTargetLocation =
      locationId !== null && locationId === swapTaskState?.sourceLocationId;
    const targetLocationLoading = locationRefLoading || (Boolean(locationId) && storageLoading);
    const targetLoadError = locationRefIsError || storageIsError
      ? errorMessageFromUnknown(
          locationRefIsError ? locationRefError : storageError,
          'Could not load the selected target location.'
        )
      : null;
    const canConfirm =
      swapTaskState !== null &&
      swapTaskState.targetCellId !== null &&
      !targetLocationLoading &&
      targetLoadError === null &&
      targetContainerCount === 1 &&
      targetContainerId !== null &&
      locationId !== null &&
      !isSameTargetContainer &&
      !isSameTargetLocation &&
      swapTaskState.stage === 'selecting-target';

    return (
      <SwapContainerTaskPanel
        swapTaskState={swapTaskState!}
        rackDisplayCode={rackDisplayCode}
        targetLocationCode={targetCellSelected ? locationCode : null}
        targetContainerDisplayCode={targetDisplayCode}
        targetContainerCount={targetContainerCount}
        targetLocationLoading={targetLocationLoading}
        targetLocationId={targetCellSelected ? locationId : null}
        canConfirm={canConfirm}
        isSubmitting={swapTaskState?.stage === 'swapping'}
        errorMessage={
          swapTaskState?.errorMessage ??
          targetLoadError ??
          (isSameTargetContainer
            ? 'Target container must be different from source container.'
            : isSameTargetLocation
              ? 'Target location must be different from source location.'
              : null)
        }
        onConfirm={() => {
          if (targetContainerId && locationId) {
            void handleSwapConfirm(targetContainerId, locationId);
          }
        }}
        onCancel={closeSwapTask}
      />
    );
  }

  if (locationRefLoading || (locationId && storageLoading)) {
    return <LoadingState />;
  }

  if (locationRefIsError || storageIsError) {
    const message = locationRefIsError
      ? errorMessageFromUnknown(locationRefError, 'Could not load the selected location.')
      : errorMessageFromUnknown(storageError, 'Could not load storage for this location.');
    return (
      <LoadingErrorState
        title="Location failed to load"
        message={message}
        onRetry={() => {
          if (locationRefIsError) {
            void refetchLocationRef();
          }
          if (storageIsError) {
            void refetchStorageRows();
          }
        }}
      />
    );
  }

  const isOccupied = storageRows.length > 0;
  const containers = groupByContainer(storageRows);

  if (mode.kind === 'task-place-existing') {
    return (
      <PlaceExistingContainerTaskPanel
        containers={storageContainers}
        excludedContainerIds={new Set(containers.map((container) => container.containerId))}
        selectedContainerId={placeExistingContainerId}
        isLoading={storageContainersLoading}
        isSubmitting={placeExistingIsSubmitting}
        locationId={locationId}
        errorMessage={placeExistingErrorMessage}
        rackDisplayCode={rackDisplayCode}
        locationCode={locationCode}
        activeLevel={activeLevel}
        onContainerChange={setPlaceExistingContainerId}
        onConfirm={() => void handlePlaceExistingConfirm()}
        onCancel={closePlaceExistingTask}
      />
    );
  }

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

  if (mode.kind === 'task-create-container-from-preset') {
    return (
      <CreateContainerFromPresetTaskPanel
        productSearch={createFromPresetProductSearch}
        selectedProduct={createFromPresetSelectedProduct}
        searchResults={createFromPresetSearchResults}
        presets={createFromPresetPresets}
        selectedPresetId={createFromPresetPresetId}
        externalCode={createFromPresetExternalCode}
        materializeContents={createFromPresetMaterializeContents}
        isLoadingPresets={createFromPresetPresetsLoading}
        isSubmitting={createFromPresetIsSubmitting}
        locationId={locationId}
        errorMessage={createFromPresetErrorMessage}
        rackDisplayCode={rackDisplayCode}
        locationCode={locationCode}
        activeLevel={activeLevel}
        onProductSearchChange={handleCreateFromPresetSearchChange}
        onProductSelect={handleCreateFromPresetSelect}
        onPresetChange={setCreateFromPresetPresetId}
        onExternalCodeChange={setCreateFromPresetExternalCode}
        onMaterializeContentsChange={setCreateFromPresetMaterializeContents}
        onConfirm={() => void handleCreateFromPresetConfirm()}
        onCancel={closeCreateFromPresetTask}
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

  if (mode.kind === 'task-transfer-to-container') {
    const containerRows = storageRows.filter((row) => row.containerId === mode.containerId);
    const first = containerRows[0];
    const displayCode = first ? (first.externalCode ?? first.systemCode) : mode.containerId;
    const sourceLine = transferSourceRow ?? null;
    if (!sourceLine) {
      return <LoadingState />;
    }
    const validationMessage =
      validateContentsQuantity(sourceLine, transferQuantity) ??
      validateTargetContainer(sourceLine, transferTargetContainerId);

    return (
      <TransferToContainerTaskPanel
        rackDisplayCode={rackDisplayCode}
        activeLevel={activeLevel}
        locationCode={locationCode}
        sourceLine={sourceLine}
        sourceContainerDisplayCode={displayCode}
        containers={storageContainers}
        selectedTargetContainerId={transferTargetContainerId}
        quantity={transferQuantity}
        isSubmitting={transferIsSubmitting}
        isLoadingContainers={storageContainersLoading}
        errorMessage={transferErrorMessage}
        validationMessage={validationMessage}
        onTargetContainerChange={setTransferTargetContainerId}
        onQuantityChange={setTransferQuantity}
        onConfirm={() => void handleTransferConfirm()}
        onCancel={closeTransferTask}
      />
    );
  }

  if (mode.kind === 'task-extract-quantity') {
    const containerRows = storageRows.filter((row) => row.containerId === mode.containerId);
    const first = containerRows[0];
    const displayCode = first ? (first.externalCode ?? first.systemCode) : mode.containerId;
    const sourceLine = extractSourceRow ?? null;
    if (!sourceLine) {
      return <LoadingState />;
    }
    const validationMessage =
      validateContentsQuantity(sourceLine, extractQuantity) ??
      (extractTargetMode === 'existing-container'
        ? validateTargetContainer(sourceLine, extractTargetContainerId)
        : extractTargetMode === 'new-container'
          ? extractNewContainerTypeId
            ? locationId
              ? null
              : 'Current location is required.'
            : 'Container type is required.'
          : 'Loose extract is not available yet.');

    return (
      <ExtractQuantityTaskPanel
        rackDisplayCode={rackDisplayCode}
        activeLevel={activeLevel}
        locationCode={locationCode}
        sourceLine={sourceLine}
        sourceContainerDisplayCode={displayCode}
        containers={storageContainers}
        containerTypes={containerTypes}
        targetMode={extractTargetMode}
        selectedTargetContainerId={extractTargetContainerId}
        newContainerTypeId={extractNewContainerTypeId}
        newContainerExternalCode={extractNewContainerExternalCode}
        quantity={extractQuantity}
        isSubmitting={extractIsSubmitting}
        isLoadingContainers={storageContainersLoading}
        errorMessage={extractErrorMessage}
        validationMessage={validationMessage}
        onTargetModeChange={setExtractTargetMode}
        onTargetContainerChange={setExtractTargetContainerId}
        onNewContainerTypeChange={setExtractNewContainerTypeId}
        onNewContainerExternalCodeChange={setExtractNewContainerExternalCode}
        onQuantityChange={setExtractQuantity}
        onConfirm={() => void handleExtractConfirm()}
        onCancel={closeExtractTask}
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

  if (mode.kind === 'task-remove-container') {
    const containerRows = storageRows.filter((row) => row.containerId === mode.containerId);
    const first = containerRows[0];
    const displayCode = first ? (first.externalCode ?? first.systemCode) : mode.containerId;

    return (
      <RemoveContainerTaskPanel
        rackDisplayCode={rackDisplayCode}
        activeLevel={activeLevel}
        locationCode={locationCode}
        containerDisplayCode={displayCode}
        isSubmitting={removeContainerIsSubmitting}
        errorMessage={removeContainerErrorMessage}
        onConfirm={() => void handleRemoveContainerConfirm(mode.containerId)}
        onCancel={closeRemoveContainerTask}
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
      <ContainerDetailPanel
        rackDisplayCode={rackDisplayCode}
        activeLevel={activeLevel}
        locationCode={locationCode}
        displayCode={displayCode}
        firstRow={first}
        items={items}
        selectedProduct={selectedProduct}
        structuralDefaultText={structuralDefaultText}
        effectiveRoleText={effectiveRoleText}
        sourceText={sourceText}
        hasProductContext={hasProductContext}
        isConflict={isConflict}
        showNoneExplanation={showNoneExplanation}
        materializationWarning={
          materializationWarning?.containerId === mode.containerId ? materializationWarning.message : null
        }
        storagePresets={effectiveProductStoragePresets}
        preferredPackagingProfileId={first?.preferredPackagingProfileId ?? null}
        preferredPresetPending={preferredPresetIsSubmitting}
        canShowOverrideEntry={canShowOverrideEntry}
        hasExplicitOverride={hasExplicitOverride}
        canShowRepairConflictEntry={canShowRepairConflictEntry}
        isEmptyContainer={isEmptyContainer}
        onBack={() => {
          setSelectedContainerId(null);
          setMaterializationWarning(null);
        }}
        onOpenEditOverrideTask={openEditOverrideTask}
        onOpenRepairConflictTask={openRepairConflictTask}
        onOpenAddProductTask={openAddProductTask}
        onPreferredPresetChange={(presetId) => void handlePreferredPresetChange(presetId)}
        onOpenTransferToContainerTask={openTransferToContainerTask}
        onOpenExtractQuantityTask={openExtractQuantityTask}
        onOpenRemoveContainerTask={openRemoveContainerTask}
        onOpenSwapContainerTask={openSwapContainerTask}
        onStartMoveContainer={() => {
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
      />
    );
  }

  const cellOverviewContainers = buildCurrentContainerCards(containers);
  const cellOverviewInventoryItems = buildCurrentInventoryItems(storageRows);
  const cellOverviewPolicyAssignments = buildPolicyAssignments(locationProductAssignments);

  return (
    <CellSectionOverviewPanel
      rackDisplayCode={rackDisplayCode}
      activeLevel={activeLevel}
      locationCode={locationCode}
      isOccupied={isOccupied}
      locationType={storageRows[0]?.locationType ?? null}
      containers={cellOverviewContainers}
      inventoryItems={cellOverviewInventoryItems}
      policyAssignments={cellOverviewPolicyAssignments}
      policyPending={locationProductAssignmentsLoading}
      sourceCellId={cellId}
      onSelectContainer={(containerId) => {
        setSelectedContainerId(containerId);
        setMaterializationWarning(null);
      }}
      onOpenPlaceExistingTask={openPlaceExistingTask}
      onOpenCreateTask={openCreateTask}
      onOpenCreateFromPresetTask={openCreateFromPresetTask}
      onOpenCreateWithProductTask={openCreateWithProductTask}
    />
  );
}
