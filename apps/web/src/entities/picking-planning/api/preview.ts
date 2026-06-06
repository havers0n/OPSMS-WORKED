import { bffRequest } from '@/shared/api/bff/client';
import type {
  PickingPlanningPreviewResponse,
  PreviewExplicitPickingPlanPayload,
  PreviewPickingPlanFromOrdersPayload,
  PreviewPickingPlanFromWavePayload
} from '../model/types';

function postPreview<TPayload>(
  path: string,
  payload: TPayload,
  signal?: AbortSignal
): Promise<PickingPlanningPreviewResponse> {
  return bffRequest<PickingPlanningPreviewResponse>(path, {
    method: 'POST',
    body: JSON.stringify(payload),
    signal
  });
}

export function previewPickingPlanFromOrders(
  payload: PreviewPickingPlanFromOrdersPayload,
  signal?: AbortSignal
) {
  return postPreview('/api/picking-planning/preview/orders', payload, signal);
}

export function previewPickingPlanFromWave(
  payload: PreviewPickingPlanFromWavePayload,
  signal?: AbortSignal
) {
  return postPreview('/api/picking-planning/preview/wave', payload, signal);
}

export function previewExplicitPickingPlan(
  payload: PreviewExplicitPickingPlanPayload,
  signal?: AbortSignal
) {
  return postPreview('/api/picking-planning/preview', payload, signal);
}
