import {
  useEditorMode,
  useSetViewMode,
  useSetViewStage,
  useViewMode,
  useViewStage
} from '@/widgets/warehouse-editor/model/editor-selectors';
import type {
  EditorMode,
  ViewMode,
  ViewStage
} from '@/widgets/warehouse-editor/model/editor-types';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';

export type WarehouseViewMode = ViewMode;
export type WarehouseViewStage = ViewStage;
export type WarehouseEditorMode = EditorMode;

export const useWarehouseViewMode = useViewMode;
export const useSetWarehouseViewMode = useSetViewMode;
export const useWarehouseViewStage = useViewStage;
export const useSetWarehouseViewStage = useSetViewStage;
export const useWarehouseEditorMode = useEditorMode;

export function getWarehouseViewModeSnapshot() {
  const state = useModeStore.getState();

  return {
    viewMode: state.viewMode,
    viewStage: state.viewStage,
    editorMode: state.editorMode
  };
}

export const warehouseViewModeActions = {
  setViewMode: (viewMode: WarehouseViewMode) => useModeStore.getState().setViewMode(viewMode),
  setViewStage: (viewStage: WarehouseViewStage) => useModeStore.getState().setViewStage(viewStage),
  setEditorMode: (editorMode: WarehouseEditorMode) => useModeStore.getState().setEditorMode(editorMode),
  reset: () =>
    useModeStore.setState({
      viewMode: 'layout',
      viewStage: 'map',
      editorMode: 'select'
    })
};
