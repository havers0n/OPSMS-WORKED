import { createHash } from 'node:crypto';
import { normalizeDemandBacklogKey } from '@wos/domain';

export function computeDemandBacklogIdentityKey(
  orderNumber: string | null,
  customerName: string | null,
  sku: string | null,
  distributionArea: string | null
): string {
  const normalized = normalizeDemandBacklogKey(orderNumber, customerName, sku, distributionArea);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
