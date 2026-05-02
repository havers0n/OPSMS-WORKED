/**
 * Pure visibility logic for the context panel.
 * No React, no store, no @/ aliases — testable in isolation.
 *
 * The context panel is a temporary focused workspace that appears when there is
 * idle guidance, an active object selection, or a workflow in progress. It sits
 * between the local bar (compact launcher) and the right inspector
 * (persistent truth surface).
 */
import type {
  EditorMode,
  EditorSelection,
  InteractionScope,
  ViewMode
} from '@/warehouse/editor/model/editor-types';

/**
 * Describes what the context panel should display.
 *
 * - 'hidden'         — panel is not shown
 * - 'rack-context'   — single rack selected (body-level context)
 * - 'rack-side-context' — one side of a single rack is focused
 * - 'multi-rack'     — multiple racks selected
 * - 'zone-context'   — one layout zone selected
 * - 'wall-context'   — one layout wall selected
 * - 'cell-context'   — cell selected (view/storage)
 * - 'container-context' — container selected (view/storage)
 * - 'workflow'       — a placement interaction or workflow is active
 */
export type ContextPanelIntent =
  | 'hidden'
  | 'rack-context'
  | 'rack-side-context'
  | 'multi-rack'
  | 'zone-context'
  | 'wall-context'
  | 'cell-context'
  | 'container-context'
  | 'workflow';

/**
 * Resolves whether the context panel should be visible.
 *
 * Rules:
 *   1. layout mode + a draw/create tool active → hidden (don't obstruct canvas drawing)
 *   2. otherwise visible for idle guidance, object context, and workflow state
 */
export function resolveContextPanelVisibility(params: {
  scope: InteractionScope;
  editorMode: EditorMode;
  viewMode: ViewMode;
}): boolean {
  const { editorMode, viewMode } = params;

  // In layout mode with a draw/create tool active, the panel would obstruct canvas interaction.
  // The context panel would obstruct the canvas interaction.
  if (viewMode === 'layout' && editorMode !== 'select') return false;

  return true;
}

/**
 * Resolves what kind of context the panel should display.
 *
 * This is separate from visibility so the component can render different
 * content branches without duplicating the visibility logic.
 *
 * The intent is determined by the combination of scope and selection type.
 * Future PRs will use this to route to different context panel content.
 */
export function resolveContextPanelIntent(params: {
  scope: InteractionScope;
  editorMode: EditorMode;
  viewMode: ViewMode;
  selection: EditorSelection;
}): ContextPanelIntent {
  const { scope, editorMode, viewMode, selection } = params;

  // First check visibility — if not visible, intent is hidden
  if (!resolveContextPanelVisibility({ scope, editorMode, viewMode })) {
    return 'hidden';
  }

  // Workflow scope takes precedence — a move/placement is in progress
  if (scope === 'workflow') {
    return 'workflow';
  }

  if (scope === 'idle') {
    return 'hidden';
  }

  // Object scope — route based on selection type
  switch (selection.type) {
    case 'rack':
      if (selection.rackIds.length >= 2) return 'multi-rack';
      return selection.focus?.type === 'side' ? 'rack-side-context' : 'rack-context';
    case 'zone':
      return 'zone-context';
    case 'wall':
      return 'wall-context';
    case 'cell':
      return 'cell-context';
    case 'container':
      return 'container-context';
    default:
      return 'hidden';
  }
}
