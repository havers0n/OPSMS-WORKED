import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useActiveFloorId, useActiveSiteId, useSetActiveSiteId } from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import {
  useSetViewMode,
  useViewMode
} from '@/entities/layout-version/model/editor-selectors';
import { useSites } from '@/entities/site/api/use-sites';
import { routes } from '@/shared/config/routes';
import { PublishedViewer } from '@/widgets/warehouse-editor/ui/published-viewer';
import { ViewTopBar } from '@/widgets/warehouse-viewer/ui/view-top-bar';

export function WarehouseViewPage() {
  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveSiteId = useSetActiveSiteId();
  const sitesQuery = useSites();
  const floorsQuery = useFloors(activeSiteId);
  const workspaceQuery = useFloorWorkspace(activeFloorId);
  const viewMode = useViewMode();
  const setViewMode = useSetViewMode();

  // Auto-select first site if none selected
  useEffect(() => {
    if (!activeSiteId && sitesQuery.data && sitesQuery.data.length > 0) {
      setActiveSiteId(sitesQuery.data[0].id);
    }
  }, [activeSiteId, setActiveSiteId, sitesQuery.data]);

  // Layout mode is an edit-only mode — switch to operations on this page
  useEffect(() => {
    if (viewMode === 'layout') {
      setViewMode('operations');
    }
  }, [viewMode, setViewMode]);

  const isLoading =
    sitesQuery.isLoading ||
    (activeSiteId ? floorsQuery.isLoading : false) ||
    (activeFloorId ? workspaceQuery.isLoading : false);

  const isError = sitesQuery.isError || floorsQuery.isError || workspaceQuery.isError;
  const hasPublished = Boolean(workspaceQuery.data?.latestPublished);

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

  if (activeFloorId && !hasPublished) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <ViewTopBar />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No published layout for this floor.
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
      <div className="flex-1 overflow-hidden">
        <PublishedViewer />
      </div>
    </div>
  );
}
