import type { FloorWorkspace, LocationStorageSnapshotRow } from '@wos/domain';
import { AlertTriangle, CheckCircle2, Loader2, MoveRight, Package, PackagePlus, RotateCcw, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import {
  useSelectedCellId,
  useSetSelectedContainerId,
  useStartCreateAndPlaceWorkflow,
  useStartPlaceContainerWorkflow,
  useStartPlacementMove
} from '@/widgets/warehouse-editor/model/editor-selectors';
import type { ContextPanelMode } from '@/widgets/warehouse-editor/model/editor-types';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import { useLocationProductAssignments } from '@/entities/product-location-role/api/use-location-product-assignments';
import { useCreateProductLocationRole } from '@/entities/product-location-role/api/mutations';
import { usePolicyBridgeActions } from './use-policy-bridge-actions';

function getUniqueContainerIds(rows: LocationStorageSnapshotRow[]) {
  return [...new Set(rows.map((row) => row.containerId))];
}

function countInventoryRows(rows: LocationStorageSnapshotRow[]) {
  return rows.filter((row) => row.itemRef !== null).length;
}

function formatLocationTypeLabel(locationType: string) {
  return locationType
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getCellOccupancySummary({
  containerCount,
  isLoading,
  isError
}: {
  containerCount: number;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isError) {
    return {
      icon: AlertTriangle,
      label: 'Unavailable',
      style: {
        background: '#fef2f2',
        color: '#b91c1c'
      }
    };
  }

  if (isLoading) {
    return {
      icon: Loader2,
      label: 'Loading',
      style: {
        background: '#eff6ff',
        color: '#1d4ed8'
      }
    };
  }

  if (containerCount === 0) {
    return {
      icon: CheckCircle2,
      label: 'Empty',
      style: {
        background: '#ecfdf5',
        color: '#047857'
      }
    };
  }

  return {
    icon: Package,
    label: `${containerCount} container${containerCount === 1 ? '' : 's'}`,
    style: {
      background: '#fff7ed',
      color: '#c2410c'
    }
  };
}

export function StorageCellContextPanel({
  workspace,
  panelMode
}: {
  workspace: FloorWorkspace | null;
  panelMode: ContextPanelMode;
}) {
  const selectedCellId = useSelectedCellId();
  const startPlaceContainerWorkflow = useStartPlaceContainerWorkflow();
  const startCreateAndPlaceWorkflow = useStartCreateAndPlaceWorkflow();
  const setSelectedContainerId = useSetSelectedContainerId();
  const startPlacementMove = useStartPlacementMove();
  const createProductLocationRole = useCreateProductLocationRole();

  const { data: publishedCells = [] } = usePublishedCells(workspace?.floorId ?? null);
  const selectedCell =
    publishedCells.find((cell) => cell.id === selectedCellId) ?? null;

  const {
    data: locationRef,
    isPending: isLocationPending,
    isError: isLocationError
  } = useLocationByCell(selectedCellId);
  const locationId = locationRef?.locationId ?? null;
  const {
    data: locationRows = [],
    isPending: isStoragePending,
    isError: isStorageError
  } = useLocationStorage(locationId);
  const {
    data: policyAssignments = [],
    isPending: isPolicyAssignmentsPending,
    isError: isPolicyAssignmentsError
  } = useLocationProductAssignments(locationId);

  const containerIds = useMemo(
    () => getUniqueContainerIds(locationRows),
    [locationRows]
  );
  const inventoryCount = useMemo(
    () => countInventoryRows(locationRows),
    [locationRows]
  );
  const {
    policyBridgeCandidate,
    policyBridgeError,
    isAssignPending,
    handleAssignPolicyRole
  } = usePolicyBridgeActions({
    selectedCellId,
    locationId,
    locationRows,
    policyAssignments,
    createProductLocationRole
  });

  if (!selectedCellId || !selectedCell) {
    return <PlaceholderContent description="Cell context is unavailable for the current selection." />;
  }

  const isLoading = isLocationPending || (locationId !== null && isStoragePending);
  const isError = isLocationError || isStorageError;
  const status = getCellOccupancySummary({
    containerCount: containerIds.length,
    isLoading,
    isError
  });
  const StatusIcon = status.icon;
  const canMoveSingleContainer = containerIds.length === 1 && !isLoading && !isError;
  const moveSourceContainerId = canMoveSingleContainer ? containerIds[0] : null;
  const moveHint = isError
    ? 'Resolve storage loading before starting a move.'
    : isLoading
      ? 'Checking current containers before move.'
      : containerIds.length === 0
        ? 'Place a container before move is available.'
        : containerIds.length > 1
          ? 'Open a specific container in the inspector to move one item.'
          : 'Move this container to another destination cell.';
  const isExpanded = panelMode === 'expanded';
  const shouldShowPolicyBridge =
    !isLoading &&
    !isError &&
    !isPolicyAssignmentsPending &&
    !isPolicyAssignmentsError &&
    locationId !== null &&
    policyBridgeCandidate !== null;

  return (
    <div className={isExpanded ? 'px-4 py-4' : 'px-3 py-3'}>
      <div
        className={`rounded-xl border border-[var(--border-muted)] bg-white ${
          isExpanded ? 'p-4' : 'p-3'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-mono text-sm font-semibold text-slate-900" title={selectedCell.address.raw}>
              {selectedCell.address.raw}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {locationRef
                ? `${locationRef.locationCode} | ${formatLocationTypeLabel(locationRef.locationType)}`
                : isLocationError
                  ? 'Location unavailable'
                  : 'Resolving location...'}
            </div>
          </div>

          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
            style={status.style}
          >
            <StatusIcon className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`.trim()} />
            {status.label}
          </span>
        </div>

        <div className={`mt-3 grid grid-cols-2 ${isExpanded ? 'gap-3' : 'gap-2'}`}>
          {[
            { label: 'Containers', value: String(containerIds.length) },
            { label: 'Inventory rows', value: String(inventoryCount) }
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2"
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {label}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">{value}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          {moveHint} Full containers, inventory, and policy detail stay in the inspector.
        </p>
      </div>

      {shouldShowPolicyBridge && (
        <div
          className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"
          data-testid="stock-policy-bridge-card"
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-amber-900">Stock has no location role</div>
              <p className="mt-1 truncate text-[11px] text-amber-800" title={policyBridgeCandidate.product.name}>
                {policyBridgeCandidate.product.name}
                {policyBridgeCandidate.product.sku ? ` | ${policyBridgeCandidate.product.sku}` : ''}
              </p>
              <p className="mt-1 text-[11px] text-amber-700">
                Present in {policyBridgeCandidate.containerCount} container
                {policyBridgeCandidate.containerCount === 1 ? '' : 's'}. Assign a role directly.
              </p>
            </div>
          </div>

          {policyBridgeError && (
            <p className="mt-2 text-[11px] text-red-600">{policyBridgeError}</p>
          )}

          <div
            className={`mt-3 grid gap-2 ${
              policyBridgeCandidate.missingPrimaryPick && policyBridgeCandidate.missingReserve
                ? 'grid-cols-2'
                : 'grid-cols-1'
            }`}
          >
            {policyBridgeCandidate.missingPrimaryPick && (
              <button
                type="button"
                className="rounded-lg border border-cyan-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-cyan-700 shadow-sm transition-colors hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handleAssignPolicyRole('primary_pick')}
                disabled={isAssignPending}
              >
                {isAssignPending ? 'Assigning...' : 'Assign primary pick'}
              </button>
            )}
            {policyBridgeCandidate.missingReserve && (
              <button
                type="button"
                className="rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-amber-700 shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handleAssignPolicyRole('reserve')}
                disabled={isAssignPending}
              >
                {isAssignPending ? 'Assigning...' : 'Assign reserve'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`mt-3 grid ${isExpanded ? 'grid-cols-3 gap-3' : 'gap-2'}`}>
        <ContextActionButton
          label="Place"
          icon={PackagePlus}
          disabled={isLocationError || locationId === null}
          onClick={() => startPlaceContainerWorkflow(selectedCell.id)}
        />
        <ContextActionButton
          label="Create + place"
          icon={Package}
          disabled={isLocationError || locationId === null}
          onClick={() => startCreateAndPlaceWorkflow(selectedCell.id)}
        />
        <ContextActionButton
          label="Move"
          icon={MoveRight}
          disabled={!moveSourceContainerId}
          onClick={() => {
            if (!moveSourceContainerId) return;
            setSelectedContainerId(moveSourceContainerId, selectedCell.id);
            startPlacementMove(moveSourceContainerId, selectedCell.id);
          }}
        />
      </div>
    </div>
  );
}

function ContextActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  className = '',
  disabled = false
}: {
  icon: typeof RotateCcw;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  className?: string;
  disabled?: boolean;
}) {
  const buttonClassName =
    variant === 'danger'
      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
      : 'border-[var(--border-muted)] bg-white text-slate-600 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName} ${className}`.trim()}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function PlaceholderContent({ description }: { description: string }) {
  return (
    <div className="px-3 py-3">
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        {description}
      </p>
    </div>
  );
}
