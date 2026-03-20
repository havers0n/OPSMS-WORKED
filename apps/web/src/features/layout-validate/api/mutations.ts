import type { LayoutValidationResult } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';

export async function validateLayoutVersion(layoutVersionId: string): Promise<LayoutValidationResult> {
  return bffRequest<LayoutValidationResult>(`/layout-drafts/${layoutVersionId}/validate`, {
    method: 'POST'
  });
}
