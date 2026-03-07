import type { LayoutValidationResult } from '@wos/domain';
import { supabase } from '@/shared/api/supabase/client';

export type PublishLayoutResult = {
  layoutVersionId: string;
  publishedAt: string;
  generatedCells: number;
  validation: LayoutValidationResult;
};

export async function publishLayoutVersion(layoutVersionId: string): Promise<PublishLayoutResult> {
  const { data, error } = await supabase.rpc('publish_layout_version', {
    layout_version_uuid: layoutVersionId,
    actor_uuid: null
  });

  if (error) {
    throw error;
  }

  return data as PublishLayoutResult;
}
