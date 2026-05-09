import { describe, expect, it } from 'vitest';
import {
  buildCellStructureKey,
  type Cell,
  type Rack,
  type RackFace
} from '@wos/domain';
import {
  collectRenderedFaceCellGeometries,
  resolveSelectedCellOverlayGeometry,
  resolveSelectedCellOverlayGeometryForRacks
} from './rack-cell-geometry';

function createFace(
  id: string,
  side: 'A' | 'B',
  levelIds: string[],
  options?: {
    slotCount?: number;
    direction?: 'ltr' | 'rtl';
    mirroredFrom?: string;
  }
): RackFace {
  const slotCount = options?.slotCount ?? 2;
  return {
    id,
    side,
    enabled: true,
    slotNumberingDirection: options?.direction ?? 'ltr',
    relationshipMode: options?.mirroredFrom ? 'mirrored' : 'independent',
    isMirrored: Boolean(options?.mirroredFrom),
    mirrorSourceFaceId: options?.mirroredFrom ?? null,
    sections: options?.mirroredFrom
      ? []
      : [
          {
            id: 'section-a',
            ordinal: 1,
            length: 5,
            levels: levelIds.map((levelId, index) => ({
              id: levelId,
              ordinal: levelIds.length - index,
              slotCount
            }))
          }
        ]
  };
}

function createRack(
  id: string,
  kind: 'single' | 'paired',
  faces: RackFace[]
): Rack {
  return {
    id,
    displayCode: id,
    kind,
    axis: 'NS',
    x: 0,
    y: 0,
    totalLength: 5,
    depth: 2,
    rotationDeg: 0,
    faces
  };
}

function createCell(params: {
  id: string;
  rackId: string;
  faceId: string;
  sectionId: string;
  levelId: string;
  slotNo: number;
  level: number;
}): Cell {
  return {
    id: params.id,
    layoutVersionId: 'layout-version-1',
    rackId: params.rackId,
    rackFaceId: params.faceId,
    rackSectionId: params.sectionId,
    rackLevelId: params.levelId,
    slotNo: params.slotNo,
    status: 'active',
    cellCode: params.id,
    address: {
      raw: `ADDR-${params.id}`,
      parts: {
        rackCode: params.rackId,
        face: params.faceId.endsWith('b') ? 'B' : 'A',
        section: 1,
        level: params.level,
        slot: params.slotNo
      },
      sortKey: params.id
    }
  };
}

function indexCells(cells: Cell[]) {
  return {
    byId: new Map(cells.map((cell) => [cell.id, cell])),
    byStructure: new Map(
      cells.map((cell) => [
        buildCellStructureKey({
          rackId: cell.rackId,
          rackFaceId: cell.rackFaceId,
          rackSectionId: cell.rackSectionId,
          rackLevelId: cell.rackLevelId,
          slotNo: cell.slotNo
        }),
        cell
      ])
    )
  };
}

describe('selected cell overlay geometry resolver', () => {
  it('resolves normal Face A cell geometry from the active semantic level', () => {
    const rack = createRack('rack-1', 'single', [
      createFace('face-a', 'A', ['level-only'])
    ]);
    const cell = createCell({
      id: 'cell-a-2',
      rackId: rack.id,
      faceId: 'face-a',
      sectionId: 'section-a',
      levelId: 'level-only',
      slotNo: 2,
      level: 1
    });
    const cells = indexCells([cell]);

    const resolved = resolveSelectedCellOverlayGeometry({
      selectedCellId: cell.id,
      rack,
      activeLevelIndex: 0,
      publishedCellsById: cells.byId,
      publishedCellsByStructure: cells.byStructure
    });

    expect(resolved).toMatchObject({
      cellId: 'cell-a-2',
      rackId: 'rack-1',
      faceId: 'face-a',
      x: 100.5,
      y: 4.5,
      width: 99,
      height: 71,
      addressText: 'ADDR-cell-a-2',
      rackTransform: {
        x: 100,
        y: 40,
        offsetX: 100,
        offsetY: 40,
        rotation: 0
      }
    });
  });

  it('resolves mirrored Face B geometry in the paired face band', () => {
    const faceA = createFace('face-a', 'A', ['level-only']);
    const faceB = createFace('face-b', 'B', ['ignored'], {
      mirroredFrom: faceA.id
    });
    const rack = createRack('rack-1', 'paired', [faceA, faceB]);
    const cell = createCell({
      id: 'cell-b-1',
      rackId: rack.id,
      faceId: faceB.id,
      sectionId: 'section-a',
      levelId: 'level-only',
      slotNo: 1,
      level: 1
    });
    const cells = indexCells([cell]);

    const resolved = resolveSelectedCellOverlayGeometry({
      selectedCellId: cell.id,
      rack,
      activeLevelIndex: 0,
      publishedCellsById: cells.byId,
      publishedCellsByStructure: cells.byStructure
    });

    expect(resolved).toMatchObject({
      cellId: 'cell-b-1',
      faceId: 'face-b',
      x: 0.5,
      y: 44.5,
      width: 99,
      height: 31
    });
  });

  it('returns null when the selected cell is not on the active semantic level', () => {
    const levelIds = ['level-high', 'level-mid', 'level-low'];
    const rack = createRack('rack-1', 'single', [
      createFace('face-a', 'A', levelIds)
    ]);
    const midCell = createCell({
      id: 'cell-mid-1',
      rackId: rack.id,
      faceId: 'face-a',
      sectionId: 'section-a',
      levelId: 'level-mid',
      slotNo: 1,
      level: 2
    });
    const cells = indexCells([midCell]);

    expect(
      resolveSelectedCellOverlayGeometry({
        selectedCellId: midCell.id,
        rack,
        activeLevelIndex: 0,
        publishedCellsById: cells.byId,
        publishedCellsByStructure: cells.byStructure
      })
    ).toBeNull();
    expect(
      resolveSelectedCellOverlayGeometry({
        selectedCellId: midCell.id,
        rack,
        activeLevelIndex: 1,
        publishedCellsById: cells.byId,
        publishedCellsByStructure: cells.byStructure
      })
    ).toMatchObject({
      x: 0.5,
      y: 4.5,
      width: 99,
      height: 71
    });
  });

  it('returns null when the selected cell rack is outside the visible rack set', () => {
    const visibleRack = createRack('rack-1', 'single', [
      createFace('face-a', 'A', ['level-only'])
    ]);
    const hiddenRack = createRack('rack-2', 'single', [
      createFace('face-a', 'A', ['level-only'])
    ]);
    const cell = createCell({
      id: 'cell-hidden',
      rackId: hiddenRack.id,
      faceId: 'face-a',
      sectionId: 'section-a',
      levelId: 'level-only',
      slotNo: 1,
      level: 1
    });
    const cells = indexCells([cell]);

    expect(
      resolveSelectedCellOverlayGeometryForRacks({
        selectedCellId: cell.id,
        racks: [visibleRack],
        primarySelectedRackId: hiddenRack.id,
        selectedRackActiveLevel: 0,
        publishedCellsById: cells.byId,
        publishedCellsByStructure: cells.byStructure
      })
    ).toBeNull();
  });

  it('matches the current FaceCells RTL displayed slot geometry', () => {
    const face = createFace('face-a', 'A', ['level-only'], {
      direction: 'rtl'
    });
    const rack = createRack('rack-1', 'single', [face]);
    const cell = createCell({
      id: 'cell-rtl-slot-2',
      rackId: rack.id,
      faceId: face.id,
      sectionId: 'section-a',
      levelId: 'level-only',
      slotNo: 2,
      level: 1
    });
    const cells = indexCells([cell]);
    const renderedCells = collectRenderedFaceCellGeometries({
      face,
      rackId: rack.id,
      totalWidth: 200,
      bandY: 0,
      bandH: 80,
      activeLevelIndex: 0,
      semanticLevels: [1],
      publishedCellsByStructure: cells.byStructure
    });

    const resolved = resolveSelectedCellOverlayGeometry({
      selectedCellId: cell.id,
      rack,
      activeLevelIndex: 0,
      publishedCellsById: cells.byId,
      publishedCellsByStructure: cells.byStructure
    });

    expect(renderedCells.map((renderedCell) => renderedCell.slotLabel)).toEqual([
      2,
      1
    ]);
    expect(resolved).toMatchObject(renderedCells[0]?.geometry ?? {});
  });
});
