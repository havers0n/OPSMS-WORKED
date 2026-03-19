import { useEffect, useState } from 'react';
import type { FloorWorkspace, LocationStorageSnapshotRow } from '@wos/domain';
import { AlertCircle, ChevronRight, Layers, Loader2, MapPin, Package } from 'lucide-react';
import { BffRequestError } from '@/shared/api/bff/client';
import {
  useEditorSelection,
  useSetSelectedContainerId
} from '@/entities/layout-version/model/editor-selectors';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import { useContainerTypes } from '@/entities/container/api/use-container-types';
import { getProductImageUrl, getProductLabel, getProductMeta } from '@/entities/product/lib/display';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useCreateContainer } from '@/features/container-create/model/use-create-container';
import { usePlaceContainer } from '@/features/placement-actions/model/use-place-container';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  quarantined: { label: 'Quarantined', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  lost: { label: 'Lost', className: 'bg-red-50 text-red-600 border-red-200' },
  damaged: { label: 'Damaged', className: 'bg-orange-50 text-orange-700 border-orange-200' }
};

function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ?? {
      label: status,
      className: 'bg-slate-100 text-slate-500 border-slate-200'
    };

  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}

type ContainerGroup = {
  containerId: string;
  externalCode: string | null;
  containerType: string;
  containerStatus: string;
  placedAt: string;
  items: Array<{ itemRef: string; product: LocationStorageSnapshotRow['product']; quantity: number; uom: string }>;
};

function groupByContainer(rows: LocationStorageSnapshotRow[]): ContainerGroup[] {
  const map = new Map<string, ContainerGroup>();

  for (const row of rows) {
    if (!map.has(row.containerId)) {
      map.set(row.containerId, {
        containerId: row.containerId,
        externalCode: row.externalCode,
        containerType: row.containerType,
        containerStatus: row.containerStatus,
        placedAt: row.placedAt,
        items: []
      });
    }

    if (row.itemRef !== null && row.quantity !== null && row.uom !== null) {
      map.get(row.containerId)!.items.push({
        itemRef: row.itemRef,
        product: row.product,
        quantity: row.quantity,
        uom: row.uom
      });
    }
  }

  return [...map.values()];
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatMutationError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type ContainerCardProps = {
  group: ContainerGroup;
  onContainerClick: (containerId: string, sourceCellId: string | null) => void;
  sourceCellId: string | null;
};

function ContainerCard({ group, onContainerClick, sourceCellId }: ContainerCardProps) {
  return (
    <button
      type="button"
      className="w-full rounded-lg text-left transition-shadow hover:ring-1 hover:ring-[var(--accent)]"
      style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
      onClick={() => onContainerClick(group.containerId, sourceCellId)}
    >
      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
            {group.externalCode ?? <span className="text-[var(--text-muted)]">No code</span>}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            {group.containerType} &middot; placed {formatDate(group.placedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge status={group.containerStatus} />
          <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        </div>
      </div>

      {group.items.length > 0 ? (
        <div className="border-t border-[var(--border-muted)] px-3 py-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Inventory
          </p>
          <div className="flex flex-col gap-1">
            {group.items.map((item, index) => (
              <div key={`${item.itemRef}-${index}`} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {getProductImageUrl(item.product) ? (
                    <img
                      src={getProductImageUrl(item.product)!}
                      alt={getProductLabel(item.itemRef, item.product)}
                      className="h-8 w-8 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[10px] text-[var(--text-muted)]"
                      style={{ background: 'var(--surface-primary)' }}
                    >
                      Item
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs text-[var(--text-primary)]">
                      {getProductLabel(item.itemRef, item.product)}
                    </p>
                    <p className="truncate text-[10px] text-[var(--text-muted)]">
                      {getProductMeta(item.itemRef, item.product)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {item.quantity} {item.uom}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-[var(--border-muted)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
          No inventory items
        </div>
      )}
    </button>
  );
}

export function CellPlacementInspector({ workspace }: { workspace: FloorWorkspace | null }) {
  const selection = useEditorSelection();
  const setSelectedContainerId = useSetSelectedContainerId();
  const [activeAction, setActiveAction] = useState<'place' | 'create' | null>(null);
  const [containerIdInput, setContainerIdInput] = useState('');
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [containerCodeInput, setContainerCodeInput] = useState('');
  const [containerTypeIdInput, setContainerTypeIdInput] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const cellId = selection.type === 'cell' ? selection.cellId : null;
  const { data: publishedCells = [] } = usePublishedCells(workspace?.floorId ?? null);
  const selectedCell = publishedCells.find((cell) => cell.id === cellId) ?? null;

  // Debug: locationQuery inputs
  const locationQueryEnabled = Boolean(cellId);
  const locationQueryKey = cellId ? `location-by-cell:${cellId}` : null;
  const { data: locationRef, error: locationQueryError } = useLocationByCell(cellId);

  // Debug: log location query state
  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[placement] location query input', {
        cellId,
        selectedCell: selectedCell ? { id: selectedCell.id, address: selectedCell.address } : null,
        enabled: locationQueryEnabled,
        queryKey: locationQueryKey
      });
    }
  }, [cellId, selectedCell, locationQueryEnabled, locationQueryKey]);

  useEffect(() => {
    if (import.meta.env.DEV && locationRef) {
      // eslint-disable-next-line no-console
      console.debug('[placement] location query success', locationRef);
    }
    if (import.meta.env.DEV && locationQueryError) {
      // eslint-disable-next-line no-console
      console.error('[placement] location query error', locationQueryError);
    }
  }, [locationRef, locationQueryError]);

  const locationId = locationRef?.locationId ?? null;

  // Debug: storageQuery state
  const storageQueryEnabled = Boolean(locationId);
  const storageQueryError = locationQueryError;
  const { data = [], error, isPending, isError } = useLocationStorage(locationId);

  const { data: containerTypes = [], isPending: isContainerTypesPending, isError: isContainerTypesError } = useContainerTypes();
  const bffError = error instanceof BffRequestError ? error : null;
  const containers = groupByContainer(data);

  const createContainer = useCreateContainer();
  const placeContainer = usePlaceContainer({
    floorId: workspace?.floorId ?? null,
    locationId
  });
  const isActionPending = placeContainer.isPending || createContainer.isPending;

  useEffect(() => {
    if (containerTypeIdInput.length === 0 && containerTypes.length > 0) {
      setContainerTypeIdInput(containerTypes[0].id);
    }
  }, [containerTypeIdInput, containerTypes]);

  const handlePlace = async () => {
    const nextContainerId = containerIdInput.trim();
    if (!selectedCell || !locationId || nextContainerId.length === 0) {
      return;
    }

    setPlaceError(null);

    // Debug instrumentation
    // eslint-disable-next-line no-console
    console.debug('[PLACEMENT] before placeContainer.mutateAsync', {
      containerId: nextContainerId,
      locationId,
      selectedCellId: cellId
    });

    try {
      await placeContainer.mutateAsync({
        containerId: nextContainerId,
        locationId
      });
      // eslint-disable-next-line no-console
      console.debug('[PLACEMENT] placeContainer success');
      setContainerIdInput('');
      setActiveAction(null);
    } catch (mutationError) {
      // eslint-disable-next-line no-console
      console.error('[PLACEMENT] placeContainer error', mutationError);
      setPlaceError(formatMutationError(mutationError, 'Could not place the container.'));
    }
  };

  const handleCreateAndPlace = async () => {
    const externalCode = containerCodeInput.trim();
    if (!selectedCell || !locationId || externalCode.length === 0 || containerTypeIdInput.length === 0) {
      // eslint-disable-next-line no-console
      console.debug('[PLACEMENT] handleCreateAndPlace guard failed', {
        hasSelectedCell: !!selectedCell,
        hasLocationId: !!locationId,
        codeLength: externalCode.length,
        typeLength: containerTypeIdInput.length
      });
      return;
    }

    setCreateError(null);

    // Debug instrumentation
    // eslint-disable-next-line no-console
    console.debug('[PLACEMENT] before createContainer.mutateAsync', {
      externalCode,
      containerTypeId: containerTypeIdInput,
      locationId,
      selectedCellId: cellId
    });

    try {
      const container = await createContainer.mutateAsync({
        externalCode,
        containerTypeId: containerTypeIdInput
      });

      // eslint-disable-next-line no-console
      console.debug('[PLACEMENT] createContainer success', {
        containerId: container.containerId,
        externalCode: container.externalCode
      });

      // eslint-disable-next-line no-console
      console.debug('[PLACEMENT] before placeContainer.mutateAsync (after create)', {
        containerId: container.containerId,
        locationId
      });

      try {
        await placeContainer.mutateAsync({
          containerId: container.containerId,
          locationId
        });
        // eslint-disable-next-line no-console
        console.debug('[PLACEMENT] placeContainer success (after create)');
      } catch (placementError) {
        // eslint-disable-next-line no-console
        console.error('[PLACEMENT] placeContainer error (after create)', placementError);
        setCreateError(
          `Container ${container.externalCode} was created, but it could not be placed into this cell and remains unplaced. ${formatMutationError(
            placementError,
            'Placement failed.'
          )}`
        );
        return;
      }

      setContainerCodeInput('');
      setContainerTypeIdInput(containerTypes[0]?.id ?? '');
      setActiveAction(null);
    } catch (mutationError) {
      // eslint-disable-next-line no-console
      console.error('[PLACEMENT] createContainer error', mutationError);
      setCreateError(formatMutationError(mutationError, 'Could not create the container.'));
    }
  };

  return (
    <aside className="flex h-full w-full flex-col" style={{ background: 'var(--surface-primary)' }}>
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Placement
        </div>
        <div className="mt-1 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            {selectedCell?.address.raw ?? cellId ?? '—'}
          </span>
        </div>
        {selectedCell && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-2 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
              onClick={() => {
                setPlaceError(null);
                setActiveAction((current) => (current === 'place' ? null : 'place'));
              }}
              disabled={isActionPending}
            >
              Place existing container
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-primary)' }}
              onClick={() => {
                setCreateError(null);
                setActiveAction((current) => (current === 'create' ? null : 'create'));
              }}
              disabled={isActionPending}
            >
              + Create container
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {/* Debug instrumentation (dev-only) - top level state */}
        {import.meta.env.DEV && cellId && (
          <div
            className="rounded border border-blue-200 bg-blue-50 p-2 font-mono text-[10px] text-blue-800"
          >
            <p className="font-semibold">🔍 DEBUG: Placement Panel State</p>
            <p>cellId: {cellId}</p>
            <p>selectedCell: {selectedCell ? '✓ found' : '✗ not found'}</p>
            <p>locationQueryEnabled: {locationQueryEnabled ? 'YES' : 'NO'} | queryKey: {locationQueryKey}</p>
            <p>locationQueryError: {locationQueryError ? `ERROR: ${locationQueryError.message}` : 'none'}</p>
            <p>locationRef: {locationRef ? '✓ resolved' : 'pending'} → locationId: {locationId || '(none)'}</p>
            <p>storageQueryEnabled: {storageQueryEnabled ? 'YES' : 'NO'} | error: {storageQueryError ? 'YES' : 'NO'}</p>
            <p>storageQuery: {isPending ? 'pending' : 'done'} | isError: {isError ? 'YES' : 'NO'}</p>
            <p>containerTypesQuery: {isContainerTypesPending ? 'pending' : 'done'} | count: {containerTypes.length}</p>
          </div>
        )}

        {activeAction === 'place' && selectedCell && (
          <div
            className="rounded-lg p-3"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Place existing container
            </p>
            <label className="mt-3 block text-xs text-[var(--text-primary)]">
              Container ID or code
              <input
                value={containerIdInput}
                onChange={(event) => setContainerIdInput(event.target.value)}
                placeholder="PLT-23901"
                className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
              />
            </label>
            {placeError && <p className="mt-2 text-xs text-red-500">{placeError}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
                onClick={() => void handlePlace()}
                disabled={isActionPending || containerIdInput.trim().length === 0}
              >
                {placeContainer.isPending ? 'Placing...' : 'Confirm place'}
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-xs font-medium text-[var(--text-muted)]"
                style={{ borderColor: 'var(--border-muted)' }}
                onClick={() => {
                  setActiveAction(null);
                  setPlaceError(null);
                }}
                disabled={isActionPending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeAction === 'create' && selectedCell && (
          <div
            className="rounded-lg p-3"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Create new container
            </p>
            <label className="mt-3 block text-xs text-[var(--text-primary)]">
              Container code
              <input
                value={containerCodeInput}
                onChange={(event) => setContainerCodeInput(event.target.value)}
                placeholder="PLT-23902"
                className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
              />
            </label>
            <label className="mt-3 block text-xs text-[var(--text-primary)]">
              Container type
              <select
                value={containerTypeIdInput}
                onChange={(event) => setContainerTypeIdInput(event.target.value)}
                className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
                disabled={isContainerTypesPending || isActionPending || containerTypes.length === 0}
              >
                {containerTypes.length === 0 && (
                  <option value="">
                    {isContainerTypesPending ? 'Loading container types...' : 'No container types available'}
                  </option>
                )}
                {containerTypes.map((containerType) => (
                  <option key={containerType.id} value={containerType.id}>
                    {containerType.code}
                  </option>
                ))}
              </select>
            </label>
            {isContainerTypesError && (
              <p className="mt-2 text-xs text-red-500">Could not load container types.</p>
            )}
            {createError && <p className="mt-2 text-xs text-red-500">{createError}</p>}

            {/* Debug instrumentation (dev-only) */}
            {import.meta.env.DEV && (() => {
              const createAndPlaceDisabledReason = !isActionPending &&
                containerCodeInput.trim().length === 0 &&
                containerTypeIdInput.length === 0 &&
                containerTypes.length === 0
                ? ['missing code', 'missing type', 'no types loaded'].join(' + ')
                : !isActionPending && containerCodeInput.trim().length === 0 ? 'missing code'
                : !isActionPending && containerTypeIdInput.length === 0 ? 'missing type'
                : !isActionPending && containerTypes.length === 0 ? 'no types loaded'
                : isActionPending ? 'action pending'
                : null;

              return (
                <div
                  className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 font-mono text-[10px] text-amber-800"
                >
                  <p className="font-semibold">🔍 DEBUG: Create & Place State</p>
                  <p>code: {containerCodeInput.trim().length > 0 ? '✓' : '✗'} ({containerCodeInput.length})</p>
                  <p>type: {containerTypeIdInput.length > 0 ? '✓' : '✗'}</p>
                  <p>containerTypes: {containerTypes.length} loaded {isContainerTypesPending ? '(loading...)' : ''}</p>
                  <p>createMutation: {createContainer.status} {createContainer.error ? `[ERROR: ${createContainer.error.message}]` : ''}</p>
                  <p>placeMutation: {placeContainer.status} {placeContainer.error ? `[ERROR: ${placeContainer.error.message}]` : ''}</p>
                  <p>isActionPending: {isActionPending ? 'YES' : 'NO'}</p>
                  <p>createAndPlaceDisabledReason: {createAndPlaceDisabledReason || 'none'}</p>
                </div>
              );
            })()}

            <div className="mt-3 flex items-center gap-2">
              {(() => {
                const buttonDisabled = isActionPending ||
                  containerCodeInput.trim().length === 0 ||
                  containerTypeIdInput.length === 0 ||
                  containerTypes.length === 0;
                const disabledReasons = [];
                if (isActionPending) disabledReasons.push('action pending');
                if (containerCodeInput.trim().length === 0) disabledReasons.push('missing code');
                if (containerTypeIdInput.length === 0) disabledReasons.push('missing type');
                if (containerTypes.length === 0) disabledReasons.push('no types loaded');

                return (
                  <>
                    <button
                      type="button"
                      className="rounded-md px-3 py-2 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: 'var(--accent)' }}
                      onClick={() => void handleCreateAndPlace()}
                      disabled={buttonDisabled}
                      title={buttonDisabled ? `Disabled: ${disabledReasons.join(', ')}` : ''}
                    >
                      {createContainer.isPending
                        ? 'Creating...'
                        : placeContainer.isPending
                          ? 'Placing...'
                          : 'Create and place'}
                    </button>
                    {buttonDisabled && import.meta.env.DEV && (
                      <span className="text-[10px] text-amber-600">
                        {disabledReasons.join(', ')}
                      </span>
                    )}
                  </>
                );
              })()}
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-xs font-medium text-[var(--text-muted)]"
                style={{ borderColor: 'var(--border-muted)' }}
                onClick={() => {
                  setActiveAction(null);
                  setCreateError(null);
                }}
                disabled={isActionPending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!cellId && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle className="h-6 w-6 text-slate-300" />
            <p className="text-xs text-slate-400">Select a physical cell to inspect placement.</p>
          </div>
        )}

        {cellId && isPending && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            {import.meta.env.DEV && (
              <div
                className="rounded border border-orange-200 bg-orange-50 p-2 font-mono text-[10px] text-orange-800 max-w-xs text-center"
              >
                <p className="font-semibold">⏳ Loading placement data...</p>
                <p>locationId: {locationId || '(waiting...)'}</p>
                <p>fetching storage: {isPending ? '⏳' : '✓'}</p>
              </div>
            )}
          </div>
        )}

        {cellId && isError && (
          <div
            className="rounded-lg px-3 py-3 text-center"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-red-400" />
            <p className="text-xs text-slate-500">Could not load placement data.</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {bffError?.message ?? 'Check your connection and try again.'}
            </p>
            <div className="mt-2 space-y-0.5 font-mono text-[10px] text-slate-400">
              <p>cellId: {cellId}</p>
              {bffError && <p>status: {bffError.status}</p>}
              {bffError?.code && <p>code: {bffError.code}</p>}
              {bffError?.requestId && <p>requestId: {bffError.requestId}</p>}
              {bffError?.errorId && <p>errorId: {bffError.errorId}</p>}
            </div>
          </div>
        )}

        {cellId && !selectedCell && !isPending && !isError && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-7 w-7 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-600">Cell is unavailable</p>
              <p className="mt-1 text-xs text-slate-400">
                Placement mode requires a published physical cell selection.
              </p>
            </div>
          </div>
        )}

        {selectedCell && !isPending && !isError && containers.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Package className="h-7 w-7 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-600">No containers</p>
              <p className="mt-1 text-xs text-slate-400">This cell is empty.</p>
            </div>
          </div>
        )}

        {selectedCell && !isPending && !isError && containers.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              <Layers className="h-3 w-3" />
              <span>
                {containers.length} container{containers.length !== 1 ? 's' : ''}
              </span>
            </div>
            {containers.map((group) => (
              <ContainerCard
                key={group.containerId}
                group={group}
                onContainerClick={setSelectedContainerId}
                sourceCellId={selectedCell.id}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
