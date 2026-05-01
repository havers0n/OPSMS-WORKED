import { ChevronRight, LogOut, Menu, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/app/providers/auth-provider';
import {
  useActiveFloorId,
  useActiveSiteId,
  useIsDrawerCollapsed,
  useSetActiveFloorId,
  useSetActiveSiteId,
  useToggleDrawer
} from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import {
  useResetDraft,
  useSetViewMode,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import type { ViewMode } from '@/widgets/warehouse-editor/model/editor-types';
import { useSites } from '@/entities/site/api/use-sites';
import { routes } from '@/shared/config/routes';
import { ViewStageSwitcher } from '@/widgets/warehouse-shell/ui/view-stage-switcher';

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'view', label: 'View' },
  { id: 'storage', label: 'Storage' }
];

type LocateFeedback = {
  kind: 'idle' | 'found' | 'not-found' | 'invalid' | 'error';
  message: string | null;
};

type ViewTopBarProps = {
  onLocateSubmit: (query: string) => void;
  locateFeedback?: LocateFeedback;
  locateDisabled?: boolean;
};

export function ViewTopBar({
  onLocateSubmit,
  locateFeedback = { kind: 'idle', message: null },
  locateDisabled = false
}: ViewTopBarProps) {
  const toggle = useToggleDrawer();
  const isCollapsed = useIsDrawerCollapsed();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [locateQuery, setLocateQuery] = useState('');

  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveSiteId = useSetActiveSiteId();
  const setActiveFloorId = useSetActiveFloorId();
  const resetDraft = useResetDraft();
  const viewMode = useViewMode();
  const setViewMode = useSetViewMode();
  const { data: sites = [] } = useSites();
  const { data: floors = [] } = useFloors(activeSiteId);

  const handleSiteChange = (nextSiteId: string) => {
    if (nextSiteId === activeSiteId) return;
    resetDraft();
    setActiveSiteId(nextSiteId || null);
  };

  const handleFloorChange = (nextFloorId: string) => {
    if (nextFloorId === activeFloorId) return;
    resetDraft();
    setActiveFloorId(nextFloorId || null);
  };

  // Normalize: Layout authoring is not available in the read-only viewer route.
  const activeViewMode = viewMode === 'layout' ? 'view' : viewMode;
  const feedbackColor =
    locateFeedback.kind === 'error'
      ? 'text-red-600'
      : locateFeedback.kind === 'not-found' || locateFeedback.kind === 'invalid'
        ? 'text-amber-600'
        : locateFeedback.kind === 'found'
          ? 'text-emerald-600'
          : 'text-slate-500';

  return (
    <header
      className="flex h-11 shrink-0 items-center justify-between border-b"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-primary)' }}
    >
      {/* ── Left: nav toggle + branding + site/floor ─────────────────── */}
      <div className="flex h-full items-center">
        <div
          className="flex h-full items-center gap-2 border-r px-3"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <button
            type="button"
            onClick={toggle}
            title={isCollapsed ? 'Open navigation' : 'Close navigation'}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-black tracking-widest" style={{ color: 'var(--accent)' }}>
            W
          </span>
          <span className="text-sm font-semibold text-slate-700">Warehouse Ops</span>
        </div>

        <div
          className="flex h-full items-center gap-1 border-r px-3"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <select
            aria-label="Site"
            value={activeSiteId ?? ''}
            onChange={(e) => handleSiteChange(e.target.value)}
            className="h-7 rounded-md border-0 bg-transparent px-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
            style={{ maxWidth: '120px' }}
          >
            <option value="">Site…</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.code}
              </option>
            ))}
          </select>

          <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />

          <select
            aria-label="Floor"
            value={activeFloorId ?? ''}
            onChange={(e) => handleFloorChange(e.target.value)}
            disabled={!activeSiteId}
            className="h-7 rounded-md border-0 bg-transparent px-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400/40 disabled:cursor-not-allowed disabled:text-slate-400"
            style={{ maxWidth: '100px' }}
          >
            <option value="">Floor…</option>
            {floors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Center: read-only View + Storage tabs ─────────────────────── */}
      <div className="flex flex-1 items-center justify-center gap-3 px-4">
        <div
          className="flex items-center gap-0.5 rounded-lg p-0.5"
          style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border-muted)' }}
        >
          {VIEW_MODES.map((mode) => {
            const isActive = activeViewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className="relative rounded-md px-3 py-1 text-xs font-medium transition-all"
                style={
                  isActive
                    ? {
                        background: 'var(--surface-strong)',
                        color: 'var(--accent)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                        cursor: 'default'
                      }
                    : { color: 'var(--text-muted)', cursor: 'pointer' }
                }
              >
                {mode.label}
              </button>
            );
          })}
        </div>
        {activeViewMode === 'view' && <ViewStageSwitcher />}
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onLocateSubmit(locateQuery);
          }}
        >
          <input
            aria-label="Locate cell address"
            placeholder="Locate cell address"
            value={locateQuery}
            onChange={(event) => setLocateQuery(event.target.value)}
            disabled={locateDisabled}
            className="h-7 w-48 rounded-md border px-2 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-blue-400/40 disabled:cursor-not-allowed disabled:text-slate-400"
            style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
          />
          <button
            type="submit"
            disabled={locateDisabled}
            className="flex h-7 items-center rounded-md border px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
          >
            Locate
          </button>
          {locateFeedback.message && (
            <span className={`text-xs ${feedbackColor}`}>{locateFeedback.message}</span>
          )}
        </form>
      </div>

      {/* ── Right: Open Editor + user ─────────────────────────────────── */}
      <div className="flex h-full items-center">
        <div
          className="flex h-full items-center gap-2 border-l px-3"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <button
            type="button"
            onClick={() => navigate(routes.warehouse)}
            className="flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Open Editor
          </button>
        </div>

        <div
          className="flex h-full items-center gap-3 border-l px-3"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <div className="hidden flex-col items-end xl:flex">
            <div className="text-xs text-slate-700">{user?.email ?? ''}</div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-muted)] bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
