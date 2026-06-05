import { create } from 'zustand';
import type {
  EditorMode,
  LayoutInteractionMode,
  NonLayoutViewMode,
  ViewMode,
  ViewStage
} from './editor-types';

type ModeStore = {
  viewMode: ViewMode;
  viewStage: ViewStage;
  editorMode: EditorMode;
  layoutInteractionMode: LayoutInteractionMode;
  lastNonLayoutViewMode: NonLayoutViewMode;
  setViewMode: (nextViewMode: ViewMode) => void;
  setViewStage: (nextViewStage: ViewStage) => void;
  setEditorMode: (nextEditorMode: EditorMode) => void;
  setLayoutInteractionMode: (next: LayoutInteractionMode) => void;
  enterLayoutPreview: () => void;
  startLayoutEditing: () => void;
  finishLayoutEditing: () => void;
  exitLayout: () => void;
};

export const useModeStore = create<ModeStore>((set) => ({
  viewMode: 'view',
  viewStage: 'map',
  editorMode: 'select',
  layoutInteractionMode: 'preview',
  lastNonLayoutViewMode: 'view',
  setViewMode: (nextViewMode) =>
    set((state) => {
      const isEnteringLayout = nextViewMode === 'layout' && state.viewMode !== 'layout';

      return {
        viewMode: nextViewMode,
        layoutInteractionMode:
          nextViewMode !== 'layout' ? 'preview' : 'preview',
        lastNonLayoutViewMode: isEnteringLayout
          ? (state.viewMode as NonLayoutViewMode)
          : nextViewMode !== 'layout'
            ? (nextViewMode as NonLayoutViewMode)
            : state.lastNonLayoutViewMode,
      };
    }),
  setViewStage: (nextViewStage) =>
    set({
      viewStage: nextViewStage
    }),
  setEditorMode: (nextEditorMode) =>
    set({
      editorMode: nextEditorMode
    }),
  setLayoutInteractionMode: (next) =>
    set({ layoutInteractionMode: next }),
  enterLayoutPreview: () =>
    set((state) => ({
      viewMode: 'layout',
      layoutInteractionMode: 'preview',
      lastNonLayoutViewMode: state.viewMode as NonLayoutViewMode,
    })),
  startLayoutEditing: () =>
    set({ layoutInteractionMode: 'editing' }),
  finishLayoutEditing: () =>
    set({ layoutInteractionMode: 'preview' }),
  exitLayout: () =>
    set((state) => ({
      viewMode: state.lastNonLayoutViewMode,
      layoutInteractionMode: 'preview',
    })),
}));
