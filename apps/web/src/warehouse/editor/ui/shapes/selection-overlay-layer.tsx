import { useEffect, useMemo, useRef } from 'react';
import type Konva from 'konva';
import { Group, Layer } from 'react-konva';
import type { Cell, Rack } from '@wos/domain';
import { shouldShowFocusedFullAddress } from './rack-label-reveal-policy';
import { FocusedCellAddressOverlay } from './rack-label-overlays';
import { CellHaloOverlay, CellOutlineOverlay } from './rack-cell-overlays';
import { resolveCellVisualState } from './rack-cells-visual-state';
import { getWarehouseSemanticCellPalette } from './warehouse-semantic-canvas-palette';
import {
  recordCanvasKonvaLayerDraw,
  recordCanvasLayerNodeCount,
  recordCanvasComponentRender,
  recordCanvasSelectionOverlayMetrics
} from '../canvas-diagnostics';
import {
  resolveSelectedCellOverlayGeometryForRacks,
  type ResolvedCellOverlayGeometry
} from './rack-cell-geometry';

type Props = {
  selectedCellId: string | null;
  highlightedCellId?: string | null;
  racks: Rack[];
  primarySelectedRackId: string | null;
  selectedRackActiveLevel: number | null;
  publishedCellsById: Map<string, Cell>;
  publishedCellsByStructure: Map<string, Cell>;
  showFocusedFullAddress: boolean;
  isActivelyPanning?: boolean;
};

function countKonvaNodeTree(node: Konva.Node): number {
  const container = node as Konva.Container;
  const children =
    typeof container.getChildren === 'function' ? container.getChildren() : [];
  let count = 1;
  children.forEach((child) => {
    count += countKonvaNodeTree(child);
  });
  return count;
}

export function CellStateOverlayLayer(props: Props) {
  const layerRef = useRef<Konva.Layer | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const diagnosticLayer = layer as Konva.Layer & {
      __wosDrawDiagnosticsWrapped?: boolean;
    };
    if (!diagnosticLayer.__wosDrawDiagnosticsWrapped) {
      const originalDraw = layer.draw.bind(layer);
      const originalBatchDraw = layer.batchDraw.bind(layer);
      layer.draw = (...args: Parameters<Konva.Layer['draw']>) => {
        recordCanvasKonvaLayerDraw('draw', 'cell-state-overlay-layer');
        return originalDraw(...args);
      };
      layer.batchDraw = (...args: Parameters<Konva.Layer['batchDraw']>) => {
        recordCanvasKonvaLayerDraw('batchDraw', 'cell-state-overlay-layer');
        return originalBatchDraw(...args);
      };
      diagnosticLayer.__wosDrawDiagnosticsWrapped = true;
    }

    recordCanvasLayerNodeCount(
      'cell-state-overlay-layer',
      countKonvaNodeTree(layer)
    );
  });

  recordCanvasComponentRender({
    component: 'CellStateOverlayLayer',
    propsKeys: [
      'selectedCellId',
      'highlightedCellId',
      'visibleRackIds',
      'primarySelectedRackId',
      'selectedRackActiveLevel',
      'showFocusedFullAddress',
      'isActivelyPanning'
    ],
    snapshot: {
      selectedCellId: props.selectedCellId,
      highlightedCellId: props.highlightedCellId ?? null,
      visibleRackIds: props.racks.map((rack) => rack.id).join('|'),
      primarySelectedRackId: props.primarySelectedRackId,
      selectedRackActiveLevel: props.selectedRackActiveLevel,
      showFocusedFullAddress: props.showFocusedFullAddress,
      isActivelyPanning: props.isActivelyPanning ?? false
    }
  });

  return (
    <Layer
      ref={layerRef}
      listening={false}
      name="cell-state-overlay-layer"
    >
      <SelectionOverlayLayer {...props} />
    </Layer>
  );
}

export function SelectionOverlayLayer({
  selectedCellId,
  highlightedCellId = null,
  racks,
  primarySelectedRackId,
  selectedRackActiveLevel,
  publishedCellsById,
  publishedCellsByStructure,
  showFocusedFullAddress,
  isActivelyPanning = false
}: Props) {
  const selectedOverlayGeometry = useMemo(
    () =>
      resolveSelectedCellOverlayGeometryForRacks({
        primarySelectedRackId,
        publishedCellsById,
        publishedCellsByStructure,
        racks,
        selectedCellId,
        selectedRackActiveLevel
      }),
    [
      primarySelectedRackId,
      publishedCellsById,
      publishedCellsByStructure,
      racks,
      selectedCellId,
      selectedRackActiveLevel
    ]
  );
  const highlightedOverlayGeometry = useMemo(
    () =>
      resolveSelectedCellOverlayGeometryForRacks({
        primarySelectedRackId,
        publishedCellsById,
        publishedCellsByStructure,
        racks,
        selectedCellId: highlightedCellId,
        selectedRackActiveLevel
      }),
    [
      highlightedCellId,
      primarySelectedRackId,
      publishedCellsById,
      publishedCellsByStructure,
      racks,
      selectedRackActiveLevel
    ]
  );
  const affectedCellIds = new Set<string>();
  if (selectedOverlayGeometry) affectedCellIds.add(selectedOverlayGeometry.cellId);
  if (highlightedOverlayGeometry) {
    affectedCellIds.add(highlightedOverlayGeometry.cellId);
  }
  const affectedCellCount = affectedCellIds.size;

  recordCanvasComponentRender({
    component: 'SelectionOverlayLayer',
    propsKeys: [
      'selectedCellId',
      'highlightedCellId',
      'visibleRackIds',
      'primarySelectedRackId',
      'selectedRackActiveLevel',
      'showFocusedFullAddress',
      'isActivelyPanning'
    ],
    snapshot: {
      selectedCellId,
      highlightedCellId,
      visibleRackIds: racks.map((rack) => rack.id).join('|'),
      primarySelectedRackId,
      selectedRackActiveLevel,
      showFocusedFullAddress,
      isActivelyPanning,
      affectedCellCount,
      selectedResolved: selectedOverlayGeometry !== null,
      highlightedResolved: highlightedOverlayGeometry !== null
    }
  });
  recordCanvasSelectionOverlayMetrics({
    affectedCellCount,
    highlightedCellCount: highlightedOverlayGeometry ? 1 : 0,
    resolved:
      selectedOverlayGeometry !== null || highlightedOverlayGeometry !== null
  });

  if (!selectedOverlayGeometry && !highlightedOverlayGeometry) return null;

  return (
    <SelectionOverlayGeometry
      selectedGeometry={selectedOverlayGeometry}
      highlightedGeometry={highlightedOverlayGeometry}
      showFocusedFullAddress={showFocusedFullAddress}
      isActivelyPanning={isActivelyPanning}
    />
  );
}

function SelectionOverlayGeometry({
  selectedGeometry,
  highlightedGeometry,
  showFocusedFullAddress,
  isActivelyPanning
}: {
  selectedGeometry: ResolvedCellOverlayGeometry | null;
  highlightedGeometry: ResolvedCellOverlayGeometry | null;
  showFocusedFullAddress: boolean;
  isActivelyPanning: boolean;
}) {
  const selectedVisualState = resolveCellVisualState(
    {
      isInteractive: false,
      isWorkflowScope: false,
      isRackPassive: false,
      isRackSelected: false,
      hasCellIdentity: true,
      isSelected: true,
      isFocused: showFocusedFullAddress,
      isLocateTarget: false,
      isWorkflowSource: false,
      isSearchHit: false,
      isOccupiedByFallback: false,
      runtimeStatus: null
    },
    getWarehouseSemanticCellPalette()
  );
  const highlightedVisualState = resolveCellVisualState(
    {
      isInteractive: false,
      isWorkflowScope: false,
      isRackPassive: false,
      isRackSelected: false,
      hasCellIdentity: true,
      isSelected: false,
      isFocused: false,
      isLocateTarget: false,
      isWorkflowSource: false,
      isSearchHit: true,
      isOccupiedByFallback: false,
      runtimeStatus: null
    },
    getWarehouseSemanticCellPalette()
  );
  const shouldRevealAddress =
    showFocusedFullAddress &&
    shouldShowFocusedFullAddress({
      isSelected: true,
      isHighlighted: false,
      isWorkflowSource: false
    });

  return (
    <Group listening={false} name="selection-overlay-layer">
      {highlightedGeometry && (
        <Group
          {...highlightedGeometry.rackTransform}
          listening={false}
          name="selection-overlay-highlight-rack-group"
        >
          <CellHaloOverlay
            geometry={toCellGeometry(highlightedGeometry)}
            visualState={highlightedVisualState}
          />
        </Group>
      )}
      {selectedGeometry && (
        <Group
          {...selectedGeometry.rackTransform}
          listening={false}
          name="selection-overlay-rack-group"
        >
          <CellOutlineOverlay
            geometry={toCellGeometry(selectedGeometry)}
            visualState={selectedVisualState}
            isActivelyPanning={isActivelyPanning}
          />
          {shouldRevealAddress && selectedGeometry.addressText && (
            <FocusedCellAddressOverlay
              addressText={selectedGeometry.addressText}
              geometry={toCellGeometry(selectedGeometry)}
              rackRotationDeg={selectedGeometry.rackTransform.rotation}
            />
          )}
        </Group>
      )}
    </Group>
  );
}

function toCellGeometry(geometry: ResolvedCellOverlayGeometry) {
  return {
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height
  };
}
