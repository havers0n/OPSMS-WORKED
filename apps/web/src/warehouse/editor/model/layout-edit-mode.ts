import type { LayoutDraft, Rack } from '@wos/domain';
import type { ViewMode } from './editor-types';

export type LayoutEditMode =
  | 'draft-editing'
  | 'published-readonly'
  | 'non-layout-readonly'
  | 'no-layout';

export type LayoutReadOnlyReason = Exclude<LayoutEditMode, 'draft-editing'>;

export type RackReadOnlyReason = LayoutReadOnlyReason | 'rack-locked';

export function resolveLayoutEditMode({
  viewMode,
  draft
}: {
  viewMode: ViewMode;
  draft: Pick<LayoutDraft, 'state'> | null | undefined;
}): LayoutEditMode {
  if (viewMode !== 'layout') {
    return 'non-layout-readonly';
  }

  if (!draft) {
    return 'no-layout';
  }

  if (draft.state === 'draft') {
    return 'draft-editing';
  }

  return 'published-readonly';
}

export function isLayoutEditModeEditable(layoutEditMode: LayoutEditMode): boolean {
  return layoutEditMode === 'draft-editing';
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
