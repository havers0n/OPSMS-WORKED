import type { LayoutDraft } from '@wos/domain';
import { supabase } from '@/shared/api/supabase/client';
import { mapLayoutDraftToSavePayload } from './mappers';

export async function saveLayoutDraft(layoutDraft: LayoutDraft) {
  const { data, error } = await supabase.rpc('save_layout_draft', {
    layout_payload: mapLayoutDraftToSavePayload(layoutDraft),
    actor_uuid: null
  });

  if (error) {
    throw error;
  }

  return {
    layoutVersionId: data as string,
    savedDraft: layoutDraft
  };
}

export async function createLayoutDraft(floorId: string) {
  const { data, error } = await supabase.rpc('create_layout_draft', {
    floor_uuid: floorId,
    actor_uuid: null
  });

  if (error) {
    throw error;
  }

  return data as string;
}
