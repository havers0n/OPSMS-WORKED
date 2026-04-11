import { create } from 'zustand';
import type { EditorMode, ViewMode } from './editor-types';

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
  editorMode: EditorMode;
  setViewMode: (nextViewMode: ViewMode) => void;
  setEditorMode: (nextEditorMode: EditorMode) => void;
};

export const useModeStore = create<ModeStore>((set) => ({
  viewMode: 'layout',
  editorMode: 'select',
  setViewMode: (nextViewMode) =>
    set({
      viewMode: nextViewMode
    }),
  setEditorMode: (nextEditorMode) =>
    set({
      editorMode: nextEditorMode
    })
}));
