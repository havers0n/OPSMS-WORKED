import { bffRequest } from '@/shared/api/bff/client';
import type {
  PickingPlanningPreviewResponse,
  PreviewExplicitPickingPlanPayload,
  PreviewPickingPlanFromOrdersPayload,
  PreviewPickingPlanFromWavePayload
} from '../model/types';

function postPreview<TPayload>(
  path: string,
  payload: TPayload
): Promise<PickingPlanningPreviewResponse> {
  return bffRequest<PickingPlanningPreviewResponse>(path, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function previewPickingPlanFromOrders(
  payload: PreviewPickingPlanFromOrdersPayload
) {
  return postPreview('/api/picking-planning/preview/orders', payload);
}

export function previewPickingPlanFromWave(
  payload: PreviewPickingPlanFromWavePayload
) {
  return postPreview('/api/picking-planning/preview/wave', payload);
}

export function previewExplicitPickingPlan(
  payload: PreviewExplicitPickingPlanPayload
) {
  return postPreview('/api/picking-planning/preview', payload);
}
