import type { Zone } from '@wos/domain';
import type Konva from 'konva';
import { Group, Layer, Rect, Text } from 'react-konva';
import { type CanvasRect, WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';

type ZoneLayerProps = {
  canSelectZone: boolean;
  draftZoneRect: CanvasRect | null;
  getRelativePointerPosition: () => { x: number; y: number } | null;
  isLayoutEditable: boolean;
  selectedZoneId: string | null;
  setSelectedZoneId: (zoneId: string) => void;
  updateZoneRect: (zoneId: string, rect: CanvasRect) => void;
  zoneLookup: Record<string, Zone>;
  zones: Zone[];
};

type ZoneResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

// 1 metre minimum zone size
export const MIN_ZONE_SIZE = 1;

const ZONE_CATEGORY_BADGE: Record<string, string> = {
  generic: 'Generic',
  storage: 'Storage · rack cells',
  staging: 'Staging · direct',
  packing: 'Packing',
  receiving: 'Receiving · direct',
  custom: 'Custom'
};

const ZONE_RESIZE_HANDLE_SIZE = 10;

// Returns pixel offsets (local to the Zone Group) for resize handles
function getZoneResizeHandlePosition(zone: Zone, handle: ZoneResizeHandle) {
  const widthPx = zone.width * WORLD_SCALE;
  const heightPx = zone.height * WORLD_SCALE;
  const points: Record<ZoneResizeHandle, { x: number; y: number }> = {
    nw: { x: 0, y: 0 },
    ne: { x: widthPx, y: 0 },
    sw: { x: 0, y: heightPx },
    se: { x: widthPx, y: heightPx }
  };
  return points[handle];
}

// Returns zone rect in metres, all values snapped to 1 m grid
function resizeZoneFromHandle(
  zone: Zone,
  handle: ZoneResizeHandle,
  pointer: { x: number; y: number }
) {
  // pointer is canvas pixels → convert to metres, snap to 1 m
  const snappedX = Math.round(pointer.x / WORLD_SCALE);
  const snappedY = Math.round(pointer.y / WORLD_SCALE);
  const right = zone.x + zone.width;
  const bottom = zone.y + zone.height;

  switch (handle) {
    case 'nw': {
      const nextX = Math.min(right - MIN_ZONE_SIZE, snappedX);
      const nextY = Math.min(bottom - MIN_ZONE_SIZE, snappedY);
      return {
        x: nextX,
        y: nextY,
        width: right - nextX,
        height: bottom - nextY
      };
    }
    case 'ne': {
      const nextRight = Math.max(zone.x + MIN_ZONE_SIZE, snappedX);
      const nextY = Math.min(bottom - MIN_ZONE_SIZE, snappedY);
      return {
        x: zone.x,
        y: nextY,
        width: nextRight - zone.x,
        height: bottom - nextY
      };
    }
    case 'sw': {
      const nextX = Math.min(right - MIN_ZONE_SIZE, snappedX);
      const nextBottom = Math.max(zone.y + MIN_ZONE_SIZE, snappedY);
      return {
        x: nextX,
        y: zone.y,
        width: right - nextX,
        height: nextBottom - zone.y
      };
    }
    case 'se':
      return {
        x: zone.x,
        y: zone.y,
        width: Math.max(MIN_ZONE_SIZE, snappedX - zone.x),
        height: Math.max(MIN_ZONE_SIZE, snappedY - zone.y)
      };
  }
}

export function ZoneLayer({
  canSelectZone,
  draftZoneRect,
  getRelativePointerPosition,
  isLayoutEditable,
  selectedZoneId,
  setSelectedZoneId,
  updateZoneRect,
  zoneLookup,
  zones
}: ZoneLayerProps) {
  const handleZoneDragMove = (zone: Zone, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!isLayoutEditable) return;

    const node = event.target;
    // node.x()/y() are canvas pixels; convert to metres, snap to 1 m grid
    const x = Math.round(node.x() / WORLD_SCALE);
    const y = Math.round(node.y() / WORLD_SCALE);

    updateZoneRect(zone.id, {
      x,
      y,
      width: zone.width,
      height: zone.height
    });
  };

  const handleZoneResizeDragMove = (
    zone: Zone,
    handle: ZoneResizeHandle,
    event: Konva.KonvaEventObject<DragEvent>
  ) => {
    if (!isLayoutEditable) return;

    const pointer = getRelativePointerPosition();
    if (!pointer) return;

    event.cancelBubble = true;
    updateZoneRect(zone.id, resizeZoneFromHandle(zone, handle, pointer));
  };

  return (
    <Layer>
      {zones.map((zone) => {
        const isSelectedZone = selectedZoneId === zone.id;
        const widthPx = zone.width * WORLD_SCALE;
        const heightPx = zone.height * WORLD_SCALE;

        return (
          <Group
            key={zone.id}
            x={zone.x * WORLD_SCALE}
            y={zone.y * WORLD_SCALE}
            draggable={isLayoutEditable && canSelectZone}
            onMouseDown={(event) => {
              // Only stop propagation in layout mode where zone is selectable.
              // In storage/view modes we must let the event reach the stage so
              // that background-click deselection works correctly.
              if (canSelectZone) {
                event.cancelBubble = true;
              }
            }}
            onClick={(event) => {
              event.cancelBubble = true;
              if (!canSelectZone) return;
              setSelectedZoneId(zone.id);
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              if (!canSelectZone) return;
              setSelectedZoneId(zone.id);
            }}
            onDragStart={() => {
              if (canSelectZone) {
                setSelectedZoneId(zone.id);
              }
            }}
            onDragMove={(event) => handleZoneDragMove(zone, event)}
            onDragEnd={(event) => {
              const currentZone = zoneLookup[zone.id] ?? zone;
              event.target.position({
                x: currentZone.x * WORLD_SCALE,
                y: currentZone.y * WORLD_SCALE
              });
            }}
          >
            <Rect
              x={0}
              y={0}
              width={widthPx}
              height={heightPx}
              fill={zone.color}
              opacity={0.16}
              stroke={isSelectedZone ? '#0f172a' : zone.color}
              strokeWidth={isSelectedZone ? 2 : 1}
              strokeScaleEnabled={false}
              dash={isSelectedZone ? [6, 4] : undefined}
              cornerRadius={8}
            />

            <Text
              x={10}
              y={10}
              width={Math.max(24, widthPx - 20)}
              text={`${zone.name} · ${zone.code}`}
              fontSize={12}
              fontStyle="bold"
              fill="#0f172a"
              ellipsis
              listening={false}
            />

            {zone.category && heightPx > 44 && (
              <Text
                x={10}
                y={27}
                width={Math.max(24, widthPx - 20)}
                text={ZONE_CATEGORY_BADGE[zone.category] ?? zone.category}
                fontSize={10}
                fill="#475569"
                ellipsis
                listening={false}
              />
            )}

            {isSelectedZone &&
              isLayoutEditable &&
              canSelectZone &&
              (['nw', 'ne', 'sw', 'se'] as ZoneResizeHandle[]).map((handle) => {
                const point = getZoneResizeHandlePosition(zone, handle);

                return (
                  <Rect
                    key={`${zone.id}-${handle}`}
                    x={point.x - ZONE_RESIZE_HANDLE_SIZE / 2}
                    y={point.y - ZONE_RESIZE_HANDLE_SIZE / 2}
                    width={ZONE_RESIZE_HANDLE_SIZE}
                    height={ZONE_RESIZE_HANDLE_SIZE}
                    fill="#ffffff"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    strokeScaleEnabled={false}
                    cornerRadius={2}
                    draggable
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                    }}
                    onClick={(event) => {
                      event.cancelBubble = true;
                    }}
                    onDragMove={(event) =>
                      handleZoneResizeDragMove(zone, handle, event)
                    }
                    onDragEnd={(event) => {
                      const currentZone = zoneLookup[zone.id] ?? zone;
                      const pt = getZoneResizeHandlePosition(currentZone, handle);
                      event.target.position({
                        x: pt.x - ZONE_RESIZE_HANDLE_SIZE / 2,
                        y: pt.y - ZONE_RESIZE_HANDLE_SIZE / 2
                      });
                    }}
                  />
                );
              })}
          </Group>
        );
      })}

      {draftZoneRect && (
        <Rect
          x={draftZoneRect.x * WORLD_SCALE}
          y={draftZoneRect.y * WORLD_SCALE}
          width={draftZoneRect.width * WORLD_SCALE}
          height={draftZoneRect.height * WORLD_SCALE}
          fill="#22c55e"
          opacity={0.12}
          stroke="#16a34a"
          strokeWidth={2}
          strokeScaleEnabled={false}
          dash={[6, 4]}
          cornerRadius={8}
        />
      )}
    </Layer>
  );
}
