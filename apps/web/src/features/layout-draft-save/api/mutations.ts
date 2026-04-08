import type { LayoutDraft } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';
import { mapLayoutDraftToSavePayload } from './mappers';

export async function saveLayoutDraft(layoutDraft: LayoutDraft) {
  const result = await bffRequest<{ layoutVersionId: string; draftVersion: number | null }>('/layout-drafts/save', {
    method: 'POST',
    body: JSON.stringify({
      layoutDraft: mapLayoutDraftToSavePayload(layoutDraft)
    })
  });

  return {
    layoutVersionId: result.layoutVersionId,
    draftVersion: result.draftVersion,
    savedDraft: {
      ...layoutDraft,
      draftVersion: result.draftVersion
    }
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
