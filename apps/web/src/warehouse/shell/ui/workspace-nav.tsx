import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  useActiveFloorId,
  useActiveSiteId,
  useSetActiveFloorId,
  useSetActiveSiteId
} from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import { useSites } from '@/entities/site/api/use-sites';
import { Divider } from '@/shared/ui/divider';
import {
  useIsWarehouseDraftDirty,
  useResetWarehouseDraft,
  useWarehouseLayoutDraft
} from '@/warehouse/state/layout-draft';
import { shouldProceedWithContextSwitch } from '../lib/layout-context';

type WorkspaceNavProps = {
  statusBadge: ReactNode;
  onContextSwitched?: () => void;
};

export function WorkspaceNav({ statusBadge, onContextSwitched }: WorkspaceNavProps) {
  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveSiteId = useSetActiveSiteId();
  const setActiveFloorId = useSetActiveFloorId();
  const resetDraft = useResetWarehouseDraft();
  const isDraftDirty = useIsWarehouseDraftDirty();
  const layoutDraft = useWarehouseLayoutDraft();

  const { data: sites = [] } = useSites();
  const { data: floors = [] } = useFloors(activeSiteId);
  const workspaceQuery = useFloorWorkspace(activeFloorId);
  const latestPublished = workspaceQuery.data?.latestPublished ?? null;

  const activeSite = sites.find((site) => site.id === activeSiteId);
  const activeFloor = floors.find((floor) => floor.id === activeFloorId);

  const handleSiteChange = (nextSiteId: string) => {
    if (nextSiteId === activeSiteId) return;
    if (!shouldProceedWithContextSwitch(isDraftDirty, () => window.confirm('Unsaved changes. Discard?')))
      return;
    resetDraft();
    setActiveSiteId(nextSiteId || null);
    onContextSwitched?.();
  };

  const handleFloorChange = (nextFloorId: string) => {
    if (nextFloorId === activeFloorId) return;
    if (!shouldProceedWithContextSwitch(isDraftDirty, () => window.confirm('Unsaved changes. Discard?')))
      return;
    resetDraft();
    setActiveFloorId(nextFloorId || null);
    onContextSwitched?.();
  };

  return (
    <div className="flex h-full min-w-0 items-center gap-2">
      <label className="group relative flex h-8 min-w-0 items-center rounded-md px-2 transition-colors hover:bg-slate-100">
        <span className="sr-only">Site</span>
        <select
          aria-label="Site"
          value={activeSiteId ?? ''}
          onChange={(event) => handleSiteChange(event.target.value)}
          className="h-8 max-w-40 appearance-none truncate border-0 bg-transparent pr-5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-0"
        >
          <option value="">Site...</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.code}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
      </label>

      <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />

      <label className="group relative flex h-8 min-w-0 items-center rounded-md px-2 transition-colors hover:bg-slate-100">
        <span className="sr-only">Floor</span>
        <select
          aria-label="Floor"
          value={activeFloorId ?? ''}
          onChange={(event) => handleFloorChange(event.target.value)}
          disabled={!activeSiteId}
          className="h-8 max-w-28 appearance-none truncate border-0 bg-transparent pr-5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <option value="">Floor...</option>
          {floors.map((floor) => (
            <option key={floor.id} value={floor.id}>
              {floor.code}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
      </label>

      {activeSite && activeFloor && (
        <>
          {(layoutDraft?.versionNo ?? latestPublished?.versionNo) && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
              v{layoutDraft?.versionNo ?? latestPublished?.versionNo}
            </span>
          )}

          <Divider orientation="vertical" className="mx-1 h-4 bg-slate-200" />
          {statusBadge}
        </>
      )}
    </div>
  );
}
