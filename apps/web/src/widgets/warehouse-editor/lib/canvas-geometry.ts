import type { Rack } from '@wos/domain';

export const RACK_LENGTH_SCALE = 28;
export const RACK_DEPTH_SCALE = 40;
export const GRID_SIZE = 40;
export const ROTATE_HANDLE_SIZE = 28;
export const MIN_CANVAS_ZOOM = 0.75;
export const MAX_CANVAS_ZOOM = 1.75;

export type CanvasRackGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  rotateHandleX: number;
  rotateHandleY: number;
};

export function clampCanvasPosition(value: number) {
  return Math.max(0, value);
}

export function clampCanvasZoom(value: number) {
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, value));
}

export function getRackGeometry(rack: Rack): CanvasRackGeometry {
  const width = rack.totalLength * RACK_LENGTH_SCALE;
  const height = rack.depth * RACK_DEPTH_SCALE;

  return {
    x: rack.x,
    y: rack.y,
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    rotateHandleX: width - ROTATE_HANDLE_SIZE - 8,
    rotateHandleY: 8
  };
}
