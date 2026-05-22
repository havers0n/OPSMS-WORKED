import type { SolvedRouteSegment } from './route-step-geometry';

export type PickingRouteDiagnosticsSummary = {
  totalDistanceMetres: number;
  totalSegments: number;
  solvedSegments: number;
  skippedSegments: number;
  unroutableSegments: number;
  status: 'empty' | 'ok' | 'partial';
  debugReasons: string[];
};

export function summarizePickingRouteSegments(
  segments: SolvedRouteSegment[]
): PickingRouteDiagnosticsSummary {
  const solvedSegments = segments.filter((segment) => segment.status === 'ok');
  const skippedSegments = segments.filter((segment) => segment.status === 'skipped');
  const unroutableSegments = segments.filter((segment) => segment.status === 'unroutable');

  const totalDistanceMetres = solvedSegments.reduce(
    (sum, segment) => sum + segment.costMetres,
    0
  );

  const debugReasons = segments.flatMap((segment) => {
    const details: string[] = [];

    if (segment.status === 'unroutable') {
      details.push(segment.solverStatus);
      if (segment.debugReason) details.push(segment.debugReason);
      return details;
    }

    if (segment.status === 'skipped') {
      details.push(segment.reason);
    }

    return details;
  });

  const status: PickingRouteDiagnosticsSummary['status'] =
    segments.length === 0
      ? 'empty'
      : skippedSegments.length === 0 && unroutableSegments.length === 0
        ? 'ok'
        : 'partial';

  return {
    totalDistanceMetres,
    totalSegments: segments.length,
    solvedSegments: solvedSegments.length,
    skippedSegments: skippedSegments.length,
    unroutableSegments: unroutableSegments.length,
    status,
    debugReasons
  };
}
