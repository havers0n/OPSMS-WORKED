import type {
  CellLike,
  PickPoint,
  PickPointResolution,
  PickPointResolverInput,
  RackFaceLike,
  RackFaceSideLike,
  RackLike
} from './pick-point-types';
import {
  inferRackFaceNormal,
  isPointInsideRackBody,
  normalizeFaceAccessNormal,
  resolveRackFaceAnchor
} from './rack-pick-point-geometry';

export const DEFAULT_PICK_POINT_APPROACH_OFFSET_M = 0.6;

const NON_RACK_LOCATION_TYPES = new Set(['floor', 'staging', 'dock', 'buffer']);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getCellId(location: NonNullable<PickPointResolverInput['location']>) {
  return location.cellId ?? location.geometrySlotId ?? null;
}

function isRackSlotLocation(location: NonNullable<PickPointResolverInput['location']>) {
  return location.locationType === 'rack_slot' || Boolean(getCellId(location));
}

function resolveFace(
  cell: CellLike,
  rack: RackLike,
  facesById: PickPointResolverInput['facesById']
): { face: RackFaceLike | null; faceSide: RackFaceSideLike | null } {
  const face =
    facesById?.get(cell.rackFaceId) ??
    rack.faces?.find((candidate) => candidate.id === cell.rackFaceId) ??
    null;
  const faceSide = face?.side ?? cell.faceSide ?? cell.side ?? null;

  if (faceSide !== 'A' && faceSide !== 'B') {
    return { face, faceSide: null };
  }

  return { face, faceSide };
}

function getResolverConfig(input: PickPointResolverInput) {
  const configuredOffset = input.config?.approachOffsetM;

  return {
    approachOffsetM:
      typeof configuredOffset === 'number' &&
      Number.isFinite(configuredOffset) &&
      configuredOffset >= 0
        ? configuredOffset
        : DEFAULT_PICK_POINT_APPROACH_OFFSET_M
  };
}

export function resolvePickPoint(input: PickPointResolverInput): PickPointResolution {
  const { location } = input;
  if (!location) {
    return {
      status: 'missing_location',
      reason: 'Location is required to resolve a pick point.'
    };
  }

  const cellId = getCellId(location);
  if (!isRackSlotLocation(location)) {
    const floorX = location.floorX;
    const floorY = location.floorY;
    if (isFiniteNumber(floorX) && isFiniteNumber(floorY)) {
      return {
        status: 'ok',
        pickPoint: {
          x: floorX,
          y: floorY,
          locationId: location.id,
          source: 'non_rack_location'
        }
      };
    }

    if (
      location.locationType === undefined ||
      !NON_RACK_LOCATION_TYPES.has(location.locationType)
    ) {
      return {
        status: 'unsupported_location_type',
        reason: `Location type ${location.locationType ?? 'unknown'} cannot be resolved without rack-slot or floor geometry.`
      };
    }

    return {
      status: 'missing_geometry',
      reason: 'Non-rack location is missing finite floorX/floorY coordinates.'
    };
  }

  if (!cellId) {
    return {
      status: 'missing_geometry',
      reason: 'Rack-slot location is missing a cell id.'
    };
  }

  const cell = input.cellsById.get(cellId);
  if (!cell) {
    return {
      status: 'missing_geometry',
      reason: `Cell ${cellId} was not found.`
    };
  }

  const rack = input.racksById.get(cell.rackId);
  if (!rack) {
    return {
      status: 'missing_geometry',
      reason: `Rack ${cell.rackId} was not found.`
    };
  }

  const { face: rackFace, faceSide } = resolveFace(cell, rack, input.facesById);
  if (!faceSide) {
    return {
      status: 'missing_geometry',
      reason: `Face side for cell face ${cell.rackFaceId} could not be determined.`
    };
  }

  if (!rackFace) {
    return {
      status: 'missing_geometry',
      reason: `Rack face ${cell.rackFaceId} was not found.`
    };
  }

  const anchorResult = resolveRackFaceAnchor({
    rack,
    cell,
    face: rackFace,
    faceSide
  });

  if (anchorResult.status !== 'ok') {
    return anchorResult;
  }

  const { approachOffsetM } = getResolverConfig(input);
  const faceAccess = input.faceAccessByFaceId?.get(cell.rackFaceId);
  const faceAccessNormal = normalizeFaceAccessNormal(faceAccess);
  const inferredNormal = inferRackFaceNormal(faceSide, rack.rotationDeg);
  const normal = faceAccessNormal ?? inferredNormal;
  const source: PickPoint['source'] = faceAccessNormal
    ? 'rack_face_access'
    : 'rack_face_inferred';
  const pickPoint = {
    x: anchorResult.anchor.x + normal.x * approachOffsetM,
    y: anchorResult.anchor.y + normal.y * approachOffsetM,
    locationId: location.id,
    source,
    cellId,
    rackId: rack.id,
    faceId: cell.rackFaceId
  } satisfies PickPoint;

  if (isPointInsideRackBody(rack, pickPoint)) {
    if (faceAccessNormal) {
      return {
        status: 'ambiguous_face_access',
        reason: `Face access normal for face ${cell.rackFaceId} projects the pick point inside the rack body.`
      };
    }

    return {
      status: 'missing_geometry',
      reason: 'Inferred face normal projects the pick point inside the rack body.'
    };
  }

  return {
    status: 'ok',
    pickPoint
  };
}
