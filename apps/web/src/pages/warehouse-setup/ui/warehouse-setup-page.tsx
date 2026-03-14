import { useEffect, useMemo } from 'react';
import type { WarehouseSetupState } from '@wos/domain';
import { useActiveFloorId, useActiveSiteId, useSetActiveSiteId } from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import { useSites } from '@/entities/site/api/use-sites';
import { BootstrapWizard } from '@/widgets/warehouse-bootstrap/ui/bootstrap-wizard';
import { SiteFloorSetupState } from '@/widgets/warehouse-bootstrap/ui/site-floor-setup-state';
import { WarehouseEditor } from '@/widgets/warehouse-editor/ui/warehouse-editor';

export function WarehouseSetupPage() {
  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveSiteId = useSetActiveSiteId();
  const sitesQuery = useSites();
  const floorsQuery = useFloors(activeSiteId);
  const workspaceQuery = useFloorWorkspace(activeFloorId);

  useEffect(() => {
    if (!activeSiteId && sitesQuery.data && sitesQuery.data.length > 0) {
      setActiveSiteId(sitesQuery.data[0].id);
    }
  }, [activeSiteId, setActiveSiteId, sitesQuery.data]);

  const setupState: WarehouseSetupState = useMemo(() => {
    if (sitesQuery.isLoading || (activeSiteId ? floorsQuery.isLoading : false) || (activeFloorId ? workspaceQuery.isLoading : false)) {
      return 'workspace_loading';
    }

    if (sitesQuery.isError || floorsQuery.isError || workspaceQuery.isError) {
      return 'error';
    }

    if (!sitesQuery.data || sitesQuery.data.length === 0) {
      return 'bootstrap_required';
    }

    if (!activeSiteId || !floorsQuery.data || floorsQuery.data.length === 0 || !activeFloorId) {
      return 'floor_selection_required';
    }

    if (workspaceQuery.data?.activeDraft || workspaceQuery.data?.latestPublished) {
      return 'workspace_ready';
    }

    return 'floor_selection_required';
  }, [activeFloorId, activeSiteId, floorsQuery.data, floorsQuery.isError, floorsQuery.isLoading, sitesQuery.data, sitesQuery.isError, sitesQuery.isLoading, workspaceQuery.data, workspaceQuery.isError, workspaceQuery.isLoading]);

  if (setupState === 'workspace_loading') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="w-full max-w-lg rounded-[22px] border border-[var(--border-muted)] bg-[var(--surface-primary)] p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-[var(--accent-soft)]" />
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Warehouse Setup</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Loading warehouse setup...</div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">Resolving current site, floor, and workspace state from the live layout lifecycle.</div>
        </div>
      </div>
    );
  }

  if (setupState === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="w-full max-w-lg rounded-[22px] border border-red-200 bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-red-600">Warehouse Setup</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Failed to load warehouse setup state.</div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">Check local Supabase connectivity and reload the page. The editor will not render until live context is available.</div>
        </div>
      </div>
    );
  }

  if (setupState === 'bootstrap_required') {
    return <BootstrapWizard />;
  }

  if (setupState === 'floor_selection_required') {
    return <SiteFloorSetupState hasDraft={Boolean(workspaceQuery.data?.activeDraft)} />;
  }

  return <WarehouseEditor />;
}
