import {
  synchronizeRackFaceRelationship,
  resolveRackFaceRelationshipMode,
  type LayoutDraft,
  type Rack,
  type RackFace,
  type Wall,
  type Zone
} from '@wos/domain';
import type {
  EditorSelection,
  RackSelectionFocus,
  RackSideFocus
} from './editor-types';
import {
  getRackCanvasRect,
  WORLD_SCALE
} from '../../../entities/layout-version/lib/canvas-geometry';

export function makeRackSelection(
  ids: string[],
  focus: RackSelectionFocus = { type: 'body' }
): EditorSelection {
  return ids.length > 0 ? { type: 'rack', rackIds: ids, focus } : { type: 'none' };
}

export function getRackSelectionFocus(selection: EditorSelection): RackSelectionFocus {
  return selection.type === 'rack'
    ? (selection.focus ?? { type: 'body' })
    : { type: 'body' };
}

export function getSelectedRackIds(selection: EditorSelection): string[] {
  return selection.type === 'rack' ? selection.rackIds : [];
}

export function cloneDraft(draft: LayoutDraft): LayoutDraft {
  return structuredClone(draft);
}

export function canEditDraft(draft: LayoutDraft | null): draft is LayoutDraft {
  return Boolean(draft && draft.state === 'draft');
}

export function updateRackInDraft(draft: LayoutDraft, rackId: string, updater: (rack: Rack) => Rack): LayoutDraft {
  const nextDraft = cloneDraft(draft);
  const rack = nextDraft.racks[rackId];
  nextDraft.racks[rackId] = updater(rack);
  return nextDraft;
}

export function updateZoneInDraft(draft: LayoutDraft, zoneId: string, updater: (zone: Zone) => Zone): LayoutDraft {
  const nextDraft = cloneDraft(draft);
  const zone = nextDraft.zones[zoneId];
  if (!zone) {
    return draft;
  }

  nextDraft.zones[zoneId] = updater(zone);
  return nextDraft;
}

export function updateWallInDraft(draft: LayoutDraft, wallId: string, updater: (wall: Wall) => Wall): LayoutDraft {
  const nextDraft = cloneDraft(draft);
  const wall = nextDraft.walls[wallId];
  if (!wall) {
    return draft;
  }

  nextDraft.walls[wallId] = updater(wall);
  return nextDraft;
}

export function nextSectionOrdinal(face: RackFace) {
  return face.sections.length === 0 ? 1 : Math.max(...face.sections.map((section) => section.ordinal)) + 1;
}

export function nextLevelOrdinal(section: RackFace['sections'][number]) {
  return section.levels.length === 0 ? 1 : Math.max(...section.levels.map((level) => level.ordinal)) + 1;
}

export function newEntityId() {
  return crypto.randomUUID();
}

function roundLength(length: number) {
  return Math.round(length * 1000) / 1000;
}

function lengthsMatch(left: number, right: number) {
  return Math.abs(left - right) < 0.001;
}

export function buildEmptySection(side: 'A' | 'B', ordinal: number, slotCount = 3, length = 2.5) {
  return {
    id: newEntityId(),
    ordinal,
    length,
    levels: [{ id: newEntityId(), ordinal: 1, slotCount }]
  };
}

export function scaleSectionsToLength(sections: RackFace['sections'], targetLength: number) {
  if (sections.length === 0) {
    return sections;
  }

  if (sections.length === 1) {
    return lengthsMatch(sections[0].length, targetLength)
      ? sections
      : [{ ...sections[0], length: roundLength(targetLength) }];
  }

  const currentSum = sections.reduce((sum, section) => sum + section.length, 0);
  if (currentSum <= 0 || lengthsMatch(currentSum, targetLength)) {
    return sections;
  }

  const nextSections = sections.map((section) => ({ ...section }));
  let assigned = 0;

  for (let index = 0; index < nextSections.length; index += 1) {
    if (index === nextSections.length - 1) {
      nextSections[index].length = roundLength(targetLength - assigned);
      continue;
    }

    const scaled = roundLength((sections[index].length / currentSum) * targetLength);
    nextSections[index].length = scaled;
    assigned += scaled;
  }

  return nextSections;
}

export function normalizeRack(rack: Rack): Rack {
  return {
    ...rack,
    faces: rack.faces.map((face) => {
      if (rack.kind === 'single' && face.side === 'B') {
        return {
          ...face,
          relationshipMode: 'independent',
          enabled: false,
          isMirrored: false,
          mirrorSourceFaceId: null,
          faceLength: undefined,
          sections: []
        };
      }

      if (face.side === 'B' && resolveRackFaceRelationshipMode(face) === 'mirrored') {
        return {
          ...synchronizeRackFaceRelationship({
            ...face,
            relationshipMode: 'mirrored'
          }),
          enabled: true,
          faceLength: undefined,
          sections: []
        };
      }

      const faceWithCanonicalMode = synchronizeRackFaceRelationship(face);

      if (faceWithCanonicalMode.sections.length === 0) {
        return faceWithCanonicalMode;
      }

      const expectedLength = faceWithCanonicalMode.faceLength ?? rack.totalLength;
      const nextSections = scaleSectionsToLength(faceWithCanonicalMode.sections, expectedLength);
      return nextSections === faceWithCanonicalMode.sections
        ? faceWithCanonicalMode
        : { ...faceWithCanonicalMode, sections: nextSections };
    })
  };
}

export function normalizeDraft(draft: LayoutDraft) {
  let changed = false;
  const nextDraft = cloneDraft(draft);

  for (const rackId of nextDraft.rackIds) {
    const normalizedRack = normalizeRack(nextDraft.racks[rackId]);
    if (JSON.stringify(normalizedRack) !== JSON.stringify(nextDraft.racks[rackId])) {
      nextDraft.racks[rackId] = normalizedRack;
      changed = true;
    }
  }

  return { draft: nextDraft, changed };
}

export function nextRackDisplayCode(racks: Record<string, Rack>): string {
  const numerics = Object.values(racks)
    .map((r) => parseInt(r.displayCode, 10))
    .filter((n) => !isNaN(n));
  const max = numerics.length > 0 ? Math.max(...numerics) : 0;
  return String(max + 1).padStart(2, '0');
}

export function nextZoneCode(zones: Record<string, Zone>): string {
  const numerics = Object.values(zones)
    .map((zone) => parseInt(zone.code.replace(/^Z/i, ''), 10))
    .filter((value) => !Number.isNaN(value));
  const max = numerics.length > 0 ? Math.max(...numerics) : 0;
  return `Z${String(max + 1).padStart(2, '0')}`;
}

export function clampZoneCoordinate(value: number) {
  return Math.round(value);
}

export function clampZoneSize(value: number) {
  return Math.max(1, Math.round(value));
}

const DEFAULT_ZONE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa'];
const WALL_SIDE_OFFSET = 12;
const MIN_WALL_LENGTH = 1; // minimum wall length in metres

export function buildNewZone(
  zones: Record<string, Zone>,
  rect: { x: number; y: number; width: number; height: number }
): Zone {
  const id = newEntityId();
  const code = nextZoneCode(zones);
  const colorIndex =
    Math.max(0, parseInt(code.replace(/^Z/i, ''), 10) - 1) %
    DEFAULT_ZONE_COLORS.length;

  return {
    id,
    code,
    name: `Zone ${code.replace(/^Z/i, '')}`,
    category: null,
    color: DEFAULT_ZONE_COLORS[colorIndex],
    x: clampZoneCoordinate(rect.x),
    y: clampZoneCoordinate(rect.y),
    width: clampZoneSize(rect.width),
    height: clampZoneSize(rect.height)
  };
}

export function buildNewRack(racks: Record<string, Rack>, x: number, y: number): Rack {
  const rackId = newEntityId();
  const faceAId = newEntityId();
  const faceBId = newEntityId();
  const displayCode = nextRackDisplayCode(racks);
  const totalLength = 5;

  return {
    id: rackId,
    displayCode,
    kind: 'single',
    axis: 'NS',
    x,
    y,
    totalLength,
    depth: 1.2,
    rotationDeg: 0,
    faces: [
      {
        id: faceAId,
        side: 'A',
        enabled: true,
        slotNumberingDirection: 'ltr',
        relationshipMode: 'independent',
        isMirrored: false,
        mirrorSourceFaceId: null,
        sections: [buildEmptySection('A', 1, 3, totalLength)]
      },
      {
        id: faceBId,
        side: 'B',
        enabled: false,
        slotNumberingDirection: 'ltr',
        relationshipMode: 'independent',
        isMirrored: false,
        mirrorSourceFaceId: null,
        sections: []
      }
    ]
  };
}

export function nextWallCode(walls: Record<string, Wall>): string {
  const numerics = Object.values(walls)
    .map((wall) => parseInt(wall.code.replace(/^W/i, ''), 10))
    .filter((value) => !Number.isNaN(value));
  const max = numerics.length > 0 ? Math.max(...numerics) : 0;
  return `W${String(max + 1).padStart(2, '0')}`;
}

function roundWallCoordinate(value: number) {
  return Math.round(value);
}

function getWallOrientation(wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>): 'horizontal' | 'vertical' {
  if (wall.x1 === wall.x2 && wall.y1 !== wall.y2) {
    return 'vertical';
  }

  if (wall.y1 === wall.y2 && wall.x1 !== wall.x2) {
    return 'horizontal';
  }

  const dx = Math.abs(wall.x2 - wall.x1);
  const dy = Math.abs(wall.y2 - wall.y1);
  return dx >= dy ? 'horizontal' : 'vertical';
}

export function normalizeWallGeometry(
  geometry: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>,
  previousWall?: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>
) {
  const orientation = previousWall
    ? getWallOrientation(previousWall)
    : getWallOrientation(geometry);
  const x1 = roundWallCoordinate(geometry.x1);
  const y1 = roundWallCoordinate(geometry.y1);
  const x2 = roundWallCoordinate(geometry.x2);
  const y2 = roundWallCoordinate(geometry.y2);

  if (orientation === 'horizontal') {
    const y =
      previousWall &&
      geometry.y1 === previousWall.y1 &&
      geometry.y2 !== previousWall.y2
        ? y2
        : y1;
    const nextX2 = x2 === x1 ? x1 + MIN_WALL_LENGTH : x2;
    return {
      x1,
      y1: y,
      x2: roundWallCoordinate(nextX2),
      y2: y
    };
  }

  const x =
    previousWall &&
    geometry.x1 === previousWall.x1 &&
    geometry.x2 !== previousWall.x2
      ? x2
      : x1;
  const nextY2 = y2 === y1 ? y1 + MIN_WALL_LENGTH : y2;
  return {
    x1: x,
    y1,
    x2: x,
    y2: roundWallCoordinate(nextY2)
  };
}

function buildWallSeedFromRackSide(
  rack: Rack,
  side: RackSideFocus
): Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'> {
  // getRackCanvasRect returns pixels; convert to metres for domain storage.
  const rPx = getRackCanvasRect(rack);
  const r = {
    x: rPx.x / WORLD_SCALE,
    y: rPx.y / WORLD_SCALE,
    width: rPx.width / WORLD_SCALE,
    height: rPx.height / WORLD_SCALE
  };
  const offsetM = WALL_SIDE_OFFSET / WORLD_SCALE; // px → metres (0.3 m)

  if (side === 'north') {
    const y = Math.max(0, Math.round(r.y - offsetM));
    return normalizeWallGeometry({
      x1: r.x,
      y1: y,
      x2: r.x + Math.max(MIN_WALL_LENGTH, r.width),
      y2: y
    });
  }

  if (side === 'south') {
    const y = Math.round(r.y + r.height + offsetM);
    return normalizeWallGeometry({
      x1: r.x,
      y1: y,
      x2: r.x + Math.max(MIN_WALL_LENGTH, r.width),
      y2: y
    });
  }

  if (side === 'west') {
    const x = Math.max(0, Math.round(r.x - offsetM));
    return normalizeWallGeometry({
      x1: x,
      y1: r.y,
      x2: x,
      y2: r.y + Math.max(MIN_WALL_LENGTH, r.height)
    });
  }

  const x = Math.round(r.x + r.width + offsetM);
  return normalizeWallGeometry({
    x1: x,
    y1: r.y,
    x2: x,
    y2: r.y + Math.max(MIN_WALL_LENGTH, r.height)
  });
}

export function buildNewWallFromRackSide(
  walls: Record<string, Wall>,
  rack: Rack,
  side: RackSideFocus
): Wall {
  const code = nextWallCode(walls);

  return {
    id: newEntityId(),
    code,
    name: `Wall ${code.replace(/^W/i, '')}`,
    wallType: 'generic',
    ...buildWallSeedFromRackSide(rack, side),
    blocksRackPlacement: true
  };
}

/**
 * Builds a new free-form wall from two canvas points (e.g. a click-drag gesture).
 *
 * Applies axis-lock based on the dominant drag direction, grid-snaps coordinates,
 * and rejects gestures that are shorter than MIN_WALL_LENGTH.
 *
 * Returns null when the gesture is too short to produce a valid wall — callers
 * should treat null as a no-op (don't create a wall).
 */
export function buildNewFreeWall(
  walls: Record<string, Wall>,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Wall | null {
  // Inputs are in metres (already snapped to 1 m grid at the interaction layer).
  // Re-snap here as a safety net: round to nearest metre.
  const snapX1 = Math.round(x1);
  const snapY1 = Math.round(y1);
  const snapX2 = Math.round(x2);
  const snapY2 = Math.round(y2);

  const absDx = Math.abs(snapX2 - snapX1);
  const absDy = Math.abs(snapY2 - snapY1);

  let finalX1: number, finalY1: number, finalX2: number, finalY2: number;

  if (absDx >= absDy) {
    // Horizontal — lock Y to start row
    if (absDx < MIN_WALL_LENGTH) return null;
    finalX1 = snapX1;
    finalY1 = snapY1;
    finalX2 = snapX2;
    finalY2 = snapY1;
  } else {
    // Vertical — lock X to start column
    if (absDy < MIN_WALL_LENGTH) return null;
    finalX1 = snapX1;
    finalY1 = snapY1;
    finalX2 = snapX1;
    finalY2 = snapY2;
  }

  const code = nextWallCode(walls);

  return {
    id: newEntityId(),
    code,
    name: `Wall ${code.replace(/^W/i, '')}`,
    wallType: 'generic',
    x1: finalX1,
    y1: finalY1,
    x2: finalX2,
    y2: finalY2,
    blocksRackPlacement: true
  };
}
