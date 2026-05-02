import { useRef } from 'react';
import { useCameraStore } from './camera-store';
import {
  type CanvasInteractionLevel,
  type CanvasLOD,
  getCanvasInteractionLevel,
  getCanvasLOD,
} from '../../../entities/layout-version/lib/canvas-geometry';

export type SemanticZoom = {
  /** Current level-of-detail: 0 = block only, 1 = sections, 2 = cells */
  lod: CanvasLOD;
  /** Coarser interaction bucket derived from lod: L1 (rack-level) or L3 (cell-level) */
  interactionLevel: CanvasInteractionLevel;
};

/**
 * Derives the current semantic zoom level from the camera zoom.
 *
 * Responsibilities of this hook:
 *   - read zoom from useCameraStore (no other store dependencies)
 *   - apply hysteresis via prevLodRef to prevent flickering at boundaries
 *   - return lod + interactionLevel as a stable pair
 *
 * Deliberately knows nothing about editor mode, selection, or interaction
 * flow — those concerns live in useCanvasSceneModel.
 */
export function useSemanticZoom(): SemanticZoom {
  const zoom = useCameraStore((s) => s.zoom);
  const prevLodRef = useRef<CanvasLOD>(0);
  const lod = getCanvasLOD(zoom, prevLodRef.current);
  prevLodRef.current = lod;
  return { lod, interactionLevel: getCanvasInteractionLevel(lod) };
}
