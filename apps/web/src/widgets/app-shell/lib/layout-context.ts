import type { LayoutDraft } from '@wos/domain';

type ContextSwitchConfirmation = () => boolean;

type LayoutActionStateInput = {
  activeFloorId: string | null;
  liveDraftIsLoading: boolean;
  liveDraftIsError: boolean;
  liveDraft: LayoutDraft | null | undefined;
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
  const hasLoadedDraft = Boolean(
    input.liveDraft && input.localDraft && input.liveDraft.layoutVersionId === input.localDraft.layoutVersionId
  );
  const isLiveDraftReady = !input.liveDraftIsLoading && !input.liveDraftIsError;

  return {
    hasLoadedDraft,
    canCreateDraft: Boolean(input.activeFloorId) && isLiveDraftReady && !input.liveDraft,
    canSaveDraft: Boolean(input.activeFloorId && input.localDraft && hasLoadedDraft && isLiveDraftReady),
    canValidateDraft: Boolean(input.activeFloorId && input.localDraft && hasLoadedDraft && isLiveDraftReady),
    canPublishDraft: Boolean(
      input.activeFloorId && input.localDraft && hasLoadedDraft && !input.isDraftDirty && isLiveDraftReady
    )
  };
}
