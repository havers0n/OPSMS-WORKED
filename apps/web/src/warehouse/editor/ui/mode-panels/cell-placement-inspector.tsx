import { useEffect } from 'react';
import type { FloorWorkspace } from '@wos/domain';
import { AlertCircle, Loader2, MapPin } from 'lucide-react';
import { BffRequestError } from '@/shared/api/bff/client';
import {
  useEditorSelection,
  useViewMode
} from '@/warehouse/editor/model/editor-selectors';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { CellPlacementOperationalBody } from '../storage-location-detail-body';

export function CellPlacementInspector({ workspace }: { workspace: FloorWorkspace | null }) {
  const selection = useEditorSelection();
  const viewMode = useViewMode();

  const cellId = selection.type === 'cell' ? selection.cellId : null;
  const isReadOnlyView = viewMode === 'view';
  const { data: publishedCells = [] } = usePublishedCells(workspace?.floorId ?? null);
  const selectedCell = publishedCells.find((cell) => cell.id === cellId) ?? null;

  // Debug: locationQuery inputs
  const locationQueryEnabled = Boolean(cellId);
  const locationQueryKey = cellId ? `location-by-cell:${cellId}` : null;
  const { data: locationRef, error: locationQueryError } = useLocationByCell(cellId);

  // Debug: log location query state
  useEffect(() => {
    if (import.meta.env.DEV) {
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
      console.debug('[placement] location query success', locationRef);
    }
    if (import.meta.env.DEV && locationQueryError) {
      console.error('[placement] location query error', locationQueryError);
    }
  }, [locationRef, locationQueryError]);

  const locationId = locationRef?.locationId ?? null;

  const { data = [], error, isPending: isStoragePending, isError } = useLocationStorage(locationId);
  // Spinner should only show while actively loading storage (locationId known, storage fetching).
  // When locationQueryError is set, locationId is null → storage query is disabled → isPending is
  // React Query's initial-pending state, not a real load. Gate on locationId to avoid infinite spinner.
  const isPending = isStoragePending && locationId !== null;

  const bffError = error instanceof BffRequestError ? error : null;
  const locationBffError = locationQueryError instanceof BffRequestError ? locationQueryError : null;

  return (
    <aside className="flex h-full w-full flex-col" style={{ background: 'var(--surface-primary)' }}>
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          {isReadOnlyView ? 'View' : 'Storage'}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            {selectedCell?.address.raw ?? cellId ?? '—'}
          </span>
        </div>
      </div>

      <div
        className={`flex flex-1 flex-col overflow-y-auto px-4 py-4 ${
          !isReadOnlyView ? 'gap-3' : 'gap-3'
        }`}
        data-testid="cell-placement-details-view"
      >
        {selectedCell && locationId && !isPending && !isError && (
          <CellPlacementOperationalBody
            selectedCell={selectedCell}
            locationId={locationId}
            rows={data}
            isReadOnlyView={isReadOnlyView}
          />
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

        {cellId && (isError || !!locationQueryError) && (
          <div
            className="rounded-lg px-3 py-3 text-center"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-red-400" />
            <p className="text-xs text-slate-500">Could not load placement data.</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {locationBffError?.message ?? bffError?.message ?? 'Check your connection and try again.'}
            </p>
            <div className="mt-2 space-y-0.5 font-mono text-[10px] text-slate-400">
              <p>cellId: {cellId}</p>
              {(locationBffError ?? bffError) && <p>status: {(locationBffError ?? bffError)!.status}</p>}
              {(locationBffError?.code ?? bffError?.code) && <p>code: {locationBffError?.code ?? bffError?.code}</p>}
            </div>
          </div>
        )}

        {cellId && !selectedCell && !isPending && !isError && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-7 w-7 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-600">Cell is unavailable</p>
              <p className="mt-1 text-xs text-slate-400">
                {isReadOnlyView
                  ? 'View mode requires a published physical cell selection.'
                  : 'Storage mode requires a published physical cell selection.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
