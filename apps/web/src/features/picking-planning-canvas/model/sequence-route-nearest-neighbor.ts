import type { PickingRouteAnchor } from './route-step-geometry';

export type RouteStartCanvasPoint = { x: number; y: number };

function squaredDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function sequencePickingRouteNearestNeighbor(
  anchors: PickingRouteAnchor[],
  options?: { startCanvasPoint?: RouteStartCanvasPoint }
): string[] {
  if (anchors.length === 0) return [];

  const resolved = anchors
    .map((anchor, index) => ({ anchor, index }))
    .filter(
      (
        entry
      ): entry is {
        anchor: Extract<PickingRouteAnchor, { status: 'resolved' }>;
        index: number;
      } => entry.anchor.status === 'resolved'
    );

  if (resolved.length <= 1) {
    return anchors.map((anchor) => anchor.stepId);
  }

  const orderedResolved: Array<(typeof resolved)[number]> = [];
  const visited = new Set<number>();
  const startCanvasPoint = options?.startCanvasPoint;
  let current =
    startCanvasPoint === undefined
      ? resolved[0]!
      : resolved.reduce((best, candidate) => {
          const bestDistance = squaredDistance(best.anchor.point, startCanvasPoint);
          const candidateDistance = squaredDistance(
            candidate.anchor.point,
            startCanvasPoint
          );
          if (
            candidateDistance < bestDistance ||
            (candidateDistance === bestDistance && candidate.index < best.index)
          ) {
            return candidate;
          }
          return best;
        });
  orderedResolved.push(current);
  visited.add(current.index);

  while (orderedResolved.length < resolved.length) {
    let best: (typeof resolved)[number] | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of resolved) {
      if (visited.has(candidate.index)) continue;
      const distance = squaredDistance(current.anchor.point, candidate.anchor.point);
      if (
        distance < bestDistance ||
        (distance === bestDistance && best && candidate.index < best.index)
      ) {
        best = candidate;
        bestDistance = distance;
      }
    }

    if (!best) break;
    orderedResolved.push(best);
    visited.add(best.index);
    current = best;
  }

  const unresolvedStepIds = anchors
    .filter((anchor) => anchor.status === 'unresolved')
    .map((anchor) => anchor.stepId);

  return [
    ...orderedResolved.map((entry) => entry.anchor.stepId),
    ...unresolvedStepIds
  ];
}
