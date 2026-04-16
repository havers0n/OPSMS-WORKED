import {
  composeLayoutDraft,
  layoutChangeClassSchema,
  splitLayoutDraft,
  type LayoutChangeClass,
  type LayoutDraft,
  type LayoutLifecycleInfo
} from '@wos/domain';
import type { SaveLayoutDraftPayload } from '../../schemas.js';

function normalizeDraftLayers(layoutDraft: LayoutDraft) {
  const splitDraft = splitLayoutDraft(layoutDraft);

  return {
    rackGeometry: splitDraft.racks
      .map((rack) => ({
        id: rack.id,
        geometry: rack.geometry
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    rackStructure: splitDraft.racks
      .map((rack) => ({
        id: rack.id,
        structure: rack.structure
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    overlays: {
      zones: splitDraft.zones
        .map((zone) => ({
          id: zone.id,
          code: zone.code,
          name: zone.name,
          category: zone.category ?? null,
          color: zone.color,
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      walls: splitDraft.walls
        .map((wall) => ({
          id: wall.id,
          code: wall.code,
          name: wall.name ?? null,
          wallType: wall.wallType ?? null,
          x1: wall.x1,
          y1: wall.y1,
          x2: wall.x2,
          y2: wall.y2,
          blocksRackPlacement: wall.blocksRackPlacement
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
    }
  };
}

function areEqualByCanonicalJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function areRackGeometryLayersEqual(left: LayoutDraft, right: LayoutDraft) {
  const leftSplit = splitLayoutDraft(left);
  const rightSplit = splitLayoutDraft(right);
  const commonRackIds = leftSplit.racks
    .map((rack) => rack.id)
    .filter((rackId) => rightSplit.racks.some((rack) => rack.id === rackId))
    .sort((a, b) => a.localeCompare(b));
  const normalizedLeft = commonRackIds.map((rackId) => ({
    id: rackId,
    geometry: leftSplit.racks.find((rack) => rack.id === rackId)!.geometry
  }));
  const normalizedRight = commonRackIds.map((rackId) => ({
    id: rackId,
    geometry: rightSplit.racks.find((rack) => rack.id === rackId)!.geometry
  }));

  return areEqualByCanonicalJson(normalizedLeft, normalizedRight);
}

export function areRackStructureLayersEqual(left: LayoutDraft, right: LayoutDraft) {
  const normalizedLeft = normalizeDraftLayers(left);
  const normalizedRight = normalizeDraftLayers(right);

  return areEqualByCanonicalJson(normalizedLeft.rackStructure, normalizedRight.rackStructure);
}

export function areOverlayLayersEqual(left: LayoutDraft, right: LayoutDraft) {
  const normalizedLeft = normalizeDraftLayers(left);
  const normalizedRight = normalizeDraftLayers(right);

  return areEqualByCanonicalJson(normalizedLeft.overlays, normalizedRight.overlays);
}

export function buildNormalizedDraftFromSavePayload(
  payload: SaveLayoutDraftPayload,
  lifecycle: LayoutLifecycleInfo
): LayoutDraft {
  return composeLayoutDraft({
    lifecycle,
    racks: payload.racks.map((rack) => ({
      id: rack.id,
      geometry: {
        x: rack.x,
        y: rack.y,
        totalLength: rack.totalLength,
        depth: rack.depth,
        rotationDeg: rack.rotationDeg
      },
      structure: {
        displayCode: rack.displayCode,
        kind: rack.kind,
        axis: rack.axis,
        faces: rack.faces.map((face) => ({
          id: face.id,
          side: face.side,
          enabled: face.enabled,
          slotNumberingDirection: face.slotNumberingDirection,
          relationshipMode: face.relationshipMode ?? (face.isMirrored ? 'mirrored' : 'independent'),
          isMirrored: face.isMirrored,
          mirrorSourceFaceId: face.mirrorSourceFaceId,
          ...(face.faceLength !== undefined ? { faceLength: face.faceLength } : {}),
          sections: face.sections.map((section) => ({
            id: section.id,
            ordinal: section.ordinal,
            length: section.length,
            levels: section.levels.map((level) => ({
              id: level.id,
              ordinal: level.ordinal,
              slotCount: level.slotCount,
              structuralDefaultRole: level.structuralDefaultRole ?? 'none'
            }))
          }))
        }))
      }
    })),
    zones: payload.zones.map((zone) => ({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      category: zone.category ?? null,
      color: zone.color,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height
    })),
    walls: payload.walls.map((wall) => ({
      id: wall.id,
      code: wall.code,
      name: wall.name ?? null,
      wallType: wall.wallType ?? null,
      x1: wall.x1,
      y1: wall.y1,
      x2: wall.x2,
      y2: wall.y2,
      blocksRackPlacement: wall.blocksRackPlacement
    }))
  });
}

export function classifyLayoutDraftChange(
  persistedDraft: LayoutDraft,
  incomingDraft: LayoutDraft
): LayoutChangeClass {
  const geometryChanged = !areRackGeometryLayersEqual(persistedDraft, incomingDraft);
  const structureChanged = !areRackStructureLayersEqual(persistedDraft, incomingDraft);
  const overlaysChanged = !areOverlayLayersEqual(persistedDraft, incomingDraft);

  const changedLayerCount = [geometryChanged, structureChanged, overlaysChanged].filter(Boolean).length;

  if (changedLayerCount === 0) {
    return layoutChangeClassSchema.parse('no_changes');
  }

  if (changedLayerCount > 1) {
    return layoutChangeClassSchema.parse('mixed');
  }

  if (geometryChanged) {
    return layoutChangeClassSchema.parse('geometry_only');
  }

  if (structureChanged) {
    return layoutChangeClassSchema.parse('structure_changed');
  }

  return layoutChangeClassSchema.parse('zones_or_walls_changed');
}
