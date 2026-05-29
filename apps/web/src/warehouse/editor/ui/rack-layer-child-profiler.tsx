import {
  createContext,
  Profiler,
  useContext,
  type PropsWithChildren,
  type ProfilerOnRenderCallback
} from 'react';
import type { RackLayerChildName } from './canvas-diagnostics';
import {
  isCanvasRenderPipelineDiagnosticsEnabled,
  recordRackLayerChildProfiler
} from './canvas-diagnostics';

export type RackLayerRefIdentityChanges = {
  racks_id: boolean;
  cellRuntimeById_id: boolean;
  occupiedCellIds_id: boolean;
  publishedCellsByStructure_id: boolean;
  publishedCellsById_id: boolean;
};

const RackLayerProfilingContext = createContext<RackLayerRefIdentityChanges | null>(null);

export function useRackLayerRefIdentityChanges(): RackLayerRefIdentityChanges | null {
  return useContext(RackLayerProfilingContext);
}

export function RackLayerProfilingContextProvider({
  children,
  refIdentityChanges
}: PropsWithChildren<{ refIdentityChanges: RackLayerRefIdentityChanges }>) {
  return (
    <RackLayerProfilingContext.Provider value={refIdentityChanges}>
      {children}
    </RackLayerProfilingContext.Provider>
  );
}

type RackLayerChildProfilerProps = PropsWithChildren<{
  childName: RackLayerChildName;
  rackId?: string;
}>;

/**
 * Wraps RackLayer child components (RackBody, RackSections, RackCells, SelectionOverlayLayer)
 * with React.Profiler to record render count, duration, and which ref-identity props changed.
 *
 * Only active when render pipeline diagnostics are enabled (diagnostics-only, no production overhead).
 *
 * Records:
 * - Render count per child/subtree
 * - Actual duration (total, max, last)
 * - Which reference-identity props changed (racks_id, cellRuntimeById_id, occupiedCellIds_id, etc.)
 *
 * This helps identify:
 * - Which child subtree is expensive
 * - Whether RackBody/RackSections re-render when only occupiedCellIds changes (static geometry bug)
 * - Whether RackCells re-renders on cellRuntimeById (expected) vs racks_id alone (geometry re-computation)
 */
export function RackLayerChildProfiler({
  childName,
  rackId,
  children
}: RackLayerChildProfilerProps) {
  const diagnosticsEnabled = isCanvasRenderPipelineDiagnosticsEnabled();
  const refChanges = useRackLayerRefIdentityChanges();

  if (!diagnosticsEnabled) {
    return children;
  }

  const onRenderCallback: ProfilerOnRenderCallback = (
    _id,
    _phase,
    actualDuration,
    _startTime,
    _commitTime
  ) => {
    // Identify which ref-identity props changed that affect this child
    const changedRefs: string[] = [];
    if (refChanges) {
      if (refChanges.racks_id) changedRefs.push('racks_id');
      if (refChanges.cellRuntimeById_id) changedRefs.push('cellRuntimeById_id');
      if (refChanges.occupiedCellIds_id) changedRefs.push('occupiedCellIds_id');
      if (refChanges.publishedCellsByStructure_id) changedRefs.push('publishedCellsByStructure_id');
      if (refChanges.publishedCellsById_id) changedRefs.push('publishedCellsById_id');
    }

    recordRackLayerChildProfiler({
      childName,
      rackId,
      actualDurationMs: actualDuration,
      changedProps: changedRefs
    });
  };

  return (
    <Profiler id={rackId ? `${childName}:${rackId}` : childName} onRender={onRenderCallback}>
      {children}
    </Profiler>
  );
}
