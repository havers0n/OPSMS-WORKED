import { create } from 'zustand';

type CameraStore = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  setZoom: (zoom: number) => void;
  setOffset: (x: number, y: number) => void;
  /** Atomically updates zoom and pan offset in a single store write. */
  setCamera: (zoom: number, x: number, y: number) => void;
};

export const useCameraStore = create<CameraStore>((set) => ({
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  setZoom: (zoom) => set({ zoom }),
  setOffset: (x, y) => set({ offsetX: x, offsetY: y }),
  setCamera: (zoom, x, y) => set({ zoom, offsetX: x, offsetY: y }),
}));
