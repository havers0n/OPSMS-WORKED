import type { LayoutValidationResult } from '@wos/domain';
import { supabase } from '@/shared/api/supabase/client';

export async function validateLayoutVersion(layoutVersionId: string): Promise<LayoutValidationResult> {
  const { data, error } = await supabase.rpc('validate_layout_version', {
    layout_version_uuid: layoutVersionId
  });

  if (error) {
    throw error;
  }

  const result = (data ?? { isValid: false, issues: [] }) as LayoutValidationResult;
  return {
    isValid: result.isValid,
    issues: result.issues ?? []
  };
}
