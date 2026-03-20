import { Rack } from '@wos/domain';
import { getRackGeometry } from './canvas-geometry';

/**
 * Get bounding box of a rack in world space (metres)
 */
export function getRackBoundingBox(
  rack: Rack
): { minX: number; maxX: number; minY: number; maxY: number } {
  const geometry = getRackGeometry(rack);

  return {
    minX: geometry.x,
    maxX: geometry.x + geometry.width,
    minY: geometry.y,
    maxY: geometry.y + geometry.height,
  };
}

/**
 * Check if two racks overlap (collision detection)
 */
export function checkOverlap(rackA: Rack, rackB: Rack): boolean {
  const boxA = getRackBoundingBox(rackA);
  const boxB = getRackBoundingBox(rackB);

  // No overlap if one is completely to the left, right, above, or below the other
  if (boxA.maxX <= boxB.minX || boxB.maxX <= boxA.minX) return false;
  if (boxA.maxY <= boxB.minY || boxB.maxY <= boxA.minY) return false;

  return true;
}

/**
 * Check if a rack at (x, y) violates minimum distance with any other rack
 */
export function checkMinimumDistance(
  testRack: Rack,
  x: number,
  y: number,
  otherRacks: Rack[],
  minDistance: number
): boolean {
  if (minDistance <= 0) return true; // No constraint if minDistance is 0

  const testBox = getRackBoundingBox({ ...testRack, x, y });

  for (const other of otherRacks) {
    const otherBox = getRackBoundingBox(other);

    // Calculate distance between boxes
    const dx =
      testBox.minX > otherBox.maxX
        ? testBox.minX - otherBox.maxX
        : otherBox.minX > testBox.maxX
          ? otherBox.minX - testBox.maxX
          : 0;

    const dy =
      testBox.minY > otherBox.maxY
        ? testBox.minY - otherBox.maxY
        : otherBox.minY > testBox.maxY
          ? otherBox.minY - testBox.maxY
          : 0;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance - 0.0001) return false; // Violated
  }

  return true;
}

/**
 * Validate if a position is valid with distance constraints
 */
export function validatePositionWithDistance(
  testRack: Rack,
  x: number,
  y: number,
  otherRacks: Rack[],
  minDistance: number
): {
  valid: boolean;
  reason?: string;
  correctedPos?: { x: number; y: number };
} {
  // Check for minimum distance violations
  if (!checkMinimumDistance(testRack, x, y, otherRacks, minDistance)) {
    return {
      valid: false,
      reason: `Position violates minimum distance of ${minDistance.toFixed(2)}m`,
    };
  }

  return { valid: true };
}

/**
 * Align racks to a line (same X or Y coordinate)
 */
export function alignRacksToLine(
  racks: Rack[],
  axis: 'x' | 'y',
  referenceValue: number
): Record<string, { x: number; y: number }> {
  const updates: Record<string, { x: number; y: number }> = {};

  for (const rack of racks) {
    if (axis === 'x') {
      updates[rack.id] = { x: referenceValue, y: rack.y };
    } else {
      updates[rack.id] = { x: rack.x, y: referenceValue };
    }
  }

  return updates;
}

/**
 * Distribute racks equally along an axis with minimum distance
 */
export function distributeRacksEqually(
  racks: Rack[],
  axis: 'x' | 'y',
  minDistance: number,
  canvasScale: { lengthScale: number; depthScale: number } = {
    lengthScale: 28,
    depthScale: 44,
  }
): Record<string, { x: number; y: number }> {
  if (racks.length < 2) {
    // Single rack - no distribution needed
    return Object.fromEntries(racks.map((r) => [r.id, { x: r.x, y: r.y }]));
  }

  const updates: Record<string, { x: number; y: number }> = {};

  // Sort racks by position along the axis
  const sorted = [...racks].sort((a, b) =>
    axis === 'x' ? a.x - b.x : a.y - b.y
  );

  // Calculate spacing: we have N racks with N-1 gaps
  let totalContent = 0;
  for (const rack of sorted) {
    const geo = getRackGeometry(rack);
    if (axis === 'x') {
      totalContent += geo.width;
    } else {
      totalContent += geo.height;
    }
  }

  const totalGaps = (sorted.length - 1) * minDistance;
  const totalSpan = totalContent + totalGaps;

  // Position racks with equal spacing
  let position = sorted[0][axis]; // Start from first rack's position
  for (const rack of sorted) {
    if (axis === 'x') {
      updates[rack.id] = { x: position, y: rack.y };
      const geo = getRackGeometry(rack);
      position += geo.width + minDistance;
    } else {
      updates[rack.id] = { x: rack.x, y: position };
      const geo = getRackGeometry(rack);
      position += geo.height + minDistance;
    }
  }

  return updates;
}

/**
 * Snap a value to the nearest multiple of a distance
 */
export function snapToDistance(value: number, distance: number): number {
  if (distance <= 0) return value;
  return Math.round(value / distance) * distance;
}

/**
 * Get snap target position for a rack being dragged
 * Returns position snapped to distance multiples relative to other racks
 */
export function getSnapPosition(
  testRack: Rack,
  currentX: number,
  currentY: number,
  otherRacks: Rack[],
  minDistance: number,
  snapThreshold: number = 0.5
): {
  snappedX: number;
  snappedY: number;
  snappedToX: boolean;
  snappedToY: boolean;
} {
  let snappedX = currentX;
  let snappedY = currentY;
  let snappedToX = false;
  let snappedToY = false;

  if (minDistance <= 0 || otherRacks.length === 0) {
    return { snappedX, snappedY, snappedToX, snappedToY };
  }

  const testBox = getRackBoundingBox({ ...testRack, x: currentX, y: currentY });

  // Find nearby racks to snap to
  for (const other of otherRacks) {
    const otherBox = getRackBoundingBox(other);

    // Snap to X positions (left/right edges)
    const xDist = Math.min(
      Math.abs(testBox.minX - otherBox.minX),
      Math.abs(testBox.maxX - otherBox.maxX),
      Math.abs(testBox.minX - otherBox.maxX),
      Math.abs(testBox.maxX - otherBox.minX)
    );

    if (xDist < snapThreshold && !snappedToX) {
      if (Math.abs(testBox.minX - otherBox.minX) === xDist) {
        snappedX = currentX - (testBox.minX - otherBox.minX);
      } else if (Math.abs(testBox.maxX - otherBox.maxX) === xDist) {
        snappedX = currentX - (testBox.maxX - otherBox.maxX);
      } else if (Math.abs(testBox.minX - otherBox.maxX) === xDist) {
        snappedX = currentX - (testBox.minX - otherBox.maxX);
      } else if (Math.abs(testBox.maxX - otherBox.minX) === xDist) {
        snappedX = currentX - (testBox.maxX - otherBox.minX);
      }
      snappedToX = true;
    }

    // Snap to Y positions (top/bottom edges)
    const yDist = Math.min(
      Math.abs(testBox.minY - otherBox.minY),
      Math.abs(testBox.maxY - otherBox.maxY),
      Math.abs(testBox.minY - otherBox.maxY),
      Math.abs(testBox.maxY - otherBox.minY)
    );

    if (yDist < snapThreshold && !snappedToY) {
      if (Math.abs(testBox.minY - otherBox.minY) === yDist) {
        snappedY = currentY - (testBox.minY - otherBox.minY);
      } else if (Math.abs(testBox.maxY - otherBox.maxY) === yDist) {
        snappedY = currentY - (testBox.maxY - otherBox.maxY);
      } else if (Math.abs(testBox.minY - otherBox.maxY) === yDist) {
        snappedY = currentY - (testBox.minY - otherBox.maxY);
      } else if (Math.abs(testBox.maxY - otherBox.minY) === yDist) {
        snappedY = currentY - (testBox.maxY - otherBox.minY);
      }
      snappedToY = true;
    }
  }

  return { snappedX, snappedY, snappedToX, snappedToY };
}
