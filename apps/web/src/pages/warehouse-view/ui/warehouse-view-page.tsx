import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  useActiveFloorId,
  useActiveSiteId,
  useSetActiveFloorId,
  useSetActiveSiteId
} from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import {
  useSetHighlightedCellIds,
  useSetSelectedCellId,
  useSetViewMode,
  useViewMode
} from '@/entities/layout-version/model/editor-selectors';
import { useSites } from '@/entities/site/api/use-sites';
import { pickTaskDetailPath, routes } from '@/shared/config/routes';
import { PublishedViewer } from '@/widgets/warehouse-editor/ui/published-viewer';
import { ViewTopBar } from '@/widgets/warehouse-viewer/ui/view-top-bar';

export function WarehouseViewPage() {
  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveSiteId = useSetActiveSiteId();
  const setActiveFloorId = useSetActiveFloorId();
  const sitesQuery = useSites();
  const floorsQuery = useFloors(activeSiteId);
  const workspaceQuery = useFloorWorkspace(activeFloorId);
  const viewMode = useViewMode();
  const setSelectedCellId = useSetSelectedCellId();
  const setViewMode = useSetViewMode();
  const setHighlightedCellIds = useSetHighlightedCellIds();

  const [searchParams] = useSearchParams();
  const targetFloorId = searchParams.get('floor');
  const targetCellId = searchParams.get('cell');
  const returnTaskId = searchParams.get('returnTaskId');
  const returnTaskNumber = searchParams.get('returnTaskNumber');

  // Auto-select first site if none selected
  useEffect(() => {
    if (!activeSiteId && sitesQuery.data && sitesQuery.data.length > 0) {
      setActiveSiteId(sitesQuery.data[0].id);
    }
  }, [activeSiteId, setActiveSiteId, sitesQuery.data]);

  // Layout authoring is an editor-only mode — switch to safe View on this page.
  useEffect(() => {
    if (viewMode === 'layout') {
      setViewMode('view');
    }
  }, [viewMode, setViewMode]);

  // URL hydration: select target floor when site is ready and floor exists on it.
  // Runs after site auto-select so setActiveSiteId won't clobber it.
  useEffect(() => {
    if (!targetFloorId) return;
    if (!activeSiteId) return;
    if (!floorsQuery.data) return;
    if (activeFloorId === targetFloorId) return;
    const floorExists = floorsQuery.data.some((f) => f.id === targetFloorId);
    if (floorExists) {
      setActiveFloorId(targetFloorId);
    }
    // floor not found on this site → silently fall through to existing behavior
  }, [targetFloorId, activeSiteId, activeFloorId, floorsQuery.data, setActiveFloorId]);

  // URL hydration: select and highlight target cell in View.
  // Guarded on viewMode === 'view' because setViewMode clears selections/highlights.
  useEffect(() => {
    if (!targetCellId) return;
    if (viewMode !== 'view') return;
    setSelectedCellId(targetCellId);
    setHighlightedCellIds([targetCellId]);
  }, [targetCellId, viewMode, setHighlightedCellIds, setSelectedCellId]);

  const isLoading =
    sitesQuery.isLoading ||
    (activeSiteId ? floorsQuery.isLoading : false) ||
    (activeFloorId ? workspaceQuery.isLoading : false);

  const isError = sitesQuery.isError || floorsQuery.isError || workspaceQuery.isError;
  const hasViewableLayout = Boolean(
    workspaceQuery.data?.latestPublished ?? workspaceQuery.data?.activeDraft
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <ViewTopBar />
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
        <ViewTopBar />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-red-500">Failed to load warehouse data.</p>
        </div>
      </div>
    );
  }

  if (activeFloorId && !hasViewableLayout) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <ViewTopBar />
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
      <ViewTopBar />
      {returnTaskId && returnTaskNumber && (
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
