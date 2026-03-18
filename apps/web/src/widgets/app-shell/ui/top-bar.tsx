import {
  CheckCircle2,
  ChevronRight,
  FilePlus2,
  Lock,
  LogOut,
  Menu,
  Redo2,
  Save,
  SearchCheck,
  Undo2
} from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { useMemo, useState } from 'react';
import {
  useActiveFloorId,
  useActiveSiteId,
  useIsDrawerCollapsed,
  useSetActiveFloorId,
  useSetActiveSiteId,
  useToggleDrawer
} from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import {
  useDraftDirtyState,
  useIsLayoutEditable,
  useLayoutDraftState,
  useResetDraft,
  useSetViewMode,
  useViewMode
} from '@/entities/layout-version/model/editor-selectors';
import type { ViewMode } from '@/entities/layout-version/model/editor-types';
import { useSites } from '@/entities/site/api/use-sites';
import { useCreateLayoutDraft } from '@/features/layout-draft-save/model/use-create-layout-draft';
import { useSaveLayoutDraft } from '@/features/layout-draft-save/model/use-save-layout-draft';
import { usePublishLayout } from '@/features/layout-publish/model/use-publish-layout';
import { useLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { BffRequestError } from '@/shared/api/bff/client';
import { getLayoutActionState, shouldProceedWithContextSwitch } from '../lib/layout-context';

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'placement', label: 'Storage' }
];

export function TopBar() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const toggle = useToggleDrawer();
  const isCollapsed = useIsDrawerCollapsed();
  const { user, memberships, currentTenantId, signOut } = useAuth();
  const currentMembership =
    memberships.find((m) => m.tenantId === currentTenantId) ?? memberships[0] ?? null;

  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveSiteId = useSetActiveSiteId();
  const setActiveFloorId = useSetActiveFloorId();
  const resetDraft = useResetDraft();
  const viewMode = useViewMode();
  const setViewMode = useSetViewMode();
  const { data: sites = [] } = useSites();
  const { data: floors = [] } = useFloors(activeSiteId);
  const workspaceQuery = useFloorWorkspace(activeFloorId);
  const workspace = workspaceQuery.data;
  const latestPublished = workspace?.latestPublished ?? null;
  const layoutDraft = useLayoutDraftState();
  const isLayoutEditable = useIsLayoutEditable();
  const isDraftDirty = useDraftDirtyState();
  const createDraft = useCreateLayoutDraft(activeFloorId);
  const saveDraft = useSaveLayoutDraft(activeFloorId);
  const validateLayout = useLayoutValidation(layoutDraft?.layoutVersionId ?? null);
  const publishLayout = usePublishLayout(activeFloorId);

  const actions = getLayoutActionState({
    activeFloorId,
    workspaceIsLoading: workspaceQuery.isLoading,
    workspaceIsError: workspaceQuery.isError,
    workspace,
    localDraft: layoutDraft,
    isDraftDirty
  });

  // True when viewing a published layout with no active draft — the editor is
  // in read-only mode and the primary action is to create a new draft.
  const isPublishedMode = actions.canCreateDraft && latestPublished !== null;
  const isBusy =
    createDraft.isPending ||
    saveDraft.isPending ||
    validateLayout.isPending ||
    publishLayout.isPending;

  const issueSummary = useMemo(() => {
    // Published state is already communicated by the breadcrumb badge and
    // the PublishedBanner below the TopBar — no need to repeat it here.
    if (!layoutDraft && latestPublished) return null;
    if (layoutDraft?.state === 'published') return null;
    if (isDraftDirty && validateLayout.cachedResult) return 'Draft changed';
    if (!validateLayout.cachedResult) return null;
    return validateLayout.cachedResult.isValid
      ? 'Valid'
      : `${validateLayout.cachedResult.issues.length} issue(s)`;
  }, [isDraftDirty, latestPublished, layoutDraft, validateLayout.cachedResult]);

  const handleCreateDraft = async () => {
    if (!activeFloorId) return;
    try {
      await createDraft.mutateAsync(activeFloorId);
      setStatusMessage('Draft ready');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed');
    }
  };

  const handleSaveDraft = async () => {
    if (!layoutDraft || layoutDraft.state !== 'draft' || !activeFloorId) return;
    try {
      await saveDraft.mutateAsync(layoutDraft);
      setStatusMessage('Saved');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Save failed');
    }
  };

  const handleValidate = async () => {
    if (!layoutDraft || layoutDraft.state !== 'draft' || !activeFloorId) return;
    try {
      const result = await validateLayout.mutateAsync(layoutDraft.layoutVersionId);
      setStatusMessage(result.isValid ? 'Valid' : `${result.issues.length} issue(s)`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Validation failed');
    }
  };

  const handlePublish = async () => {
    if (!layoutDraft || layoutDraft.state !== 'draft' || !activeFloorId) return;
    try {
      // Always persist unsaved edits before publishing.
      // publishLayoutVersion reads rack positions from DB; if the user moved
      // racks after the last save the DB state lags behind Zustand, causing the
      // new draft (created from published) to roll back to pre-move positions.
      if (isDraftDirty) {
        await saveDraft.mutateAsync(layoutDraft);
      }
      const result = await publishLayout.mutateAsync(layoutDraft.layoutVersionId);
      setStatusMessage(`Published · ${result.generatedCells} cells · new draft ready`);
    } catch (error) {
      if (error instanceof BffRequestError && error.message.includes('failed validation')) {
        try {
          const validation = await validateLayout.mutateAsync(layoutDraft.layoutVersionId);
          const firstError =
            validation.issues.find((issue) => issue.severity === 'error') ?? validation.issues[0];
          setStatusMessage(firstError ? firstError.message : `${validation.issues.length} issue(s)`);
          return;
        } catch {
          // Fall through to the original publish error if validation lookup fails.
        }
      }
      setStatusMessage(error instanceof Error ? error.message : 'Publish failed');
    }
  };

  const handleSiteChange = (nextSiteId: string) => {
    if (nextSiteId === activeSiteId) return;
    if (!shouldProceedWithContextSwitch(isDraftDirty, () => window.confirm('Unsaved changes. Discard?')))
      return;
    resetDraft();
    setActiveSiteId(nextSiteId || null);
    setStatusMessage(null);
  };

  const handleFloorChange = (nextFloorId: string) => {
    if (nextFloorId === activeFloorId) return;
    if (!shouldProceedWithContextSwitch(isDraftDirty, () => window.confirm('Unsaved changes. Discard?')))
      return;
    resetDraft();
    setActiveFloorId(nextFloorId || null);
    setStatusMessage(null);
  };

  const activeSite = sites.find((s) => s.id === activeSiteId);
  const activeFloor = floors.find((f) => f.id === activeFloorId);

  return (
    <header
      className="flex h-11 shrink-0 items-center justify-between border-b"
      style={{
        borderColor: 'var(--border-strong)',
        background: 'var(--surface-primary)'
      }}
    >
      <div className="flex h-full items-center">
        {/* ── Block 1: Global Nav ───────────────────────── */}
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

        {/* ── Block 2: Context: Site / Floor / Version ───────────────────────── */}
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

        {activeSite && activeFloor && (
          <>
            {(layoutDraft?.versionNo ?? latestPublished?.versionNo) && (
              <span className="ml-1 text-xs font-semibold text-slate-500">
                v{layoutDraft?.versionNo ?? latestPublished?.versionNo}
              </span>
            )}
            
            <div className="mx-2 h-4 w-px bg-slate-200" />
            
            {/* ── Block 3: Status ───────────────────────── */}
            <span
              className="group relative flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium cursor-help"
              style={
                isDraftDirty
                  ? { background: 'rgba(183,121,31,0.12)', color: 'var(--warning)' }
                  : !isLayoutEditable
                    ? { background: 'rgba(37,99,235,0.12)', color: '#1d4ed8' }
                    : { background: 'rgba(20,125,100,0.1)', color: 'var(--success)' }
              }
            >
              {!isLayoutEditable ? <Lock className="h-3 w-3" /> : null}
              {isDraftDirty ? 'Unsaved' : !isLayoutEditable ? 'Published' : 'Synced'}
              
              {!isLayoutEditable && (
                <div className="absolute left-1/2 top-full z-50 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block">
                  Structure locked • Placement available
                </div>
              )}
            </span>
          </>
        )}
      </div>
    </div>

      {/* ── Block 5: Mode switcher — center ─────────────────────────── */}
      {/* Always shown — in published mode Layout tab is read-only, Storage tab
          opens placement view. The PublishedBanner below communicates the
          lock status so we don't duplicate it here. */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div
          className="flex items-center gap-0.5 rounded-lg p-0.5"
          style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border-muted)' }}
        >
          {VIEW_MODES.map((mode) => {
            const isActive = viewMode === mode.id;
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
      </div>

      {/* ── Block 4: Actions & Block 6: User Settings ────────────────────────── */}
      <div className="flex h-full items-center">
        <div
          className="flex h-full items-center gap-1 border-l px-3"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          {/* Status message — visible in both modes */}
          {(statusMessage || issueSummary) && (
            <span
              className="mr-2 text-[11px]"
              style={{ color: 'var(--text-muted)' }}
              aria-live="polite"
            >
            {statusMessage ?? issueSummary}
          </span>
        )}

        {isPublishedMode ? (
          /* Published mode: Create Draft action */
          <button
            type="button"
            disabled={isBusy}
            onClick={handleCreateDraft}
            className="flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            {createDraft.isPending ? 'Creating…' : 'Create Draft'}
          </button>
        ) : (
          /* Draft mode: full toolbar */
          <>
            {/* Undo / Redo */}
            <button
              type="button"
              disabled
              title="Undo (coming soon)"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 disabled:cursor-not-allowed"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled
              title="Redo (coming soon)"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 disabled:cursor-not-allowed"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>

            <div className="mx-1 h-4 w-px bg-slate-200" />

            {/* Validate */}
            <button
              type="button"
              disabled={!actions.canValidateDraft || isBusy}
              onClick={handleValidate}
              title="Validate layout"
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ color: 'var(--text-muted)' }}
            >
              <SearchCheck className="h-3.5 w-3.5" />
            </button>

            {/* Save */}
            <button
              type="button"
              disabled={!actions.canSaveDraft || isBusy}
              onClick={handleSaveDraft}
              title="Save draft"
              className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ color: 'var(--text-muted)' }}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>

            {/* Publish */}
            <button
              type="button"
              disabled={!actions.canPublishDraft || isBusy}
              onClick={handlePublish}
              className="flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: 'var(--accent)' }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Publish
            </button>
          </>
        )}
      </div>

      {/* ── Block 6: User Settings ────────────────────────── */}
      <div
        className="flex h-full items-center gap-3 border-l px-3"
        style={{ borderColor: 'var(--border-muted)' }}
      >
        <div className="hidden flex-col items-end xl:flex">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {currentMembership?.role ?? 'user'}
          </div>
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
