import { create } from 'zustand';

export type RouteGraphSelection =
  | { type: 'node' | 'edge'; id: string }
  | null;

type RouteGraphCanvasStore = {
  selectedElement: RouteGraphSelection;
  pendingSourceNodeId: string | null;
  setSelectedElement: (selectedElement: RouteGraphSelection) => void;
  setPendingSourceNodeId: (nodeId: string | null) => void;
  clearRouteGraphInteraction: () => void;
};

export const useRouteGraphCanvasStore = create<RouteGraphCanvasStore>((set) => ({
  selectedElement: null,
  pendingSourceNodeId: null,
  setSelectedElement: (selectedElement) => set({ selectedElement }),
  setPendingSourceNodeId: (pendingSourceNodeId) =>
    set({ pendingSourceNodeId }),
  clearRouteGraphInteraction: () =>
    set({ selectedElement: null, pendingSourceNodeId: null })
}));

export const useRouteGraphSelectedElement = () =>
  useRouteGraphCanvasStore((state) => state.selectedElement);

export const useRouteGraphPendingSourceNodeId = () =>
  useRouteGraphCanvasStore((state) => state.pendingSourceNodeId);

export const useSetRouteGraphSelectedElement = () =>
  useRouteGraphCanvasStore((state) => state.setSelectedElement);

export const useSetRouteGraphPendingSourceNodeId = () =>
  useRouteGraphCanvasStore((state) => state.setPendingSourceNodeId);

export const useClearRouteGraphInteraction = () =>
  useRouteGraphCanvasStore((state) => state.clearRouteGraphInteraction);

export function getRouteGraphCanvasSnapshot() {
  const state = useRouteGraphCanvasStore.getState();

  return {
    selectedElement: state.selectedElement,
    pendingSourceNodeId: state.pendingSourceNodeId
  };
}

export const routeGraphCanvasActions = {
  setSelectedElement: (selectedElement: RouteGraphSelection) =>
    useRouteGraphCanvasStore.getState().setSelectedElement(selectedElement),
  setPendingSourceNodeId: (nodeId: string | null) =>
    useRouteGraphCanvasStore.getState().setPendingSourceNodeId(nodeId),
  clearRouteGraphInteraction: () =>
    useRouteGraphCanvasStore.getState().clearRouteGraphInteraction(),
  reset: () =>
    useRouteGraphCanvasStore.setState({
      selectedElement: null,
      pendingSourceNodeId: null
    })
};
