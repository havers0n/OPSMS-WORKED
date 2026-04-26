import { create } from 'zustand';
import type { EditorMode, ViewMode, ViewStage } from './editor-types';

/**
 * Mode Store — independent single source of truth for viewMode and editorMode.
 *
 * This store is separate from editor-store to isolate mode state from selection,
 * workflow, and other editor concerns. However, mode changes have coordinated
 * side effects (clearing selection, cancelling workflows) which are handled
 * by editor-store's setViewMode action, not here.
 *
 * Responsibilities:
 * - Hold current viewMode ('layout', 'view', 'storage')
 * - Hold current editorMode ('select', 'place', 'draw-zone', 'draw-wall')
 * - Provide synchronous setters for mode transitions
 *
 * Does NOT:
 * - Clear selection or workflow (editor-store handles this)
 * - Trigger camera auto-fit (useCanvasViewportController handles this)
 * - Gate interaction semantics (useCanvasSceneModel handles this)
 */

type ModeStore = {
  viewMode: ViewMode;
  viewStage: ViewStage;
  editorMode: EditorMode;
  setViewMode: (nextViewMode: ViewMode) => void;
  setViewStage: (nextViewStage: ViewStage) => void;
  setEditorMode: (nextEditorMode: EditorMode) => void;
};

export const useModeStore = create<ModeStore>((set) => ({
  viewMode: 'layout',
  viewStage: 'map',
  editorMode: 'select',
  setViewMode: (nextViewMode) =>
    set({
      viewMode: nextViewMode
    }),
  setViewStage: (nextViewStage) =>
    set({
      viewStage: nextViewStage
    }),
  setEditorMode: (nextEditorMode) =>
    set({
      editorMode: nextEditorMode
    })
}));
