import { CheckCircle2, FilePlus2, Redo2, Save, SearchCheck, Undo2 } from 'lucide-react';
import { useActiveFloorId } from '@/app/store/ui-selectors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import { useCreateLayoutDraft } from '@/features/layout-draft-save/model/use-create-layout-draft';
import { useSaveLayoutDraft } from '@/features/layout-draft-save/model/use-save-layout-draft';
import { usePublishLayout } from '@/features/layout-publish/model/use-publish-layout';
import { useLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { BffRequestError } from '@/shared/api/bff/client';
import {
  useDraftDirtyState,
  useDraftPersistenceStatus,
  useLayoutDraftState,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { getLayoutActionState } from '../lib/layout-context';

type WorkspaceActionsProps = {
  onStatusMessageChange: (message: string | null) => void;
};

export function WorkspaceActions({ onStatusMessageChange }: WorkspaceActionsProps) {
  const activeFloorId = useActiveFloorId();
  const viewMode = useViewMode();
  const layoutDraft = useLayoutDraftState();
  const isDraftDirty = useDraftDirtyState();
  const persistenceStatus = useDraftPersistenceStatus();

  const workspaceQuery = useFloorWorkspace(activeFloorId);
  const workspace = workspaceQuery.data;
  const latestPublished = workspace?.latestPublished ?? null;

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
  const canShowLayoutActions = viewMode === 'layout';
  const isPublishedMode = canShowLayoutActions && actions.canCreateDraft && latestPublished !== null;
  const isBusy =
    createDraft.isPending ||
    saveDraft.isPending ||
    validateLayout.isPending ||
    publishLayout.isPending;

  const handleCreateDraft = async () => {
    if (!activeFloorId) return;
    try {
      await createDraft.mutateAsync(activeFloorId);
      onStatusMessageChange('Draft ready');
    } catch (error) {
      onStatusMessageChange(error instanceof Error ? error.message : 'Failed');
    }
  };

  const handleSaveDraft = async () => {
    const latestDraft = useEditorStore.getState().draft;
    if (!latestDraft || latestDraft.state !== 'draft' || !activeFloorId) return;
    try {
      await saveDraft.flushSave(latestDraft);
      onStatusMessageChange(null);
    } catch {
      onStatusMessageChange(null);
    }
  };

  const handleValidate = async () => {
    const latestDraft = useEditorStore.getState().draft;
    if (!latestDraft || latestDraft.state !== 'draft' || !activeFloorId) return;
    try {
      const result = await validateLayout.mutateAsync(latestDraft.layoutVersionId);
      onStatusMessageChange(result.isValid ? 'Valid' : `${result.issues.length} issue(s)`);
    } catch (error) {
      onStatusMessageChange(error instanceof Error ? error.message : 'Validation failed');
    }
  };

  const handlePublish = async () => {
    const latestDraft = useEditorStore.getState().draft;
    if (!latestDraft || latestDraft.state !== 'draft' || !activeFloorId) return;
    try {
      const result = await publishLayout.mutateAsync();
      onStatusMessageChange(`Published · ${result.generatedCells} cells · new draft ready`);
    } catch (error) {
      if (error instanceof BffRequestError && error.code === 'LAYOUT_VALIDATION_FAILED') {
        try {
          const persistedDraftValidationAfterPublishGateFailure = await validateLayout.mutateAsync(
            latestDraft.layoutVersionId
          );
          const firstError =
            persistedDraftValidationAfterPublishGateFailure.issues.find(
              (issue) => issue.severity === 'error'
            ) ?? persistedDraftValidationAfterPublishGateFailure.issues[0];
          onStatusMessageChange(
            firstError
              ? firstError.message
              : `${persistedDraftValidationAfterPublishGateFailure.issues.length} issue(s)`
          );
          return;
        } catch {
          // Fall through to the original publish error if validation lookup fails.
        }
      }
      onStatusMessageChange(error instanceof Error ? error.message : 'Publish failed');
    }
  };

  if (!canShowLayoutActions) {
    return null;
  }

  if (isPublishedMode) {
    return (
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
    );
  }

  return (
    <>
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

      <button
        type="button"
        disabled={!actions.canSaveDraft || isBusy || persistenceStatus === 'conflict'}
        onClick={handleSaveDraft}
        title="Save draft"
        className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
        style={{ color: 'var(--text-muted)' }}
      >
        <Save className="h-3.5 w-3.5" />
        Save
      </button>

      <button
        type="button"
        disabled={!actions.canPublishDraft || isBusy || persistenceStatus === 'conflict'}
        onClick={handlePublish}
        className="flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        style={{ background: 'var(--accent)' }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Publish
      </button>
    </>
  );
}
