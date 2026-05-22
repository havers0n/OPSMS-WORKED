import { describe, expect, it } from 'vitest';
import type { SolvedRouteSegment } from './route-step-geometry';
import { summarizePickingRouteSegments } from './summarize-picking-route-segments';

describe('summarizePickingRouteSegments', () => {
  it('returns empty status for no segments', () => {
    expect(summarizePickingRouteSegments([])).toEqual({
      totalDistanceMetres: 0,
      totalSegments: 0,
      solvedSegments: 0,
      skippedSegments: 0,
      unroutableSegments: 0,
      status: 'empty',
      debugReasons: []
    });
  });

  it('returns ok status when all segments are solved', () => {
    const segments: SolvedRouteSegment[] = [
      {
        status: 'ok',
        fromStepId: 's1',
        toStepId: 's2',
        costMetres: 12.2,
        canvasPoints: [
          { x: 0, y: 0 },
          { x: 10, y: 10 }
        ]
      }
    ];

    expect(summarizePickingRouteSegments(segments)).toMatchObject({
      totalDistanceMetres: 12.2,
      totalSegments: 1,
      solvedSegments: 1,
      skippedSegments: 0,
      unroutableSegments: 0,
      status: 'ok'
    });
  });

  it('returns partial status for mixed solved, skipped, and unroutable segments', () => {
    const segments: SolvedRouteSegment[] = [
      {
        status: 'ok',
        fromStepId: 's1',
        toStepId: 's2',
        costMetres: 6,
        canvasPoints: [
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ]
      },
      {
        status: 'skipped',
        reason: 'unresolved_anchor',
        fromStepId: 's2',
        toStepId: 's3',
        fromCanvasPoint: undefined,
        toCanvasPoint: undefined
      },
      {
        status: 'unroutable',
        solverStatus: 'no_path',
        debugReason: 'end_snap:r1',
        fromStepId: 's3',
        toStepId: 's4',
        fromCanvasPoint: { x: 10, y: 10 },
        toCanvasPoint: { x: 20, y: 10 }
      }
    ];

    expect(summarizePickingRouteSegments(segments)).toEqual({
      totalDistanceMetres: 6,
      totalSegments: 3,
      solvedSegments: 1,
      skippedSegments: 1,
      unroutableSegments: 1,
      status: 'partial',
      debugReasons: ['unresolved_anchor', 'no_path', 'end_snap:r1']
    });
  });

  it('sums total distance across solved segments only', () => {
    const segments: SolvedRouteSegment[] = [
      {
        status: 'ok',
        fromStepId: 's1',
        toStepId: 's2',
        costMetres: 3.5,
        canvasPoints: []
      },
      {
        status: 'ok',
        fromStepId: 's2',
        toStepId: 's3',
        costMetres: 4.25,
        canvasPoints: []
      },
      {
        status: 'unroutable',
        solverStatus: 'end_blocked',
        fromStepId: 's3',
        toStepId: 's4',
        fromCanvasPoint: { x: 0, y: 0 },
        toCanvasPoint: { x: 10, y: 10 }
      }
    ];

    expect(summarizePickingRouteSegments(segments).totalDistanceMetres).toBe(7.75);
  });

  it('extracts debug reasons from unroutable and skipped segments', () => {
    const segments: SolvedRouteSegment[] = [
      {
        status: 'skipped',
        reason: 'unresolved_anchor',
        fromStepId: 's1',
        toStepId: 's2',
        fromCanvasPoint: undefined,
        toCanvasPoint: undefined
      },
      {
        status: 'unroutable',
        solverStatus: 'start_blocked',
        debugReason: 'start_snap:r7,end_snap:r8',
        fromStepId: 's2',
        toStepId: 's3',
        fromCanvasPoint: { x: 10, y: 10 },
        toCanvasPoint: { x: 20, y: 20 }
      }
    ];

    expect(summarizePickingRouteSegments(segments).debugReasons).toEqual([
      'unresolved_anchor',
      'start_blocked',
      'start_snap:r7,end_snap:r8'
    ]);
  });
});
