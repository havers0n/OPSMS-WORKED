import type { LayoutDraft, Rack } from '@wos/domain';
import type { LayoutInteractionMode, ViewMode } from './editor-types';

export type LayoutEditMode =
  | 'draft-editing'
  | 'draft-preview'
  | 'published-readonly'
  | 'non-layout-readonly'
  | 'no-layout';

export type LayoutReadOnlyReason = Exclude<LayoutEditMode, 'draft-editing'>;

export type RackReadOnlyReason = LayoutReadOnlyReason | 'rack-locked';

export function resolveLayoutEditMode({
  viewMode,
  draft,
  layoutInteractionMode
}: {
  viewMode: ViewMode;
  draft: Pick<LayoutDraft, 'state'> | null | undefined;
  layoutInteractionMode: LayoutInteractionMode;
}): LayoutEditMode {
  if (viewMode !== 'layout') {
    return 'non-layout-readonly';
  }

  if (!draft) {
    return 'no-layout';
  }

  if (draft.state !== 'draft') {
    return 'published-readonly';
  }

  if (layoutInteractionMode === 'editing') {
    return 'draft-editing';
  }

  return 'draft-preview';
}

export function isLayoutEditModeEditable(layoutEditMode: LayoutEditMode): boolean {
  return layoutEditMode === 'draft-editing';
}

export function canEditLayoutGeometry({
  viewMode,
  layoutInteractionMode,
  draft,
}: {
  viewMode: ViewMode;
  layoutInteractionMode: LayoutInteractionMode;
  draft: Pick<LayoutDraft, 'state'> | null | undefined;
}): boolean {
  return viewMode === 'layout' && layoutInteractionMode === 'editing' && draft?.state === 'draft';
}

export function resolveLayoutReadOnlyReason(
  layoutEditMode: LayoutEditMode
): LayoutReadOnlyReason | null {
  if (layoutEditMode === 'draft-editing') {
    return null;
  }

  return layoutEditMode;
}

export function resolveRackReadOnlyReason({
  layoutEditMode,
  rack
}: {
  layoutEditMode: LayoutEditMode;
  rack: Pick<Rack, 'isLocked'> | null | undefined;
}): RackReadOnlyReason | null {
  const layoutReason = resolveLayoutReadOnlyReason(layoutEditMode);
  if (layoutReason) {
    return layoutReason;
  }

  return rack?.isLocked === true ? 'rack-locked' : null;
}
