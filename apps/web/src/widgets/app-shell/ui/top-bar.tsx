import { CheckCircle2, FilePlus2, Redo2, Save, SearchCheck, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useActiveFloorId, useActiveSiteId, useSetActiveFloorId, useSetActiveSiteId } from '@/app/store/ui-selectors';
import { useFloors } from '@/entities/floor/api/use-floors';
import { useActiveLayoutDraft } from '@/entities/layout-version/api/use-active-layout-draft';
import { useSites } from '@/entities/site/api/use-sites';
import { useCreateLayoutDraft } from '@/features/layout-draft-save/model/use-create-layout-draft';
import { useSaveLayoutDraft } from '@/features/layout-draft-save/model/use-save-layout-draft';
import { usePublishLayout } from '@/features/layout-publish/model/use-publish-layout';
import { useLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { useDraftDirtyState, useLayoutDraftState, useResetDraft } from '@/widgets/warehouse-editor/model/editor-selectors';
import { getLayoutActionState, shouldProceedWithContextSwitch } from '../lib/layout-context';

export function TopBar() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const setActiveSiteId = useSetActiveSiteId();
  const setActiveFloorId = useSetActiveFloorId();
  const resetDraft = useResetDraft();
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

  const activeSite = sites.find((site) => site.id === activeSiteId) ?? null;
  const activeFloor = floors.find((floor) => floor.id === activeFloorId) ?? null;
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
    if (!validateLayout.data) {
      return null;
    }

    return validateLayout.data.isValid ? 'Validation passed' : `${validateLayout.data.issues.length} issue(s) found`;
  }, [validateLayout.data]);

  const handleCreateDraft = async () => {
    if (!activeFloorId) {
      return;
    }

    try {
      const draftId = await createDraft.mutateAsync(activeFloorId);
      setStatusMessage(`Draft ready: ${draftId}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to create draft');
    }
  };

  const handleSaveDraft = async () => {
    if (!layoutDraft || !activeFloorId) {
      return;
    }

    try {
      await saveDraft.mutateAsync(layoutDraft);
      setStatusMessage('Draft saved');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save draft');
    }
  };

  const handleValidate = async () => {
    if (!layoutDraft || !activeFloorId) {
      return;
    }

    try {
      const result = await validateLayout.mutateAsync(layoutDraft.layoutVersionId);
      setStatusMessage(result.isValid ? 'Layout is valid' : `${result.issues.length} issue(s) found`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Validation failed');
    }
  };

  const handlePublish = async () => {
    if (!layoutDraft || !activeFloorId) {
      return;
    }

    try {
      const result = await publishLayout.mutateAsync(layoutDraft.layoutVersionId);
      setStatusMessage(`Published with ${result.generatedCells} generated cells`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Publish failed');
    }
  };

  const handleSiteChange = (nextSiteId: string) => {
    if (nextSiteId === activeSiteId) {
      return;
    }

    if (!shouldProceedWithContextSwitch(isDraftDirty, () => window.confirm('You have unsaved draft changes. Discard them and switch context?'))) {
      return;
    }

    resetDraft();
    setActiveSiteId(nextSiteId || null);
    setStatusMessage(null);
  };

  const handleFloorChange = (nextFloorId: string) => {
    if (nextFloorId === activeFloorId) {
      return;
    }

    if (!shouldProceedWithContextSwitch(isDraftDirty, () => window.confirm('You have unsaved draft changes. Discard them and switch context?'))) {
      return;
    }

    resetDraft();
    setActiveFloorId(nextFloorId || null);
    setStatusMessage(null);
  };

  return (
    <header className="mb-4 rounded-[22px] border border-[var(--border-muted)] bg-[var(--surface-primary)] px-6 py-4 shadow-[var(--shadow-soft)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[240px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Warehouse Setup</div>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Layout draft + rack configuration + publish flow</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Build spatial truth first. Save drafts intentionally, validate structurally, then publish immutable layout versions.
          </p>
          <p className="mt-3 text-xs text-slate-600">
            {activeSite ? activeSite.name : 'No site selected'}
            {' · '}
            {activeFloor ? activeFloor.name : 'No floor selected'}
            {(statusMessage || issueSummary) ? ` · ${statusMessage ?? issueSummary}` : ''}
          </p>
        </div>

        <div className="flex flex-1 flex-wrap items-start justify-end gap-4">
          <div className="grid min-w-[360px] gap-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Context</div>
              <div
                className={[
                  'rounded-full px-3 py-1 text-xs font-medium',
                  isDraftDirty ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                ].join(' ')}
              >
                {isDraftDirty ? 'Unsaved draft' : 'Draft synced'}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-xs text-slate-500">
                <span>Site</span>
                <select value={activeSiteId ?? ''} onChange={(event) => handleSiteChange(event.target.value)} className="min-w-[160px] rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm">
                  <option value="">Select site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.code} · {site.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-500">
                <span>Floor</span>
                <select value={activeFloorId ?? ''} onChange={(event) => handleFloorChange(event.target.value)} disabled={!activeSiteId} className="min-w-[160px] rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
                  <option value="">Select floor</option>
                  {floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.code} · {floor.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-[var(--border-muted)] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Actions</div>
              <div className="text-xs text-slate-500">{issueSummary ?? 'Validation pending'}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="rounded-xl border border-[var(--border-muted)] px-3 py-2 text-sm text-slate-600"><Undo2 className="mr-2 inline h-4 w-4" />Undo</button>
              <button type="button" className="rounded-xl border border-[var(--border-muted)] px-3 py-2 text-sm text-slate-600"><Redo2 className="mr-2 inline h-4 w-4" />Redo</button>
              <button type="button" disabled={!actions.canCreateDraft || isBusy} onClick={handleCreateDraft} className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2 text-sm text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 className="mr-2 inline h-4 w-4" />Create Draft</button>
              <button type="button" disabled={!actions.canSaveDraft || isBusy} onClick={handleSaveDraft} className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2 text-sm text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><Save className="mr-2 inline h-4 w-4" />Save Draft</button>
              <button type="button" disabled={!actions.canValidateDraft || isBusy} onClick={handleValidate} className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2 text-sm text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><SearchCheck className="mr-2 inline h-4 w-4" />Validate</button>
              <button type="button" disabled={!actions.canPublishDraft || isBusy} onClick={handlePublish} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="mr-2 inline h-4 w-4" />Publish</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
