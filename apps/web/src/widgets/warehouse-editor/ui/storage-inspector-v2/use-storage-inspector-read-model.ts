import type { FloorWorkspace, Rack } from '@wos/domain';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useContainerTypes } from '@/entities/container/api/use-container-types';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import { useProductsSearch } from '@/entities/product/api/use-products-search';
import { useLocationEffectiveRole } from '@/entities/product-location-role/api/use-location-effective-role';
import { useLocationProductAssignments } from '@/entities/product-location-role/api/use-location-product-assignments';
import {
  useStorageFocusActiveLevel,
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId
} from '../../model/v2/v2-selectors';
import type { MoveTaskState, TaskKind } from './mode';
import {
  resolveCellOverview,
  resolveEffectiveRoleProductId,
  resolveLocationCode,
  resolveMoveTargetCellId,
  resolveRackDisplayCode,
  resolveSelectedCellAddress
} from './use-storage-inspector-read-model.selectors';

export interface UseStorageInspectorReadModelParams {
  workspace: FloorWorkspace | null;
  selectedContainerId: string | null;
  taskKind: TaskKind | null;
  moveTaskState: MoveTaskState | null;
  createWithProductSearch: string;
  addProductSearch: string;
}

export function useStorageInspectorReadModel({
  workspace,
  selectedContainerId,
  taskKind,
  moveTaskState,
  createWithProductSearch,
  addProductSearch
}: UseStorageInspectorReadModelParams) {
  const racks: Record<string, Rack> | undefined = workspace?.latestPublished?.racks;
  const floorId = workspace?.floorId ?? null;

  const { data: publishedCells = [] } = usePublishedCells(floorId);
  const { data: containerTypes = [] } = useContainerTypes();

  const cellId = useStorageFocusSelectedCellId();
  const rackId = useStorageFocusSelectedRackId();
  const activeLevel = useStorageFocusActiveLevel() ?? 1;
  const rackDisplayCode = resolveRackDisplayCode(rackId, racks);

  const { data: createWithProductSearchResults = [] } = useProductsSearch(createWithProductSearch.trim() || null);
  const { data: addProductSearchResults = [] } = useProductsSearch(addProductSearch.trim() || null);

  const { data: locationRef, isLoading: locationRefLoading } = useLocationByCell(cellId);
  const locationId = locationRef?.locationId ?? null;

  const { data: storageRows = [], isLoading: storageLoading } = useLocationStorage(locationId);
  const { data: locationProductAssignments = [] } = useLocationProductAssignments(locationId);

  const effectiveRoleProductId = resolveEffectiveRoleProductId({
    selectedContainerId,
    taskKind,
    storageRows
  });
  const { data: effectiveRoleContext, isLoading: effectiveRoleLoading } = useLocationEffectiveRole(
    locationId,
    effectiveRoleProductId
  );

  const moveTargetCellId = resolveMoveTargetCellId(moveTaskState);
  const { data: moveTargetLocationRef, isLoading: moveTargetLocationLoading } = useLocationByCell(moveTargetCellId);

  const selectedCellAddress = resolveSelectedCellAddress(publishedCells, cellId);
  const locationCode = resolveLocationCode({ storageRows, selectedCellAddress, cellId });
  const cellOverview = resolveCellOverview({ storageRows });

  return {
    floorId,
    racks,
    publishedCells,
    containerTypes,
    cellId,
    rackId,
    activeLevel,
    rackDisplayCode,
    createWithProductSearchResults,
    addProductSearchResults,
    locationRef,
    locationRefLoading,
    locationId,
    storageRows,
    storageLoading,
    locationProductAssignments,
    effectiveRoleProductId,
    effectiveRoleContext,
    effectiveRoleLoading,
    moveTargetLocationRef,
    moveTargetLocationLoading,
    selectedCellAddress,
    locationCode,
    ...cellOverview
  };
}

export type StorageInspectorReadModel = ReturnType<typeof useStorageInspectorReadModel>;
