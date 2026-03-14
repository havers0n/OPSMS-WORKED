import {
  CheckCircle2,
  ChevronRight,
  FilePlus2,
  LogOut,
  Redo2,
  Save,
  SearchCheck,
  Undo2
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/auth-provider';
import {
  useActiveFloorId,
  useActiveSiteId,
  useSetActiveFloorId,
  useSetActiveSiteId
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

// All modes are enterable. Non-layout modes show truthful placeholder panels
// via InspectorRouter until their domain models are implemented.
const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'semantics', label: 'Semantics' },
  { id: 'placement', label: 'Placement' },
  { id: 'flow', label: 'Flow' }
];

export function TopBar() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { user, memberships, currentTenantId, signOut } = useAuth();
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
  const isBusy =
    createDraft.isPending ||
    saveDraft.isPending ||
    validateLayout.isPending ||
    publishLayout.isPending;
  const currentMembership = memberships.find((membership) => membership.tenantId === currentTenantId) ?? memberships[0] ?? null;

  const issueSummary = useMemo(() => {
    if (!layoutDraft && latestPublished) return 'Published · read-only';
    if (layoutDraft?.state === 'published') return 'Published · read-only';
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
      const result = await publishLayout.mutateAsync(layoutDraft.layoutVersionId);
      setStatusMessage(`Published · ${result.generatedCells} cells · new draft ready`);
    } catch (error) {
      if (error instanceof BffRequestError && error.message.includes('failed validation')) {
        try {
          const validation = await validateLayout.mutateAsync(layoutDraft.layoutVersionId);
          const firstError = validation.issues.find((issue) => issue.severity === 'error') ?? validation.issues[0];
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
    if (!shouldProceedWithContextSwitch(isDraftDirty, () => window.confirm('Unsaved changes. Discard?'))) return;
    resetDraft();
    setActiveSiteId(nextSiteId || null);
    setStatusMessage(null);
  };

  const handleFloorChange = (nextFloorId: string) => {
    if (nextFloorId === activeFloorId) return;
    if (!shouldProceedWithContextSwitch(isDraftDirty, () => window.confirm('Unsaved changes. Discard?'))) return;
    resetDraft();
    setActiveFloorId(nextFloorId || null);
    setStatusMessage(null);
  };

  const activeSite = sites.find((s) => s.id === activeSiteId);
  const activeFloor = floors.find((f) => f.id === activeFloorId);

  return (
    <header
      className="flex h-11 shrink-0 items-center gap-0 border-b"
      style={{
        borderColor: 'var(--border-strong)',
        background: 'var(--surface-primary)',
        backdropFilter: 'blur(8px)'
      }}
    >
      {/* ── Logo ──────────────────────────────────────────── */}
      <div
        className="flex h-full w-11 shrink-0 items-center justify-center border-r"
        style={{ borderColor: 'var(--border-muted)' }}
      >
        <span className="text-[11px] font-black tracking-widest" style={{ color: 'var(--accent)' }}>
          W
        </span>
      </div>

      {/* ── Breadcrumb: Site / Floor ───────────────────────── */}
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
          <span
            className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={
              isDraftDirty
                ? { background: 'rgba(183,121,31,0.12)', color: 'var(--warning)' }
                : !isLayoutEditable
                  ? { background: 'rgba(37,99,235,0.12)', color: '#1d4ed8' }
                : { background: 'rgba(20,125,100,0.1)', color: 'var(--success)' }
            }
          >
            {isDraftDirty ? 'Unsaved' : !isLayoutEditable ? 'Published' : 'Synced'}
          </span>
        )}
      </div>

      {/* ── Mode switcher — center ─────────────────────────── */}
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

      {/* ── Right: status + actions ────────────────────────── */}
      <div
        className="flex h-full items-center gap-1 border-l px-3"
        style={{ borderColor: 'var(--border-muted)' }}
      >
        {/* Status message */}
        {(statusMessage || issueSummary) && (
          <span
            className="mr-1 text-[11px]"
            style={{ color: 'var(--text-muted)' }}
            aria-live="polite"
          >
            {statusMessage ?? issueSummary}
          </span>
        )}

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

        {/* Create draft (when no draft) */}
        {actions.canCreateDraft && (
          <button
            type="button"
            disabled={isBusy}
            onClick={handleCreateDraft}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ color: 'var(--text-muted)' }}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Create Draft
          </button>
        )}

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

        <div className="mx-1.5 h-5 w-px bg-slate-200" />

        <div className="hidden items-center gap-2 rounded-xl border border-[var(--border-muted)] bg-white px-3 py-1.5 shadow-sm xl:flex">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {currentMembership?.role ?? 'user'}
            </div>
            <div className="text-xs text-slate-700">{user?.email ?? 'unknown user'}</div>
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
