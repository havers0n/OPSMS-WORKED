import type { WarehouseRackSideFocus } from '@/warehouse/state/rack-layout-actions';

type FaceName = 'A' | 'B' | 'C' | 'D';

const FACE_TABLE: Record<number, Record<WarehouseRackSideFocus, FaceName>> = {
  0:   { north: 'A', south: 'B', west: 'C', east: 'D' },
  90:  { north: 'C', south: 'D', west: 'B', east: 'A' },
  180: { north: 'B', south: 'A', west: 'D', east: 'C' },
  270: { north: 'D', south: 'C', west: 'A', east: 'B' },
};

export function faceAtViewportEdge(rotationDeg: number, edge: WarehouseRackSideFocus): FaceName {
  const normalized = ((Math.round(rotationDeg / 90) * 90) % 360 + 360) % 360;
  return FACE_TABLE[normalized][edge];
}

export function formatRackAxis(axis: 'NS' | 'WE'): string {
  return axis === 'NS' ? 'Vertical' : 'Horizontal';
}
