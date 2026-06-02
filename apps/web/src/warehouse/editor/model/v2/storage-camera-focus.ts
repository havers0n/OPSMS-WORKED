import type { Cell, Rack } from '@wos/domain'
import type { StorageCameraFocusRequest } from './storage-focus-store'
import {
  clampCanvasZoom,
  getCellCanvasRect,
  getRackCanvasRect,
  LOD_CELL_ENTRY,
  type CanvasViewport,
  type CanvasZoomBounds,
} from '@/entities/layout-version/lib/canvas-geometry'

export type StorageCameraTarget = {
  zoom: number
  offsetX: number
  offsetY: number
}

/**
 * Resolve a camera focus request into a {zoom, offsetX, offsetY} target.
 *
 * Fallback chain:
 *   1. Cell rect center (with LOD_CELL_ENTRY zoom forcing)
 *   2. Rack rect center (no zoom forcing)
 *   3. null (rack not found)
 */
export function resolveStorageCameraTarget(
  request: StorageCameraFocusRequest,
  racks: Rack[],
  publishedCellsById: Map<string, Cell>,
  viewport: CanvasViewport,
  currentZoom: number,
  zoomBounds?: Partial<CanvasZoomBounds>,
): StorageCameraTarget | null {
  if (viewport.width <= 0 || viewport.height <= 0) return null

  const rack = racks.find((r) => r.id === request.rackId)
  if (!rack) return null

  // 1. Cell target — center cell in viewport, force LOD_CELL_ENTRY
  const cell = publishedCellsById.get(request.cellId)
  if (cell) {
    const cellRect = getCellCanvasRect(rack, {
      rackId: cell.rackId,
      rackFaceId: cell.rackFaceId,
      rackSectionId: cell.rackSectionId,
      rackLevelId: cell.rackLevelId,
      slotNo: cell.slotNo,
    })
    if (cellRect) {
      const centerX = cellRect.x + cellRect.width / 2
      const centerY = cellRect.y + cellRect.height / 2
      const targetZoom = clampCanvasZoom(
        Math.max(currentZoom, LOD_CELL_ENTRY),
        zoomBounds,
      )
      return {
        zoom: targetZoom,
        offsetX: viewport.width / 2 - centerX * targetZoom,
        offsetY: viewport.height / 2 - centerY * targetZoom,
      }
    }
  }

  // 2. Rack fallback — center rack in viewport, keep current zoom
  const rackRect = getRackCanvasRect(rack)
  const centerX = rackRect.x + rackRect.width / 2
  const centerY = rackRect.y + rackRect.height / 2
  const targetZoom = clampCanvasZoom(currentZoom, zoomBounds)
  return {
    zoom: targetZoom,
    offsetX: viewport.width / 2 - centerX * targetZoom,
    offsetY: viewport.height / 2 - centerY * targetZoom,
  }
}
