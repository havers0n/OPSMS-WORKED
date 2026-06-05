import { CheckCircle2, FilePlus2, Redo2, Save, SearchCheck, Undo2 } from 'lucide-react';
import { useActiveFloorId } from '@/app/store/ui-selectors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import { useCreateLayoutDraft } from '@/features/layout-draft-save/model/use-create-layout-draft';
import { useSaveLayoutDraft } from '@/features/layout-draft-save/model/use-save-layout-draft';
import { usePublishLayout } from '@/features/layout-publish/model/use-publish-layout';
import { useLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { BffRequestError } from '@/shared/api/bff/client';
import { translateBffError, useT } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Divider } from '@/shared/ui/divider';
import { IconButton } from '@/shared/ui/icon-button';
import { ToolRail } from '@/shared/ui/tool-rail';
import {
  getWarehouseDraftSnapshot,
  useIsWarehouseDraftDirty,
  useWarehouseDraftStatus,
  useWarehouseLayoutDraft
} from '@/warehouse/state/layout-draft';
import {
  useWarehouseLayoutInteractionMode,
  useWarehouseViewMode
} from '@/warehouse/state/view-mode';
import { getLayoutActionState } from '../lib/layout-context';

type WorkspaceActionsProps = {
  onStatusMessageChange: (message: string | null) => void;
};

export function WorkspaceActions({ onStatusMessageChange }: WorkspaceActionsProps) {
  const t = useT();
  const activeFloorId = useActiveFloorId();
  const viewMode = useWarehouseViewMode();
  const layoutInteractionMode = useWarehouseLayoutInteractionMode();
  const layoutDraft = useWarehouseLayoutDraft();
  const isDraftDirty = useIsWarehouseDraftDirty();
  const persistenceStatus = useWarehouseDraftStatus();

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

  // Show layout actions when editing mode is active, or when viewing published layout
  // with no draft (create draft flow). Preview mode with existing draft hides the
  // editing toolbar — "Edit layout" CTA is in the top bar center.
  const canShowLayoutActions = viewMode === 'layout' && (layoutInteractionMode === 'editing' || !layoutDraft || layoutDraft.state !== 'draft');
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
      onStatusMessageChange(t('warehouse.action.draftReady'));
    } catch (error) {
      onStatusMessageChange(error instanceof BffRequestError ? translateBffError(error) : t('warehouse.action.failed'));
    }
  };

  const handleSaveDraft = async () => {
    const latestDraft = getWarehouseDraftSnapshot();
    if (!latestDraft || latestDraft.state !== 'draft' || !activeFloorId) return;
    try {
      await saveDraft.flushSave(latestDraft);
      onStatusMessageChange(null);
    } catch {
      onStatusMessageChange(null);
    }
  };

  const handleValidate = async () => {
    const latestDraft = getWarehouseDraftSnapshot();
    if (!latestDraft || latestDraft.state !== 'draft' || !activeFloorId) return;
    try {
      const result = await validateLayout.mutateAsync(latestDraft.layoutVersionId);
      onStatusMessageChange(result.isValid ? t('warehouse.status.valid') : t('warehouse.status.issueCount', { count: result.issues.length }));
    } catch (error) {
      onStatusMessageChange(error instanceof BffRequestError ? translateBffError(error) : t('warehouse.action.validationFailed'));
    }
  };

  const handlePublish = async () => {
    const latestDraft = getWarehouseDraftSnapshot();
    if (!latestDraft || latestDraft.state !== 'draft' || !activeFloorId) return;
    try {
      const result = await publishLayout.mutateAsync();
      onStatusMessageChange(t('warehouse.action.publishedCells', { count: result.generatedCells }));
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
              : t('warehouse.status.issueCount', { count: persistedDraftValidationAfterPublishGateFailure.issues.length })
          );
          return;
        } catch {
          // Fall through to the original publish error if validation lookup fails.
        }
      }
      onStatusMessageChange(error instanceof BffRequestError ? translateBffError(error) : t('warehouse.action.publishFailed'));
    }
  };

  if (!canShowLayoutActions) {
    return null;
  }

  if (isPublishedMode) {
    return (
      <Button
        variant="solid"
        size="sm"
        disabled={isBusy}
        onClick={handleCreateDraft}
        className="h-8 gap-1.5 rounded-md px-3 text-sm text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
      >
        <FilePlus2 className="h-3.5 w-3.5" />
        {createDraft.isPending ? t('warehouse.action.creating') : t('warehouse.action.createDraft')}
      </Button>
    );
  }

  return (
    <ToolRail
      orientation="horizontal"
      className="gap-1 border-0 bg-transparent p-0"
      aria-label={t('warehouse.action.workspaceActions')}
    >
      <IconButton
        icon={<Undo2 className="h-3.5 w-3.5" />}
        variant="ghost"
        disabled
        title={t('warehouse.action.undoSoon')}
        className="h-8 w-8 rounded-md text-slate-300"
      />
      <IconButton
        icon={<Redo2 className="h-3.5 w-3.5" />}
        variant="ghost"
        disabled
        title={t('warehouse.action.redoSoon')}
        className="h-8 w-8 rounded-md text-slate-300"
      />

      <Divider orientation="vertical" className="mx-1 h-4 bg-slate-200" />

      <IconButton
        icon={<SearchCheck className="h-3.5 w-3.5" />}
        variant="ghost"
        disabled={!actions.canValidateDraft || isBusy}
        onClick={handleValidate}
        title={t('warehouse.action.validateLayout')}
        className="h-8 w-8 rounded-md disabled:opacity-30"
        style={{ color: 'var(--text-muted)' }}
      />

      <Button
        variant="ghost"
        size="sm"
        disabled={!actions.canSaveDraft || isBusy || persistenceStatus === 'conflict'}
        onClick={handleSaveDraft}
        title={t('warehouse.action.saveDraft')}
        className="h-8 gap-1.5 rounded-md px-2.5 text-sm font-medium disabled:opacity-30"
        style={{ color: 'var(--text-muted)' }}
      >
        <Save className="h-3.5 w-3.5" />
        {t('warehouse.action.save')}
      </Button>

      <Button
        variant="solid"
        size="sm"
        disabled={!actions.canPublishDraft || isBusy || persistenceStatus === 'conflict'}
        onClick={handlePublish}
        className="h-8 gap-1.5 rounded-md px-3 text-sm text-white shadow-sm disabled:opacity-30"
        style={{ background: 'var(--accent)' }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {t('warehouse.action.publish')}
      </Button>
    </ToolRail>
  );
}
