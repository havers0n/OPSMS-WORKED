import { useMemo } from 'react';
import { Group } from 'react-konva';
import type { Cell, Rack } from '@wos/domain';
import { shouldShowFocusedFullAddress } from './rack-label-reveal-policy';
import { FocusedCellAddressOverlay } from './rack-label-overlays';
import { CellOutlineOverlay } from './rack-cell-overlays';
import { resolveCellVisualState } from './rack-cells-visual-state';
import { getWarehouseSemanticCellPalette } from './warehouse-semantic-canvas-palette';
import {
  recordCanvasComponentRender,
  recordCanvasSelectionOverlayMetrics
} from '../canvas-diagnostics';
import {
  resolveSelectedCellOverlayGeometryForRacks,
  type ResolvedCellOverlayGeometry
} from './rack-cell-geometry';

type Props = {
  selectedCellId: string | null;
  racks: Rack[];
  primarySelectedRackId: string | null;
  selectedRackActiveLevel: number | null;
  publishedCellsById: Map<string, Cell>;
  publishedCellsByStructure: Map<string, Cell>;
  showFocusedFullAddress: boolean;
  isActivelyPanning?: boolean;
};

export function SelectionOverlayLayer({
  selectedCellId,
  racks,
  primarySelectedRackId,
  selectedRackActiveLevel,
  publishedCellsById,
  publishedCellsByStructure,
  showFocusedFullAddress,
  isActivelyPanning = false
}: Props) {
  const overlayGeometry = useMemo(
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
  const affectedCellCount = overlayGeometry ? 1 : 0;

  recordCanvasComponentRender({
    component: 'SelectionOverlayLayer',
    propsKeys: [
      'selectedCellId',
      'visibleRackIds',
      'primarySelectedRackId',
      'selectedRackActiveLevel',
      'showFocusedFullAddress',
      'isActivelyPanning'
    ],
    snapshot: {
      selectedCellId,
      visibleRackIds: racks.map((rack) => rack.id).join('|'),
      primarySelectedRackId,
      selectedRackActiveLevel,
      showFocusedFullAddress,
      isActivelyPanning,
      affectedCellCount,
      resolved: overlayGeometry !== null
    }
  });
  recordCanvasSelectionOverlayMetrics({
    affectedCellCount,
    resolved: overlayGeometry !== null
  });

  if (!overlayGeometry) return null;

  return (
    <SelectionOverlayGeometry
      geometry={overlayGeometry}
      showFocusedFullAddress={showFocusedFullAddress}
      isActivelyPanning={isActivelyPanning}
    />
  );
}

function SelectionOverlayGeometry({
  geometry,
  showFocusedFullAddress,
  isActivelyPanning
}: {
  geometry: ResolvedCellOverlayGeometry;
  showFocusedFullAddress: boolean;
  isActivelyPanning: boolean;
}) {
  const cellGeometry = {
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height
  };
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
  const shouldRevealAddress =
    showFocusedFullAddress &&
    shouldShowFocusedFullAddress({
      isSelected: true,
      isHighlighted: false,
      isWorkflowSource: false
    });

  return (
    <Group listening={false} name="selection-overlay-layer">
      <Group
        {...geometry.rackTransform}
        listening={false}
        name="selection-overlay-rack-group"
      >
        <CellOutlineOverlay
          geometry={cellGeometry}
          visualState={selectedVisualState}
          isActivelyPanning={isActivelyPanning}
        />
        {shouldRevealAddress && geometry.addressText && (
          <FocusedCellAddressOverlay
            addressText={geometry.addressText}
            geometry={cellGeometry}
            rackRotationDeg={geometry.rackTransform.rotation}
          />
        )}
      </Group>
    </Group>
  );
}
