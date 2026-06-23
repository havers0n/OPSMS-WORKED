import type { BondedCoverageRequestStatus } from '@wos/domain';
import { Badge } from '@/shared/ui/badge';

const STATUS_LABELS: Record<BondedCoverageRequestStatus, string> = {
  open: 'בקשה פתוחה',
  closed: 'בקשה סגורה',
  cancelled: 'בקשה מבוטלת',
};

const STATUS_TONES: Record<BondedCoverageRequestStatus, 'info' | 'success' | 'neutral'> = {
  open: 'info',
  closed: 'success',
  cancelled: 'neutral',
};

type BondedRequestStatusBadgeProps = {
  status: BondedCoverageRequestStatus;
};

export function BondedRequestStatusBadge({ status }: BondedRequestStatusBadgeProps) {
  return (
    <Badge tone={STATUS_TONES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
