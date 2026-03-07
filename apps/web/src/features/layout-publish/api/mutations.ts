import type { LayoutValidationResult } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';

export type PublishLayoutResult = {
  layoutVersionId: string;
  publishedAt: string;
  generatedCells: number;
  validation: LayoutValidationResult;
};

export async function publishLayoutVersion(layoutVersionId: string): Promise<PublishLayoutResult> {
  return bffRequest<PublishLayoutResult>(`/layout-drafts/${layoutVersionId}/publish`, {
    method: 'POST'
  });
}
