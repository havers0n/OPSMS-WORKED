import type { PickingPlanningOverlaySource } from './types';

export function canSeedPickingPlanningSource(mode: string | undefined) {
  return mode !== 'production';
}

export function readDevPickingPlanningSourceFromSearch(
  search: string,
  mode: string | undefined
): PickingPlanningOverlaySource {
  if (!canSeedPickingPlanningSource(mode)) {
    return { kind: 'none' };
  }

  const params = new URLSearchParams(search);
  const waveId = params.get('pickingPlanWaveId')?.trim();
  if (waveId) {
    return { kind: 'wave', waveId };
  }

  const orderIds = params
    .get('pickingPlanOrderIds')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return orderIds && orderIds.length > 0
    ? { kind: 'orders', orderIds }
    : { kind: 'none' };
}
