import { Badge } from '@/shared/ui/badge';
import type { ProductControlStatus } from './product-control-types';

const STATUS_TONE: Record<ProductControlStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  covered_by_bonded: 'success',
  partial_bonded: 'warning',
  unresolved: 'danger',
  data_issue: 'danger',
};

const STATUS_LABEL: Record<ProductControlStatus, string> = {
  ok: 'תקין',
  covered_by_bonded: 'מכוסה מבונדד',
  partial_bonded: 'כיסוי חלקי',
  unresolved: 'חוסר לא פתור',
  data_issue: 'בעיית נתונים',
};

export function CoverageStatusBadge({ status }: { status: ProductControlStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
