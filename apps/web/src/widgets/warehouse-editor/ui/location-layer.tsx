/**
 * LocationLayer — canvas layer for non-rack floor locations in storage mode.
 *
 * Shows a diamond marker per positioned non-rack location (both occupied and empty).
 * Occupied locations render as filled diamonds; empty ones render as hollow outlines.
 * Positions come from explicit floor_x / floor_y stored on each location row.
 */
import type { LocationType } from '@wos/domain';
import { Group, Layer, Line, Rect, Text } from 'react-konva';
import { WORLD_SCALE } from '../lib/canvas-geometry';

export type NonRackLocationMarker = {
  locationId: string;
  locationCode: string;
  locationType: LocationType;
  x: number;
  y: number;
  containerCount: number;
};

type LocationLayerProps = {
  markers: NonRackLocationMarker[];
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string) => void;
};

const LOCATION_TYPE_COLOR: Record<LocationType, string> = {
  rack_slot: '#94a3b8',
  floor: '#22c55e',
  staging: '#f59e0b',
  dock: '#3b82f6',
  buffer: '#a855f7'
};

const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  rack_slot: 'Rack',
  floor: 'Floor',
  staging: 'Staging',
  dock: 'Dock',
  buffer: 'Buffer'
};

const MARKER_HALF = 10; // half-size of the diamond in canvas pixels (pre-zoom)

/** Returns the 4 corner points of a diamond centred at (0, 0). */
const DIAMOND_POINTS = [
  0, -MARKER_HALF,
  MARKER_HALF, 0,
  0, MARKER_HALF,
  -MARKER_HALF, 0
];

export function LocationLayer({
  markers,
  selectedLocationId,
  setSelectedLocationId
}: LocationLayerProps) {
  if (markers.length === 0) return null;

  return (
    <Layer>
      {markers.map((marker) => {
        const cx = marker.x * WORLD_SCALE;
        const cy = marker.y * WORLD_SCALE;
        const isSelected = selectedLocationId === marker.locationId;
        const color = LOCATION_TYPE_COLOR[marker.locationType as LocationType] ?? '#94a3b8';
        const label = LOCATION_TYPE_LABEL[marker.locationType as LocationType] ?? marker.locationType;

        return (
          <Group
            key={marker.locationId}
            x={cx}
            y={cy}
            onClick={(e) => {
              e.cancelBubble = true;
              setSelectedLocationId(marker.locationId);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              setSelectedLocationId(marker.locationId);
            }}
          >
            {/* Diamond body — filled when occupied, hollow when empty */}
            <Line
              points={DIAMOND_POINTS}
              closed
              fill={marker.containerCount > 0
                ? (isSelected ? color : `${color}cc`)
                : (isSelected ? `${color}33` : 'transparent')}
              stroke={isSelected ? '#0f172a' : color}
              strokeWidth={isSelected ? 2 : 1.5}
              strokeScaleEnabled={false}
            />

            {/* Container count badge — top-right of diamond */}
            {marker.containerCount > 0 && (
              <Rect
                x={MARKER_HALF - 2}
                y={-MARKER_HALF - 12}
                width={16}
                height={12}
                fill={color}
                cornerRadius={3}
                listening={false}
              />
            )}
            {marker.containerCount > 0 && (
              <Text
                x={MARKER_HALF - 2}
                y={-MARKER_HALF - 12}
                width={16}
                height={12}
                text={String(marker.containerCount)}
                fontSize={9}
                fontStyle="bold"
                fill="#ffffff"
                align="center"
                verticalAlign="middle"
                listening={false}
              />
            )}

            {/* Type + code label below diamond */}
            <Text
              x={-30}
              y={MARKER_HALF + 3}
              width={60}
              text={`${label}\n${marker.locationCode}`}
              fontSize={8}
              fill="#475569"
              align="center"
              listening={false}
            />
          </Group>
        );
      })}
    </Layer>
  );
}
