import type { Cell, OperationsCellRuntime, Rack } from '@wos/domain';
import type Konva from 'konva';
import { Group, Layer, Rect } from 'react-konva';
import {
  clampCanvasPosition,
  getRackGeometry
} from '../lib/canvas-geometry';
import { getSnapPosition } from '../lib/rack-spacing';
import { RackBody } from './shapes/rack-body';
import { RackCells } from './shapes/rack-cells';
import { RackSections } from './shapes/rack-sections';

type SnapGuide = {
  type: 'x' | 'y';
  position: number;
};

type RackLayerProps = {
  activeCellRackId: string | null;
  canSelectCells: boolean;
  canSelectRack: boolean;
  canvasSelectedCellId: string | null;
  cellRuntimeById: Map<string, OperationsCellRuntime>;
  clearHighlightedCellIds: () => void;
  highlightedCellIds: Set<string>;
  hoveredRackId: string | null;
  isLayoutEditable: boolean;
  isLayoutMode: boolean;
  isPlacing: boolean;
  isRackPassiveScopeActive: boolean;
  isStorageMode: boolean;
  isViewMode: boolean;
  isWorkflowScope: boolean;
  lod: 0 | 1 | 2;
  minRackDistance: number;
  moveSourceCellId: string | null;
  moveSourceRackId: string | null;
  occupiedCellIds: Set<string>;
  publishedCellsByStructure: Map<string, Cell>;
  rackLookup: Record<string, Rack>;
  racks: Rack[];
  selectedRackIds: string[];
  setHighlightedCellIds: (cellIds: string[]) => void;
  setHoveredRackId: (rackId: string | null) => void;
  setPlacementMoveTargetCellId: (cellId: string | null) => void;
  setSelectedCellId: (cellId: string | null) => void;
  setSelectedRackId: (rackId: string | null) => void;
  setSelectedRackIds: (rackIds: string[]) => void;
  setSnapGuides: (guides: SnapGuide[]) => void;
  toggleRackSelection: (rackId: string) => void;
  updateRackPosition: (rackId: string, x: number, y: number) => void;
};

export function RackLayer({
  activeCellRackId,
  canSelectCells,
  canSelectRack,
  canvasSelectedCellId,
  cellRuntimeById,
  clearHighlightedCellIds,
  highlightedCellIds,
  hoveredRackId,
  isLayoutEditable,
  isLayoutMode,
  isPlacing,
  isRackPassiveScopeActive,
  isStorageMode,
  isViewMode,
  isWorkflowScope,
  lod,
  minRackDistance,
  moveSourceCellId,
  moveSourceRackId,
  occupiedCellIds,
  publishedCellsByStructure,
  rackLookup,
  racks,
  selectedRackIds,
  setHighlightedCellIds,
  setHoveredRackId,
  setPlacementMoveTargetCellId,
  setSelectedCellId,
  setSelectedRackId,
  setSelectedRackIds,
  setSnapGuides,
  toggleRackSelection,
  updateRackPosition
}: RackLayerProps) {
  const handleDragMove = (rackId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!isLayoutEditable) return;

    const node = event.target;
    let x = clampCanvasPosition(node.x() - node.offsetX());
    let y = clampCanvasPosition(node.y() - node.offsetY());

    const rack = rackLookup[rackId];
    const otherRacks = Object.values(rackLookup).filter((item) => item.id !== rackId);
    const snapInfo = getSnapPosition(rack, x, y, otherRacks, minRackDistance, 0.5);

    if (snapInfo.snappedToX || snapInfo.snappedToY) {
      x = snapInfo.snappedX;
      y = snapInfo.snappedY;
      setSnapGuides(
        [
          snapInfo.snappedToX && { type: 'x' as const, position: x },
          snapInfo.snappedToY && { type: 'y' as const, position: y }
        ].filter(Boolean) as SnapGuide[]
      );
    } else {
      setSnapGuides([]);
    }

    updateRackPosition(rackId, x, y);
  };

  const handleCellClick = (cellId: string, anchor: { x: number; y: number }) => {
    void anchor;

    if (isStorageMode) {
      if (isWorkflowScope) {
        setPlacementMoveTargetCellId(cellId);
        return;
      }

      setSelectedCellId(cellId);
      return;
    }

    if (isViewMode) {
      setSelectedCellId(cellId);
      setHighlightedCellIds([cellId]);
    }
  };

  const handleRackPress = (
    rackId: string,
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    event.cancelBubble = true;
    if (!canSelectRack) return;

    if (!isLayoutMode) {
      clearHighlightedCellIds();
      setSelectedRackIds([rackId]);
      return;
    }

    const pointerEvent = event.evt as unknown as PointerEvent;
    if (pointerEvent.ctrlKey || pointerEvent.metaKey) {
      toggleRackSelection(rackId);
    } else {
      setSelectedRackId(rackId);
    }
  };

  return (
    <Layer>
      {racks.map((rack) => {
        const geometry = getRackGeometry(rack);
        const isSelected = selectedRackIds.includes(rack.id);
        const isHovered = hoveredRackId === rack.id;
        const isRackPassive =
          isRackPassiveScopeActive &&
          !isSelected &&
          activeCellRackId !== rack.id &&
          moveSourceRackId !== rack.id;
        const faceA = rack.faces.find((face) => face.side === 'A') ?? null;
        const faceB = rack.faces.find((face) => face.side === 'B') ?? null;

        return (
          <Group
            key={rack.id}
            x={geometry.x + geometry.centerX}
            y={geometry.y + geometry.centerY}
            offsetX={geometry.centerX}
            offsetY={geometry.centerY}
            rotation={rack.rotationDeg}
            draggable={isLayoutEditable && !isPlacing}
            onMouseDown={(event) => {
              // Prevent Stage onMouseDown from starting a marquee when clicking a rack.
              event.cancelBubble = true;
            }}
            onClick={(event) => handleRackPress(rack.id, event)}
            onTap={(event) => handleRackPress(rack.id, event)}
            onMouseEnter={() => {
              if (canSelectRack) setHoveredRackId(rack.id);
            }}
            onMouseLeave={() => {
              if (canSelectRack) setHoveredRackId(null);
            }}
            onDragStart={() => {
              if (isLayoutEditable && !selectedRackIds.includes(rack.id)) {
                setSelectedRackIds([rack.id]);
              }
            }}
            onDragMove={(event) => handleDragMove(rack.id, event)}
            onDragEnd={(event) => {
              setSnapGuides([]);
              const node = event.target;
              const currentRack = rackLookup[rack.id];
              if (currentRack) {
                const geometry = getRackGeometry(currentRack);
                node.position({
                  x: geometry.x + geometry.centerX,
                  y: geometry.y + geometry.centerY
                });
              }
            }}
          >
            <Rect
              x={0}
              y={0}
              width={geometry.width}
              height={geometry.height}
              fill="transparent"
            />

            <RackBody
              geometry={geometry}
              displayCode={rack.displayCode}
              rotationDeg={rack.rotationDeg}
              isSelected={isSelected}
              isHovered={isHovered}
              isPassive={isRackPassive}
              lod={lod}
            />

            {lod >= 1 && faceA && (
              <RackSections
                geometry={geometry}
                faceA={faceA}
                faceB={geometry.isPaired ? faceB : null}
                isSelected={isSelected}
                isPassive={isRackPassive}
              />
            )}

            {(lod >= 2 || (isViewMode && lod >= 1)) && faceA && (
              <RackCells
                geometry={geometry}
                rackId={rack.id}
                faceA={faceA}
                faceB={geometry.isPaired ? faceB : null}
                isSelected={isSelected}
                publishedCellsByStructure={publishedCellsByStructure}
                occupiedCellIds={occupiedCellIds}
                cellRuntimeById={cellRuntimeById}
                highlightedCellIds={highlightedCellIds}
                isInteractive={canSelectCells}
                isWorkflowScope={isWorkflowScope}
                isPassive={isRackPassive}
                selectedCellId={canvasSelectedCellId}
                workflowSourceCellId={moveSourceCellId}
                onCellClick={handleCellClick}
              />
            )}
          </Group>
        );
      })}
    </Layer>
  );
}
