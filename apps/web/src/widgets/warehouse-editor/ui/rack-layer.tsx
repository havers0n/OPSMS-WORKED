import type { Cell, OperationsCellRuntime, Rack } from '@wos/domain';
import type Konva from 'konva';
import { Group, Layer, Rect } from 'react-konva';
import { getRackGeometry, WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import { getSnapPosition } from '@/entities/layout-version/lib/rack-spacing';
import { collectRackSemanticLevels } from '@/widgets/warehouse-editor/model/storage-level-mapping';
import { RackBody } from './shapes/rack-body';
import { RackCells } from './shapes/rack-cells';
import { getRackLabelRevealPolicy } from './shapes/rack-label-reveal-policy';
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
  zoom: number;
  minRackDistance: number;
  moveSourceCellId: string | null;
  moveSourceRackId: string | null;
  occupiedCellIds: Set<string>;
  publishedCellsByStructure: Map<string, Cell>;
  primarySelectedRackId: string | null;
  rackLookup: Record<string, Rack>;
  racks: Rack[];
  selectedRackActiveLevel: number;
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
  /**
   * V2 Storage focus callbacks — when provided, these replace legacy
   * setSelectedCellId / setSelectedRackIds in storage mode so that the
   * V2 StorageFocusStore becomes the sole writer.
   * Not passed in the legacy/layout path — undefined means use legacy behaviour.
   */
  onV2StorageCellSelect?: (params: { cellId: string; rackId: string }) => void;
  onV2StorageRackSelect?: (params: { rackId: string }) => void;
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
  zoom,
  minRackDistance,
  moveSourceCellId,
  moveSourceRackId,
  occupiedCellIds,
  publishedCellsByStructure,
  primarySelectedRackId,
  rackLookup,
  racks,
  selectedRackActiveLevel,
  selectedRackIds,
  setHighlightedCellIds,
  setHoveredRackId,
  setPlacementMoveTargetCellId,
  setSelectedCellId,
  setSelectedRackId,
  setSelectedRackIds,
  setSnapGuides,
  toggleRackSelection,
  updateRackPosition,
  onV2StorageCellSelect,
  onV2StorageRackSelect,
}: RackLayerProps) {
  const labelRevealPolicy = getRackLabelRevealPolicy({ lod, zoom });

  const handleDragMove = (rackId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!isLayoutEditable) return;

    const node = event.target;
    // node.x() / node.offsetX() are canvas pixels; convert to metres
    const xM = (node.x() - node.offsetX()) / WORLD_SCALE;
    const yM = (node.y() - node.offsetY()) / WORLD_SCALE;

    const rack = rackLookup[rackId];
    const otherRacks = Object.values(rackLookup).filter((item) => item.id !== rackId);
    // getSnapPosition operates in metres; threshold 0.1 m
    const snapInfo = getSnapPosition(rack, xM, yM, otherRacks, minRackDistance);

    if (snapInfo.snappedToX || snapInfo.snappedToY) {
      const finalXM = snapInfo.snappedToX ? snapInfo.snappedX : xM;
      const finalYM = snapInfo.snappedToY ? snapInfo.snappedY : yM;
      setSnapGuides(
        [
          // snap guide positions must be canvas pixels for Konva rendering
          snapInfo.snappedToX && { type: 'x' as const, position: snapInfo.snappedX * WORLD_SCALE },
          snapInfo.snappedToY && { type: 'y' as const, position: snapInfo.snappedY * WORLD_SCALE }
        ].filter(Boolean) as SnapGuide[]
      );
      updateRackPosition(rackId, finalXM, finalYM);
    } else {
      setSnapGuides([]);
      updateRackPosition(rackId, xM, yM);
    }
  };

  /**
   * Rack press handler — defined outside the map (rackId is passed as param).
   * In storage mode: uses V2 callback when provided, else falls back to legacy.
   */
  const handleRackPress = (
    rackId: string,
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    // Defensive guard: explicit cell clicks must not be downgraded into rack clicks.
    // RackCells already cancel bubble, but this keeps rack-first/cell-second semantics stable.
    if ((event as unknown as { cancelBubble?: boolean }).cancelBubble) return;
    event.cancelBubble = true;
    if (!canSelectRack) return;

    if (!isLayoutMode) {
      clearHighlightedCellIds();
      if (isStorageMode) {
        if (onV2StorageRackSelect) {
          // V2: single writer — focus store handles clearing the selected cell
          onV2StorageRackSelect({ rackId });
        } else {
          // Legacy: dual-write to editor store
          setSelectedCellId(null);
          setSelectedRackIds([rackId]);
        }
      } else {
        setSelectedRackIds([rackId]);
      }
      return;
    }

    const pointerEvent = event.evt as unknown as PointerEvent;
    if (pointerEvent.ctrlKey || pointerEvent.metaKey) {
      toggleRackSelection(rackId);
    } else {
      setSelectedRackId(rackId);
    }
  };

  // NOTE: handleCellClick is defined per-rack inside racks.map() so that it
  // has access to rack.id for the V2 onV2StorageCellSelect({ cellId, rackId }) call.
  // This is necessary because RackCells.onCellClick only receives cellId.

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
        const semanticLevels = collectRackSemanticLevels(rack);

        // Per-rack cell click handler: closure captures rack.id for V2 focus store call.
        const handleCellClick = (cellId: string, anchor: { x: number; y: number }) => {
          void anchor;
          if (isStorageMode) {
            if (isWorkflowScope) {
              setPlacementMoveTargetCellId(cellId);
              return;
            }
            if (onV2StorageCellSelect) {
              // V2: single writer — caller (EditorCanvas) resolves level from publishedCellsById
              onV2StorageCellSelect({ cellId, rackId: rack.id });
            } else {
              // Legacy: write to editor store
              setSelectedCellId(cellId);
            }
            return;
          }
          if (isViewMode) {
            setSelectedCellId(cellId);
            setHighlightedCellIds([cellId]);
          }
        };

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
              showRackCode={labelRevealPolicy.showRackCode}
              rackCodeProminence={labelRevealPolicy.rackCodeProminence}
              rackCodePlacement={labelRevealPolicy.rackCodePlacement}
            />

            {lod >= 1 && faceA && (
              <RackSections
                geometry={geometry}
                faceA={faceA}
                faceB={geometry.isPaired ? faceB : null}
                isSelected={isSelected}
                isPassive={isRackPassive}
                showFaceToken={labelRevealPolicy.showFaceToken}
                showSectionNumbers={labelRevealPolicy.showSectionNumbers}
                faceTokenProminence={labelRevealPolicy.faceTokenProminence}
                sectionNumberProminence={labelRevealPolicy.sectionNumberProminence}
                rackRotationDeg={rack.rotationDeg}
              />
            )}

            {(lod >= 2 || (isViewMode && lod >= 1)) && faceA && (
              <RackCells
                geometry={geometry}
                rackId={rack.id}
                faceA={faceA}
                faceB={geometry.isPaired ? faceB : null}
                isSelected={isSelected}
                activeLevelIndex={rack.id === primarySelectedRackId ? selectedRackActiveLevel : 0}
                semanticLevels={semanticLevels}
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
                showCellNumbers={labelRevealPolicy.showCellNumbers}
                cellNumberProminence={labelRevealPolicy.cellNumberProminence}
                showFocusedFullAddress={labelRevealPolicy.showFocusedFullAddress}
                rackRotationDeg={rack.rotationDeg}
              />
            )}
          </Group>
        );
      })}
    </Layer>
  );
}
