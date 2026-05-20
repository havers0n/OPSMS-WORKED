import type { RouteObstacle, RoutePoint } from './obstacle-types';

const EPSILON = 1e-9;

type SegmentClearPredicate = (
  start: RoutePoint,
  end: RoutePoint,
  obstacles: RouteObstacle[],
  clearanceM: number
) => boolean;

function areSamePoint(left: RoutePoint, right: RoutePoint) {
  return (
    Math.abs(left.x - right.x) < EPSILON &&
    Math.abs(left.y - right.y) < EPSILON
  );
}

function areCollinear(a: RoutePoint, b: RoutePoint, c: RoutePoint) {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(cross) < EPSILON;
}

export function removeDuplicatePoints(points: RoutePoint[]) {
  return points.filter(
    (point, index) => index === 0 || !areSamePoint(points[index - 1]!, point)
  );
}

export function removeRedundantCollinearPoints(points: RoutePoint[]) {
  if (points.length <= 2) return removeDuplicatePoints(points);

  const compact = removeDuplicatePoints(points);
  if (compact.length <= 2) return compact;

  const next: RoutePoint[] = [compact[0]!];

  for (let index = 1; index < compact.length - 1; index += 1) {
    const previous = next[next.length - 1]!;
    const current = compact[index]!;
    const following = compact[index + 1]!;
    if (!areCollinear(previous, current, following)) {
      next.push(current);
    }
  }

  next.push(compact[compact.length - 1]!);
  return next;
}

export function simplifyRouteLineOfSight(
  points: RoutePoint[],
  obstacles: RouteObstacle[],
  clearanceM: number,
  isSegmentClear?: SegmentClearPredicate
) {
  const compact = removeRedundantCollinearPoints(points);
  if (compact.length <= 2 || !isSegmentClear) return compact;

  const simplified: RoutePoint[] = [compact[0]!];
  let anchorIndex = 0;

  while (anchorIndex < compact.length - 1) {
    let nextIndex = anchorIndex + 1;
    for (let candidate = compact.length - 1; candidate > nextIndex; candidate -= 1) {
      if (
        isSegmentClear(
          compact[anchorIndex]!,
          compact[candidate]!,
          obstacles,
          clearanceM
        )
      ) {
        nextIndex = candidate;
        break;
      }
    }

    simplified.push(compact[nextIndex]!);
    anchorIndex = nextIndex;
  }

  return simplified;
}
