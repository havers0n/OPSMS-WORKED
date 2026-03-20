import type { LayoutDraft } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';
import { mapLayoutDraftToSavePayload } from './mappers';

export async function saveLayoutDraft(layoutDraft: LayoutDraft) {
  const result = await bffRequest<{ layoutVersionId: string }>('/layout-drafts/save', {
    method: 'POST',
    body: JSON.stringify({
      layoutDraft: mapLayoutDraftToSavePayload(layoutDraft)
    })
  });

  return {
    layoutVersionId: result.layoutVersionId,
    savedDraft: layoutDraft
  };
}

export async function createLayoutDraft(floorId: string) {
  const result = await bffRequest<{ id: string }>('/layout-drafts', {
    method: 'POST',
    body: JSON.stringify({
      floorId
    })
  });
  return result.id;
}
