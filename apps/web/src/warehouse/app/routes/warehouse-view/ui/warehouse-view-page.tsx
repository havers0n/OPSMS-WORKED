import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Floor } from '@wos/domain';
import { useQueries } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  useActiveFloorId,
  useActiveSiteId,
  useSetActiveFloorId,
  useSetActiveSiteId
} from '@/app/store/ui-selectors';
import { floorsQueryOptions } from '@/entities/floor/api/queries';
import { useFloors } from '@/entities/floor/api/use-floors';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import {
  useSetWarehouseHighlightedCells,
  useSetWarehouseSelectedCellId
} from '@/warehouse/state/interaction';
import {
  useSetWarehouseViewMode,
  useWarehouseViewMode
} from '@/warehouse/state/view-mode';
import { warehouseStorageFocusActions } from '@/warehouse/state/storage-focus';
import { useSites } from '@/entities/site/api/use-sites';
import { pickTaskDetailPath, routes } from '@/shared/config/routes';
import { PublishedViewer } from '@/widgets/warehouse-editor/ui/published-viewer';
import { ViewTopBar } from '@/warehouse/viewer/ui/view-top-bar';
import {
  getFloorDeepLinkAction,
  resolveFloorDeepLink
} from './floor-deep-link-resolution';

type LocateFeedback = {
  kind: 'idle' | 'found' | 'not-found' | 'invalid' | 'error';
  message: string | null;
};

function normalizeLocateToken(value: string): string {
  return value.trim().toUpperCase().replace(/[\s\-_./:]+/g, '');
}

export function WarehouseViewPage() {
  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveSiteId = useSetActiveSiteId();
  const setActiveFloorId = useSetActiveFloorId();
  const sitesQuery = useSites();
  const floorsQuery = useFloors(activeSiteId);
  const workspaceQuery = useFloorWorkspace(activeFloorId);
  const viewMode = useWarehouseViewMode();
  const setSelectedCellId = useSetWarehouseSelectedCellId();
  const setViewMode = useSetWarehouseViewMode();
  const setHighlightedCellIds = useSetWarehouseHighlightedCells();
  const [locateFeedback, setLocateFeedback] = useState<LocateFeedback>({
    kind: 'idle',
    message: null
  });
  const publishedCellsQuery = usePublishedCells(activeFloorId);
  const publishedCells = publishedCellsQuery.data ?? [];

  const [searchParams] = useSearchParams();
  const targetFloorId = searchParams.get('floor');
  const targetCellId = searchParams.get('cell');
  const returnTaskId = searchParams.get('returnTaskId')?.trim() ?? '';
  const returnTaskNumber = searchParams.get('returnTaskNumber')?.trim() ?? '';
  const shouldShowReturnTaskBar = returnTaskId.length > 0 && returnTaskNumber.length > 0;
  const sites = sitesQuery.data ?? [];
  const allSiteFloorQueries = useQueries({
    queries: targetFloorId && sitesQuery.data ? sites.map((site) => floorsQueryOptions(site.id)) : []
  });
  const floorDeepLinkResolution = useMemo(() => {
    const floorListsBySiteId = new Map<string, Floor[]>();
    const pendingSiteFloorQueries = new Set<string>();

    allSiteFloorQueries.forEach((query, index) => {
      const siteId = sites[index]?.id;
      if (!siteId) return;

      if (query.data) {
        floorListsBySiteId.set(siteId, query.data);
      }
      if (query.isFetching) {
        pendingSiteFloorQueries.add(siteId);
      }
    });

    return resolveFloorDeepLink({
      targetFloorId,
      sites,
      floorListsBySiteId,
      isSitesLoading: sitesQuery.isLoading,
      pendingSiteFloorQueries
    });
  }, [allSiteFloorQueries, sites, sitesQuery.isLoading, targetFloorId]);
  const floorDeepLinkAction = useMemo(
    () =>
      getFloorDeepLinkAction({
        resolution: floorDeepLinkResolution,
        activeSiteId,
        activeFloorId
      }),
    [activeFloorId, activeSiteId, floorDeepLinkResolution]
  );
  const floorDeepLinkActionSiteId =
    floorDeepLinkAction.type === 'select-site' ? floorDeepLinkAction.siteId : null;
  const floorDeepLinkActionFloorId =
    floorDeepLinkAction.type === 'select-floor' ? floorDeepLinkAction.floorId : null;

  // Auto-select first site if none selected
  useEffect(() => {
    if (targetFloorId && floorDeepLinkResolution.status !== 'not-found') return;
    if (!activeSiteId && sitesQuery.data && sitesQuery.data.length > 0) {
      setActiveSiteId(sitesQuery.data[0].id);
    }
  }, [
    activeSiteId,
    floorDeepLinkResolution.status,
    setActiveSiteId,
    sitesQuery.data,
    targetFloorId
  ]);

  // Layout authoring is an editor-only mode — switch to safe View on this page.
  useEffect(() => {
    if (viewMode === 'layout') {
      setViewMode('view');
    }
  }, [viewMode, setViewMode]);

  // URL hydration: resolve the target floor across all sites, then switch site before floor.
  useEffect(() => {
    if (floorDeepLinkActionSiteId) {
      setActiveSiteId(floorDeepLinkActionSiteId);
      return;
    }

    if (floorDeepLinkActionFloorId) {
      setActiveFloorId(floorDeepLinkActionFloorId);
    }
  }, [
    floorDeepLinkActionFloorId,
    floorDeepLinkActionSiteId,
    setActiveFloorId,
    setActiveSiteId
  ]);

  // URL hydration: select and highlight target cell in View.
  // Guarded on viewMode === 'view' because setViewMode clears selections/highlights.
  useEffect(() => {
    if (!targetCellId) return;
    if (viewMode !== 'view') return;
    setSelectedCellId(targetCellId);
    setHighlightedCellIds([targetCellId]);
  }, [targetCellId, viewMode, setHighlightedCellIds, setSelectedCellId]);

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

  const handleLocateSubmit = useCallback((query: string) => {
    if (locateDataGapReason) {
      setLocateFeedback({
        kind: 'error',
        message: locateDataGapReason
      });
      return;
    }

    const normalizedQuery = normalizeLocateToken(query);
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
        message: `Cell "${query.trim()}" not found.`
      });
      return;
    }

    const matchedCell = publishedCells.find((cell) => cell.id === matchedCellId);
    setSelectedCellId(matchedCellId);
    setHighlightedCellIds([matchedCellId]);
    if (viewMode === 'storage' && matchedCell) {
      warehouseStorageFocusActions.selectCell({
        cellId: matchedCell.id,
        rackId: matchedCell.rackId,
        level: matchedCell.address.parts.level
      });
    }
    setLocateFeedback({
      kind: 'found',
      message: `Located ${query.trim()}.`
    });
  }, [
    locateDataGapReason,
    locateLookupByAddress,
    publishedCells,
    setHighlightedCellIds,
    setSelectedCellId,
    viewMode
  ]);

  const isLoading =
    sitesQuery.isLoading ||
    floorDeepLinkResolution.status === 'resolving' ||
    floorDeepLinkAction.type !== 'none' ||
    (activeSiteId ? floorsQuery.isLoading : false) ||
    (activeFloorId ? workspaceQuery.isLoading : false);

  const isError = sitesQuery.isError || floorsQuery.isError || workspaceQuery.isError;
  const hasViewableLayout = Boolean(
    workspaceQuery.data?.latestPublished ?? workspaceQuery.data?.activeDraft
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <ViewTopBar
          onLocateSubmit={handleLocateSubmit}
          locateFeedback={locateFeedback}
          locateDisabled
        />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading warehouse…
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <ViewTopBar
          onLocateSubmit={handleLocateSubmit}
          locateFeedback={locateFeedback}
          locateDisabled
        />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-red-500">Failed to load warehouse data.</p>
        </div>
      </div>
    );
  }

  if (activeFloorId && !hasViewableLayout) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <ViewTopBar
          onLocateSubmit={handleLocateSubmit}
          locateFeedback={locateFeedback}
          locateDisabled
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No warehouse layout is available for this floor.
            </p>
            <Link
              to={routes.warehouse}
              className="mt-2 block text-xs hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              Open the editor to create and publish one
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <ViewTopBar
        onLocateSubmit={handleLocateSubmit}
        locateFeedback={locateFeedback}
        locateDisabled={publishedCellsQuery.isLoading}
      />
      {shouldShowReturnTaskBar && (
        <div
          className="flex shrink-0 items-center gap-2 border-b px-4 py-2"
          style={{
            borderColor: 'var(--border-muted)',
            background: 'var(--surface-subtle)'
          }}
        >
          <Link
            to={pickTaskDetailPath(returnTaskId)}
            className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Task {returnTaskNumber}
          </Link>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <PublishedViewer />
      </div>
    </div>
  );
}
