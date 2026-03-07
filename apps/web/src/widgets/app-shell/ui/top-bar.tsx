import { CheckCircle2, FilePlus2, PlusSquare, Redo2, Save, SearchCheck, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useActiveFloorId, useActiveSiteId, useSetActiveFloorId, useSetActiveSiteId } from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import { useActiveLayoutDraft } from '@/entities/layout-version/api/use-active-layout-draft';
import { useSites } from '@/entities/site/api/use-sites';
import { useCreateLayoutDraft } from '@/features/layout-draft-save/model/use-create-layout-draft';
import { useSaveLayoutDraft } from '@/features/layout-draft-save/model/use-save-layout-draft';
import { usePublishLayout } from '@/features/layout-publish/model/use-publish-layout';
import { useLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { useDraftDirtyState, useEditorMode, useLayoutDraftState, useResetDraft, useSetEditorMode } from '@/widgets/warehouse-editor/model/editor-selectors';
import { getLayoutActionState, shouldProceedWithContextSwitch } from '../lib/layout-context';

export function TopBar() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveSiteId = useSetActiveSiteId();
  const setActiveFloorId = useSetActiveFloorId();
  const resetDraft = useResetDraft();
  const editorMode = useEditorMode();
  const setEditorMode = useSetEditorMode();
  const { data: sites = [] } = useSites();
  const { data: floors = [] } = useFloors(activeSiteId);
  const liveDraftQuery = useActiveLayoutDraft(activeFloorId);
  const liveDraft = liveDraftQuery.data;
  const layoutDraft = useLayoutDraftState();
  const isDraftDirty = useDraftDirtyState();
  const createDraft = useCreateLayoutDraft(activeFloorId);
  const saveDraft = useSaveLayoutDraft(activeFloorId);
  const validateLayout = useLayoutValidation();
  const publishLayout = usePublishLayout(activeFloorId);

  const actions = getLayoutActionState({
    activeFloorId,
    liveDraftIsLoading: liveDraftQuery.isLoading,
    liveDraftIsError: liveDraftQuery.isError,
    liveDraft,
    localDraft: layoutDraft,
    isDraftDirty
  });
  const isBusy = createDraft.isPending || saveDraft.isPending || validateLayout.isPending || publishLayout.isPending;

  const issueSummary = useMemo(() => {
    if (!validateLayout.data) return null;
    return validateLayout.data.isValid ? 'Valid' : `${validateLayout.data.issues.length} issue(s)`;
  }, [validateLayout.data]);

  const handleCreateDraft = async () => {
    if (!activeFloorId) return;
    try {
      const draftId = await createDraft.mutateAsync(activeFloorId);
      setStatusMessage(`Draft ready: ${draftId}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to create draft');
    }
  };

  const handleSaveDraft = async () => {
    if (!layoutDraft || !activeFloorId) return;
    try {
      await saveDraft.mutateAsync(layoutDraft);
      setStatusMessage('Saved');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Save failed');
    }
  };

  const handleValidate = async () => {
    if (!layoutDraft || !activeFloorId) return;
    try {
      const result = await validateLayout.mutateAsync(layoutDraft.layoutVersionId);
      setStatusMessage(result.isValid ? 'Layout valid' : `${result.issues.length} issue(s) found`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Validation failed');
    }
  };

  const handlePublish = async () => {
    if (!layoutDraft || !activeFloorId) return;
    try {
      const result = await publishLayout.mutateAsync(layoutDraft.layoutVersionId);
      setStatusMessage(`Published · ${result.generatedCells} cells`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Publish failed');
    }
  };

  const handleSiteChange = (nextSiteId: string) => {
    if (nextSiteId === activeSiteId) return;
    if (!shouldProceedWithContextSwitch(isDraftDirty, () => window.confirm('Unsaved draft changes. Discard and switch?'))) return;
    resetDraft();
    setActiveSiteId(nextSiteId || null);
    setStatusMessage(null);
  };

  const handleFloorChange = (nextFloorId: string) => {
    if (nextFloorId === activeFloorId) return;
    if (!shouldProceedWithContextSwitch(isDraftDirty, () => window.confirm('Unsaved draft changes. Discard and switch?'))) return;
    resetDraft();
    setActiveFloorId(nextFloorId || null);
    setStatusMessage(null);
  };

  const isPlacing = editorMode === 'place';

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-muted)] bg-[var(--surface-primary)] px-4">

      {/* Left zone: context breadcrumb (site / floor) + draft status pill */}
      <div className="flex items-center gap-2">
        <select
          value={activeSiteId ?? ''}
          onChange={(e) => handleSiteChange(e.target.value)}
          className="h-8 rounded-lg border border-[var(--border-muted)] bg-white px-2 text-sm text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30"
        >
          <option value="">Site…</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>{site.code} · {site.name}</option>
          ))}
        </select>

        <span className="text-slate-300 select-none">/</span>

        <select
          value={activeFloorId ?? ''}
          onChange={(e) => handleFloorChange(e.target.value)}
          disabled={!activeSiteId}
          className="h-8 rounded-lg border border-[var(--border-muted)] bg-white px-2 text-sm text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">Floor…</option>
          {floors.map((floor) => (
            <option key={floor.id} value={floor.id}>{floor.code} · {floor.name}</option>
          ))}
        </select>

        <span
          className={[
            'rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
            isDraftDirty
              ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-50 text-emerald-700'
          ].join(' ')}
        >
          {isDraftDirty ? '● Unsaved' : '✓ Synced'}
        </span>
      </div>

      {/* Center: grows — shows status feedback or validation summary */}
      <div className="flex flex-1 items-center justify-center px-4">
        {(statusMessage || issueSummary) && (
          <span className="text-xs text-slate-400">{statusMessage ?? issueSummary}</span>
        )}
      </div>

      {/* Right zone: undo/redo + add rack + lifecycle actions */}
      <div className="flex items-center gap-1">

        {/* Undo / Redo stubs */}
        <button
          type="button"
          disabled
          title="Undo (coming soon)"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 disabled:cursor-not-allowed"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled
          title="Redo (coming soon)"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 disabled:cursor-not-allowed"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="mx-1.5 h-5 w-px bg-slate-200" />

        {/* Add Rack — place-mode toggle */}
        {layoutDraft && (
          <button
            type="button"
            onClick={() => setEditorMode(isPlacing ? 'select' : 'place')}
            className={[
              'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors',
              isPlacing
                ? 'border-cyan-400 bg-cyan-50 text-cyan-800 ring-1 ring-cyan-400/40'
                : 'border-[var(--border-muted)] bg-white text-slate-700 hover:bg-slate-50 shadow-sm'
            ].join(' ')}
          >
            <PlusSquare className="h-4 w-4" />
            {isPlacing ? 'Click canvas…' : 'Add Rack'}
          </button>
        )}

        <div className="mx-1.5 h-5 w-px bg-slate-200" />

        {/* Layout lifecycle */}
        <button
          type="button"
          disabled={!actions.canCreateDraft || isBusy}
          onClick={handleCreateDraft}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-muted)] bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          Draft
        </button>

        <button
          type="button"
          disabled={!actions.canSaveDraft || isBusy}
          onClick={handleSaveDraft}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-muted)] bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>

        <button
          type="button"
          disabled={!actions.canValidateDraft || isBusy}
          onClick={handleValidate}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-muted)] bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SearchCheck className="h-3.5 w-3.5" />
          Validate
        </button>

        <button
          type="button"
          disabled={!actions.canPublishDraft || isBusy}
          onClick={handlePublish}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Publish
        </button>

      </div>
    </header>
  );
}
