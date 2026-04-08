import type { FloorWorkspace, LayoutDraft } from '@wos/domain';

type ContextSwitchConfirmation = () => boolean;

type LayoutActionStateInput = {
  activeFloorId: string | null;
  workspaceIsLoading: boolean;
  workspaceIsError: boolean;
  workspace: FloorWorkspace | null | undefined;
  localDraft: LayoutDraft | null;
  isDraftDirty: boolean;
};

export function shouldProceedWithContextSwitch(isDraftDirty: boolean, confirmDiscard: ContextSwitchConfirmation): boolean {
  if (!isDraftDirty) {
    return true;
  }

  return confirmDiscard();
}

export function getLayoutActionState(input: LayoutActionStateInput) {
  const liveDraft = input.workspace?.activeDraft ?? null;
  const hasLoadedDraft = Boolean(
    liveDraft &&
      input.localDraft &&
      input.localDraft.state === 'draft' &&
      liveDraft.layoutVersionId === input.localDraft.layoutVersionId
  );
  const isWorkspaceReady = !input.workspaceIsLoading && !input.workspaceIsError;

  return {
    hasLoadedDraft,
    canCreateDraft: Boolean(input.activeFloorId) && isWorkspaceReady && !liveDraft,
    canSaveDraft: Boolean(input.activeFloorId && input.localDraft?.state === 'draft' && hasLoadedDraft && isWorkspaceReady),
    canValidateDraft: Boolean(input.activeFloorId && input.localDraft?.state === 'draft' && hasLoadedDraft && isWorkspaceReady),
    canPublishDraft: Boolean(
      input.activeFloorId &&
        input.localDraft?.state === 'draft' &&
        hasLoadedDraft &&
        isWorkspaceReady
    )
  };
}
