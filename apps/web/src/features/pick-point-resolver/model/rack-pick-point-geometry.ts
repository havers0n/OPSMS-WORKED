import type {
  CellLike,
  FaceAccessLike,
  PointLike,
  RackFaceLike,
  RackFaceSideLike,
  RackLike
} from './pick-point-types';

const EPSILON = 1e-9;

export type RackBodySize = {
  width: number;
  height: number;
};

export type RackFaceAnchorResult =
  | {
      status: 'ok';
      anchor: PointLike;
      localAnchor: PointLike;
      face: RackFaceLike;
      faceSide: RackFaceSideLike;
    }
  | {
      status: 'missing_geometry';
      reason: string;
    };

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function toRadians(rotationDeg: RackLike['rotationDeg']) {
  return (rotationDeg * Math.PI) / 180;
}

export function getRackBodySize(rack: RackLike): RackBodySize | null {
  if (!isFinitePositive(rack.totalLength) || !isFinitePositive(rack.depth)) {
    return null;
  }

  const faceA = rack.faces?.find((face) => face.side === 'A');
  const faceB = rack.faces?.find((face) => face.side === 'B');
  const faceALength = isFinitePositive(faceA?.faceLength)
    ? faceA.faceLength
    : rack.totalLength;
  const faceBLength =
    rack.kind === 'paired'
      ? isFinitePositive(faceB?.faceLength)
        ? faceB.faceLength
        : rack.totalLength
      : faceALength;

  return {
    width: Math.max(faceALength, faceBLength),
    height: rack.depth
  };
}

export function rotateVector(
  vector: PointLike,
  rotationDeg: RackLike['rotationDeg']
): PointLike {
  if (rotationDeg === 0) return vector;

  const radians = toRadians(rotationDeg);
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);

  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos
  };
}

export function rackLocalPointToWorld(
  rack: RackLike,
  localPoint: PointLike
): PointLike | null {
  const size = getRackBodySize(rack);
  if (!size) return null;

  const center = {
    x: size.width / 2,
    y: size.height / 2
  };
  const rotated = rotateVector(
    {
      x: localPoint.x - center.x,
      y: localPoint.y - center.y
    },
    rack.rotationDeg
  );

  return {
    x: rack.x + center.x + rotated.x,
    y: rack.y + center.y + rotated.y
  };
}

export function rackWorldPointToLocal(
  rack: RackLike,
  worldPoint: PointLike
): PointLike | null {
  const size = getRackBodySize(rack);
  if (!size) return null;

  const center = {
    x: size.width / 2,
    y: size.height / 2
  };
  const unrotated = rotateVector(
    {
      x: worldPoint.x - rack.x - center.x,
      y: worldPoint.y - rack.y - center.y
    },
    ((360 - rack.rotationDeg) % 360) as RackLike['rotationDeg']
  );

  return {
    x: center.x + unrotated.x,
    y: center.y + unrotated.y
  };
}

export function isPointInsideRackBody(
  rack: RackLike,
  point: PointLike,
  epsilon = EPSILON
): boolean {
  const size = getRackBodySize(rack);
  const local = rackWorldPointToLocal(rack, point);
  if (!size || !local) return false;

  return (
    local.x >= -epsilon &&
    local.x <= size.width + epsilon &&
    local.y >= -epsilon &&
    local.y <= size.height + epsilon
  );
}

export function inferRackFaceNormal(
  faceSide: RackFaceSideLike,
  rotationDeg: RackLike['rotationDeg']
): PointLike {
  const localNormal = faceSide === 'A'
    ? { x: 0, y: -1 }
    : { x: 0, y: 1 };

  return rotateVector(localNormal, rotationDeg);
}

export function normalizeFaceAccessNormal(
  faceAccess: FaceAccessLike | undefined
): PointLike | null {
  const normalX = faceAccess?.normalX;
  const normalY = faceAccess?.normalY;

  if (
    typeof normalX !== 'number' ||
    typeof normalY !== 'number' ||
    !Number.isFinite(normalX) ||
    !Number.isFinite(normalY)
  ) {
    return null;
  }

  const length = Math.hypot(normalX, normalY);
  if (length <= EPSILON) return null;

  return {
    x: normalX / length,
    y: normalY / length
  };
}

function getOrderedSections(face: RackFaceLike): RackSectionLike[] {
  const sections = face.sections ?? [];
  const ordered = [...sections].sort((left, right) => {
    const leftOrdinal = left.ordinal ?? Number.MAX_SAFE_INTEGER;
    const rightOrdinal = right.ordinal ?? Number.MAX_SAFE_INTEGER;
    if (leftOrdinal !== rightOrdinal) return leftOrdinal - rightOrdinal;
    return left.id.localeCompare(right.id);
  });

  return face.slotNumberingDirection === 'rtl' ? ordered.reverse() : ordered;
}

type RackSectionLike = NonNullable<RackFaceLike['sections']>[number];
type RackLevelLike = NonNullable<RackSectionLike['levels']>[number];

function getSectionOffsets(
  faceLength: number,
  sections: RackSectionLike[]
): number[] | null {
  const totalLength = sections.reduce((sum, section) => {
    if (!isFinitePositive(section.length)) return Number.NaN;
    return sum + section.length;
  }, 0);

  if (!Number.isFinite(totalLength) || totalLength <= 0) return null;

  const offsets = [0];
  let accumulator = 0;
  for (const section of sections) {
    accumulator += (section.length / totalLength) * faceLength;
    offsets.push(accumulator);
  }

  return offsets;
}

function getOrderedLevels(section: RackSectionLike): RackLevelLike[] {
  return [...(section.levels ?? [])].sort((left, right) => {
    const leftOrdinal = left.ordinal ?? Number.MAX_SAFE_INTEGER;
    const rightOrdinal = right.ordinal ?? Number.MAX_SAFE_INTEGER;
    if (leftOrdinal !== rightOrdinal) return leftOrdinal - rightOrdinal;
    return left.id.localeCompare(right.id);
  });
}

export function resolveRackFaceAnchor(args: {
  rack: RackLike;
  cell: CellLike;
  face: RackFaceLike;
  faceSide: RackFaceSideLike;
}): RackFaceAnchorResult {
  const { rack, cell, face, faceSide } = args;
  const size = getRackBodySize(rack);

  if (!size) {
    return { status: 'missing_geometry', reason: 'Rack body dimensions are invalid.' };
  }

  if (face.enabled === false) {
    return { status: 'missing_geometry', reason: 'Rack face is disabled.' };
  }

  const faceLength = isFinitePositive(face.faceLength)
    ? face.faceLength
    : rack.totalLength;
  if (!isFinitePositive(faceLength)) {
    return { status: 'missing_geometry', reason: 'Rack face length is invalid.' };
  }

  const orderedSections = getOrderedSections(face);
  if (orderedSections.length === 0) {
    return { status: 'missing_geometry', reason: 'Rack face has no sections.' };
  }

  const sectionIndex = orderedSections.findIndex(
    (section) => section.id === cell.rackSectionId
  );
  const section = sectionIndex >= 0 ? orderedSections[sectionIndex] : null;
  if (!section) {
    return { status: 'missing_geometry', reason: 'Cell section is missing from rack face.' };
  }

  const levels = getOrderedLevels(section);
  const level = levels.find((candidate) => candidate.id === cell.rackLevelId);
  if (!level || !Number.isInteger(level.slotCount) || level.slotCount <= 0) {
    return { status: 'missing_geometry', reason: 'Cell level slot geometry is invalid.' };
  }

  const slotIndex = face.slotNumberingDirection === 'rtl'
    ? level.slotCount - cell.slotNo
    : cell.slotNo - 1;
  if (slotIndex < 0 || slotIndex >= level.slotCount) {
    return { status: 'missing_geometry', reason: 'Cell slot number is outside level bounds.' };
  }

  const sectionOffsets = getSectionOffsets(faceLength, orderedSections);
  if (!sectionOffsets) {
    return { status: 'missing_geometry', reason: 'Rack section lengths are invalid.' };
  }

  const sectionX = sectionOffsets[sectionIndex];
  const sectionWidth = sectionOffsets[sectionIndex + 1] - sectionX;
  const slotWidth = sectionWidth / level.slotCount;
  if (!isFinitePositive(sectionWidth) || !isFinitePositive(slotWidth)) {
    return { status: 'missing_geometry', reason: 'Cell slot width is invalid.' };
  }

  const localAnchor = {
    x: sectionX + slotWidth * (slotIndex + 0.5),
    y: faceSide === 'A' ? 0 : size.height
  };
  const anchor = rackLocalPointToWorld(rack, localAnchor);
  if (!anchor) {
    return { status: 'missing_geometry', reason: 'Rack anchor could not be projected.' };
  }

  return {
    status: 'ok',
    anchor,
    localAnchor,
    face,
    faceSide
  };
}
