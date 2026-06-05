import {
  useEditorMode,
  useEnterLayoutPreview,
  useExitLayout,
  useFinishLayoutEditing,
  useSetViewMode,
  useSetViewStage,
  useStartLayoutEditing,
  useViewMode,
  useViewStage
} from '@/warehouse/editor/model/editor-selectors';
import type {
  EditorMode,
  LayoutInteractionMode,
  NonLayoutViewMode,
  ViewMode,
  ViewStage
} from '@/warehouse/editor/model/editor-types';
import { useEditorStore } from '@/warehouse/editor/model/editor-store';
import { useModeStore } from '@/warehouse/editor/model/mode-store';

export type WarehouseViewMode = ViewMode;
export type WarehouseViewStage = ViewStage;
export type WarehouseEditorMode = EditorMode;
export type WarehouseLayoutInteractionMode = LayoutInteractionMode;
export type WarehouseNonLayoutViewMode = NonLayoutViewMode;

export const useWarehouseViewMode = useViewMode;
export const useSetWarehouseViewMode = useSetViewMode;
export const useWarehouseViewStage = useViewStage;
export const useSetWarehouseViewStage = useSetViewStage;
export const useWarehouseEditorMode = useEditorMode;
export const useWarehouseEnterLayoutPreview = useEnterLayoutPreview;
export const useWarehouseStartLayoutEditing = useStartLayoutEditing;
export const useWarehouseFinishLayoutEditing = useFinishLayoutEditing;
export const useWarehouseExitLayout = useExitLayout;

export function getWarehouseViewModeSnapshot() {
  const state = useModeStore.getState();

  return {
    viewMode: state.viewMode,
    viewStage: state.viewStage,
    editorMode: state.editorMode,
    layoutInteractionMode: state.layoutInteractionMode,
    lastNonLayoutViewMode: state.lastNonLayoutViewMode,
  };
}

export const useWarehouseLayoutInteractionMode = () =>
  useModeStore((state) => state.layoutInteractionMode);
export const useWarehouseLastNonLayoutViewMode = () =>
  useModeStore((state) => state.lastNonLayoutViewMode);

export const warehouseViewModeActions = {
  setViewMode: (viewMode: WarehouseViewMode) => useEditorStore.getState().setViewMode(viewMode),
  setViewStage: (viewStage: WarehouseViewStage) => useModeStore.getState().setViewStage(viewStage),
  setEditorMode: (editorMode: WarehouseEditorMode) => useEditorStore.getState().setEditorMode(editorMode),
  enterLayoutPreview: () => useEditorStore.getState().enterLayoutPreview(),
  startLayoutEditing: () => useEditorStore.getState().startLayoutEditing(),
  finishLayoutEditing: () => useEditorStore.getState().finishLayoutEditing(),
  exitLayout: () => useEditorStore.getState().exitLayout(),
  setLayoutInteractionMode: (mode: WarehouseLayoutInteractionMode) =>
    useModeStore.getState().setLayoutInteractionMode(mode),
  reset: () =>
    useModeStore.setState({
      viewMode: 'view',
      viewStage: 'map',
      editorMode: 'select',
      layoutInteractionMode: 'preview',
      lastNonLayoutViewMode: 'view',
    })
};
