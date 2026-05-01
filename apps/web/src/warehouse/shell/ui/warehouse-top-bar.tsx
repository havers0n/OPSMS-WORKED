import { Menu } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useActiveFloorId, useIsDrawerCollapsed, useToggleDrawer } from '@/app/store/ui-selectors';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import { useLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { routes } from '@/shared/config/routes';
import { IconButton } from '@/shared/ui/icon-button';
import { TopBarShell } from '@/shared/ui/top-bar-shell';
import {
  useDraftDirtyState,
  useDraftPersistenceStatus,
  useLayoutDraftState,
  useSetHighlightedCellIds,
  useSetSelectedCellId,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { useStorageFocusStore } from '@/widgets/warehouse-editor/model/v2/storage-focus-store';
import { AccountControls } from '@/widgets/app-shell/ui/account-controls';
import { ViewModeSwitcher } from './view-mode-switcher';
import { WorkspaceActions } from './workspace-actions';
import { WorkspaceNav } from './workspace-nav';
import { WorkspaceStatus } from './workspace-status';

type LocateFeedback = {
  kind: 'idle' | 'found' | 'not-found' | 'invalid' | 'error';
  message: string | null;
};

function normalizeLocateToken(value: string): string {
  return value.trim().toUpperCase().replace(/[\s\-_./:]+/g, '');
}

function WarehouseViewLocateInline() {
  const [locateQuery, setLocateQuery] = useState('');
  const [locateFeedback, setLocateFeedback] = useState<LocateFeedback>({
    kind: 'idle',
    message: null
  });
  const activeFloorId = useActiveFloorId();
  const viewMode = useViewMode();
  const setSelectedCellId = useSetSelectedCellId();
  const setHighlightedCellIds = useSetHighlightedCellIds();
  const publishedCellsQuery = usePublishedCells(activeFloorId);
  const publishedCells = publishedCellsQuery.data ?? [];
  const feedbackColor =
    locateFeedback.kind === 'error'
      ? 'text-red-600'
      : locateFeedback.kind === 'not-found' || locateFeedback.kind === 'invalid'
        ? 'text-amber-600'
        : locateFeedback.kind === 'found'
          ? 'text-emerald-600'
          : 'text-slate-500';

  const locateDataGapReason = useMemo(() => {
    if (!activeFloorId) return 'Select a floor to use locate.';
    if (publishedCellsQuery.isError) return 'Locate is unavailable: failed to load published cells.';
    if (publishedCells.length === 0) return 'Locate is unavailable: no published cells found for this floor.';

    const byNormalizedAddress = new Map<string, string>();
    for (const cell of publishedCells) {
      const rawAddress = cell.address?.raw;
      if (typeof rawAddress !== 'string' || rawAddress.trim() === '') {
        return 'Locate is unavailable: some published cells are missing stable address.raw.';
      }
      const normalizedAddress = normalizeLocateToken(rawAddress);
      if (!normalizedAddress) {
        return 'Locate is unavailable: some published cells have invalid address.raw.';
      }
      const existingCellId = byNormalizedAddress.get(normalizedAddress);
      if (existingCellId && existingCellId !== cell.id) {
        return 'Locate is unavailable: duplicate normalized address.raw detected.';
      }
      byNormalizedAddress.set(normalizedAddress, cell.id);
    }

    return null;
  }, [activeFloorId, publishedCellsQuery.isError, publishedCells]);

  const locateLookupByAddress = useMemo(() => {
    if (locateDataGapReason) return new Map<string, string>();
    const lookup = new Map<string, string>();
    for (const cell of publishedCells) {
      lookup.set(normalizeLocateToken(cell.address.raw), cell.id);
    }
    return lookup;
  }, [locateDataGapReason, publishedCells]);

  useEffect(() => {
    if (publishedCellsQuery.isLoading) return;
    setLocateFeedback((prev) => {
      if (locateDataGapReason) {
        if (prev.kind === 'error' && prev.message === locateDataGapReason) return prev;
        return { kind: 'error', message: locateDataGapReason };
      }
      if (prev.kind === 'error') {
        return { kind: 'idle', message: null };
      }
      return prev;
    });
  }, [locateDataGapReason, publishedCellsQuery.isLoading]);

  const handleLocateSubmit = () => {
    if (locateDataGapReason) {
      setLocateFeedback({
        kind: 'error',
        message: locateDataGapReason
      });
      return;
    }

    const normalizedQuery = normalizeLocateToken(locateQuery);
    if (!normalizedQuery) {
      setLocateFeedback({
        kind: 'invalid',
        message: 'Enter a cell address.'
      });
      return;
    }

    const matchedCellId = locateLookupByAddress.get(normalizedQuery);
    if (!matchedCellId) {
      setLocateFeedback({
        kind: 'not-found',
        message: `Cell "${locateQuery.trim()}" not found.`
      });
      return;
    }

    const matchedCell = publishedCells.find((cell) => cell.id === matchedCellId);
    setSelectedCellId(matchedCellId);
    setHighlightedCellIds([matchedCellId]);
    if (viewMode === 'storage' && matchedCell) {
      useStorageFocusStore.getState().selectCell({
        cellId: matchedCell.id,
        rackId: matchedCell.rackId,
        level: matchedCell.address.parts.level
      });
    }
    setLocateFeedback({
      kind: 'found',
      message: `Located ${locateQuery.trim()}.`
    });
  };

  return (
    <form
      className="flex h-8 items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        handleLocateSubmit();
      }}
    >
      <input
        aria-label="Locate cell address"
        placeholder="Locate cell address"
        value={locateQuery}
        onChange={(event) => setLocateQuery(event.target.value)}
        disabled={publishedCellsQuery.isLoading}
        className="h-6 w-[260px] rounded-full border-0 bg-transparent px-3 text-sm text-slate-700 outline-none placeholder:text-slate-500 focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400"
      />
      <button
        type="submit"
        disabled={publishedCellsQuery.isLoading}
        className="flex h-6 items-center rounded-full border px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-white/40 disabled:cursor-not-allowed disabled:text-slate-400"
        style={{
          borderColor: 'rgba(37, 99, 235, 0.45)',
          background: 'color-mix(in srgb, var(--surface-primary) 55%, transparent)'
        }}
      >
        Locate
      </button>
      {locateFeedback.message && (
        <span className={`text-xs ${feedbackColor}`}>{locateFeedback.message}</span>
      )}
    </form>
  );
}

export function WarehouseTopBar() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const toggle = useToggleDrawer();
  const isCollapsed = useIsDrawerCollapsed();
  const pathname = typeof window === 'undefined' ? '' : window.location.pathname;
  const isWarehouseViewRoute = pathname.includes(routes.warehouseView);

  const activeFloorId = useActiveFloorId();
  const viewMode = useViewMode();
  const shouldShowLocateInline =
    isWarehouseViewRoute ||
    (pathname.startsWith(routes.warehouse) && viewMode !== 'layout');
  const layoutDraft = useLayoutDraftState();
  const isDraftDirty = useDraftDirtyState();
  const persistenceStatus = useDraftPersistenceStatus();
  const workspaceQuery = useFloorWorkspace(activeFloorId);
  const latestPublished = workspaceQuery.data?.latestPublished ?? null;
  const persistedDraftValidation = useLayoutValidation(layoutDraft?.layoutVersionId ?? null).cachedResult;

  const hasDraftLayout = layoutDraft?.state === 'draft';

  const issueSummary = useMemo(() => {
    // Published state is already communicated by the breadcrumb badge and
    // the PublishedBanner below the TopBar — no need to repeat it here.
    if (!layoutDraft && latestPublished) return null;
    if (layoutDraft?.state === 'published') return null;
    if (isDraftDirty) return 'Draft changed';
    if (!persistedDraftValidation) return null;
    return persistedDraftValidation.isValid
      ? 'Valid'
      : `${persistedDraftValidation.issues.length} issue(s)`;
  }, [isDraftDirty, latestPublished, layoutDraft, persistedDraftValidation]);

  // Clear any explicit action feedback the moment the draft becomes dirty so that
  // ambient state labels (e.g. "Draft changed") are never hidden by a stale message.
  useEffect(() => {
    if (isDraftDirty) setStatusMessage(null);
  }, [isDraftDirty]);

  // Explicit action feedback (statusMessage) takes priority over computed ambient
  // state (issueSummary) so that targeted messages like a specific validation error
  // are not overridden by the generic issue count derived from the cached result.
  const inlineStatusMessage = statusMessage ?? issueSummary;

  const workspaceStateLabel = !hasDraftLayout
    ? 'Published'
    : viewMode !== 'layout'
      ? 'Read-only'
      : persistenceStatus === 'dirty'
        ? 'Unsaved'
        : persistenceStatus === 'saving'
          ? 'Saving...'
          : persistenceStatus === 'conflict'
            ? 'Conflict'
            : persistenceStatus === 'error'
              ? 'Save failed'
              : 'Saved';

  const isCurrentModeLocked = viewMode !== 'layout' || !hasDraftLayout;
  const workspaceStateStyle = isCurrentModeLocked
    ? { background: 'rgba(37,99,235,0.12)', color: '#1d4ed8' }
    : persistenceStatus === 'dirty'
      ? { background: 'rgba(183,121,31,0.12)', color: 'var(--warning)' }
      : persistenceStatus === 'saving'
        ? { background: 'rgba(37,99,235,0.12)', color: '#1d4ed8' }
        : persistenceStatus === 'conflict' || persistenceStatus === 'error'
          ? { background: 'rgba(220,38,38,0.12)', color: '#b91c1c' }
          : { background: 'rgba(20,125,100,0.1)', color: 'var(--success)' };

  const workspaceTooltip = !hasDraftLayout
    ? 'Structure locked · switch to Layout and create a draft to edit'
    : viewMode !== 'layout'
      ? 'Read-only in View/Storage · switch to Layout to edit structure'
      : null;

  return (
    <div className="relative shrink-0">
      <TopBarShell
        className="[&>div]:h-11"
        style={{
          background: 'var(--surface-primary)'
        }}
        left={
          <div className="flex h-full items-center">
            <div
              className="flex h-full items-center gap-2 border-r px-3"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              <IconButton
                icon={<Menu className="h-4 w-4" />}
                onClick={toggle}
                title={isCollapsed ? 'Open navigation' : 'Close navigation'}
                className="rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              />
              <span className="text-[11px] font-black tracking-widest" style={{ color: 'var(--accent)' }}>
                W
              </span>
              <span className="text-sm font-semibold text-slate-700">Warehouse Ops</span>
            </div>

            <WorkspaceNav
              onContextSwitched={() => setStatusMessage(null)}
              statusBadge={
                <WorkspaceStatus
                  variant="badge"
                  label={workspaceStateLabel}
                  isCurrentModeLocked={isCurrentModeLocked}
                  style={workspaceStateStyle}
                  tooltip={workspaceTooltip}
                />
              }
            />
          </div>
        }
        center={<ViewModeSwitcher />}
        right={
          <div className="flex h-full items-center">
            <div
              className="flex h-full items-center gap-1 border-l px-3"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              <WorkspaceStatus variant="inline" message={inlineStatusMessage} />
              <WorkspaceActions onStatusMessageChange={setStatusMessage} />
            </div>

            <AccountControls />
          </div>
        }
      />
      {shouldShowLocateInline && (
        <div className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 pt-2">
          <div
            className="pointer-events-auto rounded-full border px-3 py-1.5 shadow-[0_2px_10px_rgba(15,23,42,0.08)] backdrop-blur-sm"
            style={{
              borderColor: 'rgba(37, 99, 235, 0.85)',
              background: 'color-mix(in srgb, #d1d5db 72%, transparent)'
            }}
          >
            <WarehouseViewLocateInline />
          </div>
        </div>
      )}
    </div>
  );
}
