import {
  buildCellStructureKey,
  isRackFaceMirrored,
  resolveRackFaceSections,
  type Cell,
  type Rack,
  type RackFace
} from '@wos/domain';
import {
  getRackGeometry,
  getSectionWidths,
  type CanvasRackGeometry
} from '@/entities/layout-version/lib/canvas-geometry';
import {
  collectRackSemanticLevels,
  resolveSemanticLevelForIndex
} from '@/warehouse/editor/model/storage-level-mapping';

export const MIN_CELL_W = 5;
export const MIN_CELL_H = 4;
export const CELL_INSET = 4;

export type RackCellRectGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RenderedFaceCellGeometry = {
  key: string;
  cell: Cell | null;
  cellId: string | null;
  faceId: string;
  rackId: string;
  sectionId: string;
  levelId: string;
  slotLabel: number;
  geometry: RackCellRectGeometry;
};

export type RackGroupTransform = {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  rotation: 0 | 90 | 180 | 270;
};

export type ResolvedCellOverlayGeometry = {
  cellId: string;
  rackId: string;
  faceId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  addressText: string | null;
  rackTransform: RackGroupTransform;
};

export function getEffectiveRackFaceB(rack: Rack) {
  const faceB = rack.faces.find((face) => face.side === 'B') ?? null;
  return faceB
    ? { ...faceB, sections: resolveRackFaceSections(faceB, rack) }
    : null;
}

export function getRackGroupTransform(
  geometry: CanvasRackGeometry,
  rackRotationDeg: Rack['rotationDeg']
): RackGroupTransform {
  return {
    x: geometry.x + geometry.centerX,
    y: geometry.y + geometry.centerY,
    offsetX: geometry.centerX,
    offsetY: geometry.centerY,
    rotation: rackRotationDeg
  };
}

export function collectRenderedFaceCellGeometries({
  activeLevelIndex,
  bandH,
  bandY,
  face,
  publishedCellsByStructure,
  rackId,
  semanticLevels,
  totalWidth
}: {
  face: RackFace;
  rackId: string;
  totalWidth: number;
  bandY: number;
  bandH: number;
  activeLevelIndex: number | null;
  semanticLevels: number[];
  publishedCellsByStructure: Map<string, Cell>;
}): RenderedFaceCellGeometry[] {
  if (!face.enabled || !face.sections.length) return [];

  const cellH = bandH - CELL_INSET * 2;
  if (cellH < MIN_CELL_H) return [];

  const isRtl = face.slotNumberingDirection === 'rtl';
  const orderedSections = isRtl ? [...face.sections].reverse() : face.sections;
  const sectionOffsets = getSectionWidths(totalWidth, orderedSections);
  const semanticLevel = resolveSemanticLevelForIndex(
    semanticLevels,
    activeLevelIndex
  );
  if (semanticLevel === null) return [];

  const cells: RenderedFaceCellGeometry[] = [];
  orderedSections.forEach((sec, si) => {
    const secX = sectionOffsets[si] ?? 0;
    const secW = (sectionOffsets[si + 1] ?? 0) - secX;
    if (secW < MIN_CELL_W * 2) return;

    const level =
      sec.levels.find((sectionLevel) => sectionLevel.ordinal === semanticLevel) ??
      null;
    if (!level) return;
    const slotCount = level.slotCount;
    if (!slotCount) return;

    const slotW = secW / slotCount;
    if (slotW < MIN_CELL_W) return;

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const slotLabel = isRtl ? slotCount - slotIndex : slotIndex + 1;
      const cell = publishedCellsByStructure.get(
        buildCellStructureKey({
          rackId,
          rackFaceId: face.id,
          rackSectionId: sec.id,
          rackLevelId: level.id,
          slotNo: slotLabel
        })
      );
      const cellX = secX + slotIndex * slotW;
      const cellY = bandY + CELL_INSET;
      const cellW = slotW - 1;
      const geometry = {
        x: cellX + 0.5,
        y: cellY + 0.5,
        width: Math.max(1, cellW),
        height: Math.max(1, cellH - 1)
      };

      cells.push({
        key: `${sec.id}-${level.id}-slot-${slotLabel}`,
        cell: cell ?? null,
        cellId: cell?.id ?? null,
        faceId: face.id,
        rackId,
        sectionId: sec.id,
        levelId: level.id,
        slotLabel,
        geometry
      });
    }
  });

  return cells;
}

export function resolveCellIdFromFacePoint({
  activeLevelIndex,
  bandH,
  bandY,
  face,
  point,
  publishedCellsByStructure,
  rackId,
  semanticLevels,
  totalWidth
}: {
  face: RackFace;
  rackId: string;
  totalWidth: number;
  bandY: number;
  bandH: number;
  activeLevelIndex: number | null;
  semanticLevels: number[];
  point: { x: number; y: number };
  publishedCellsByStructure: Map<string, Cell>;
}): string | null {
  const cells = collectRenderedFaceCellGeometries({
    activeLevelIndex,
    bandH,
    bandY,
    face,
    publishedCellsByStructure,
    rackId,
    semanticLevels,
    totalWidth
  });

  for (const cell of cells) {
    const rect = cell.geometry;
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    ) {
      return cell.cellId;
    }
  }

  return null;
}

export function resolveSelectedCellOverlayGeometry({
  activeLevelIndex,
  publishedCellsById,
  publishedCellsByStructure,
  rack,
  selectedCellId
}: {
  selectedCellId: string | null;
  rack: Rack;
  activeLevelIndex: number | null;
  publishedCellsById: Map<string, Cell>;
  publishedCellsByStructure: Map<string, Cell>;
}): ResolvedCellOverlayGeometry | null {
  if (!selectedCellId) return null;

  const selectedCell = publishedCellsById.get(selectedCellId) ?? null;
  if (!selectedCell || selectedCell.rackId !== rack.id) return null;

  const geometry = getRackGeometry(rack);
  const faceA = rack.faces.find((face) => face.side === 'A') ?? null;
  if (!faceA) return null;

  const effectiveFaceB = getEffectiveRackFaceB(rack);
  const semanticLevels = collectRackSemanticLevels(rack);
  const faceABandH = geometry.isPaired ? geometry.spineY : geometry.height;

  const faceCandidates: Array<{
    face: RackFace;
    totalWidth: number;
    bandY: number;
    bandH: number;
  }> = [
    {
      face: faceA,
      totalWidth: geometry.faceAWidth,
      bandY: 0,
      bandH: faceABandH
    }
  ];

  if (geometry.isPaired && effectiveFaceB) {
    faceCandidates.push({
      face: effectiveFaceB,
      totalWidth: geometry.faceBWidth,
      bandY: geometry.spineY,
      bandH: geometry.height - geometry.spineY
    });
  }

  for (const candidate of faceCandidates) {
    if (candidate.face.id !== selectedCell.rackFaceId) continue;
    const renderedCell = collectRenderedFaceCellGeometries({
      activeLevelIndex,
      bandH: candidate.bandH,
      bandY: candidate.bandY,
      face: candidate.face,
      publishedCellsByStructure,
      rackId: rack.id,
      semanticLevels,
      totalWidth: candidate.totalWidth
    }).find((cell) => cell.cellId === selectedCellId);

    if (!renderedCell) return null;

    return {
      cellId: selectedCellId,
      rackId: rack.id,
      faceId: candidate.face.id,
      x: renderedCell.geometry.x,
      y: renderedCell.geometry.y,
      width: renderedCell.geometry.width,
      height: renderedCell.geometry.height,
      addressText: selectedCell.address?.raw ?? null,
      rackTransform: getRackGroupTransform(geometry, rack.rotationDeg)
    };
  }

  if (
    effectiveFaceB &&
    isRackFaceMirrored(effectiveFaceB) &&
    selectedCell.rackFaceId === effectiveFaceB.id
  ) {
    return null;
  }

  return null;
}

export function resolveSelectedCellOverlayGeometryForRacks({
  primarySelectedRackId,
  publishedCellsById,
  publishedCellsByStructure,
  racks,
  selectedCellId,
  selectedRackActiveLevel
}: {
  selectedCellId: string | null;
  racks: Rack[];
  primarySelectedRackId: string | null;
  selectedRackActiveLevel: number | null;
  publishedCellsById: Map<string, Cell>;
  publishedCellsByStructure: Map<string, Cell>;
}): ResolvedCellOverlayGeometry | null {
  const selectedCell = selectedCellId
    ? publishedCellsById.get(selectedCellId) ?? null
    : null;
  if (!selectedCell) return null;

  const rack = racks.find((candidate) => candidate.id === selectedCell.rackId);
  if (!rack) return null;

  return resolveSelectedCellOverlayGeometry({
    activeLevelIndex:
      rack.id === primarySelectedRackId ? selectedRackActiveLevel : 0,
    publishedCellsById,
    publishedCellsByStructure,
    rack,
    selectedCellId
  });
}
