import type { LayoutPublishReadinessResult } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';

export type PublishLayoutResult = {
  layoutVersionId: string;
  publishedAt: string;
  generatedCells: number;
  validation: LayoutPublishReadinessResult;
};

export async function publishLayoutVersion(
  layoutVersionId: string,
  expectedDraftVersion: number
): Promise<PublishLayoutResult> {
  return bffRequest<PublishLayoutResult>(`/layout-drafts/${layoutVersionId}/publish`, {
    method: 'POST',
    body: JSON.stringify({
      expectedDraftVersion
    })
  });
}
