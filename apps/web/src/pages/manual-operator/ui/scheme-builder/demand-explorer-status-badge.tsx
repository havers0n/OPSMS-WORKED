import type { DemandExplorerOrderStatus } from '@wos/domain';
import { Badge } from '@/shared/ui/badge';

const STATUS_CONFIG: Record<DemandExplorerOrderStatus, { tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; label: string }> = {
  unassigned: { tone: 'neutral', label: 'לא שויך' },
  partial: { tone: 'warning', label: 'שויך חלקית' },
  assigned: { tone: 'success', label: 'שויך' },
  over_allocated: { tone: 'danger', label: 'חריגה' },
};

export function DemandExplorerStatusBadge({ status }: { status: DemandExplorerOrderStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge tone={config.tone} className="!text-[10px] !px-1.5 !py-0">{config.label}</Badge>;
}
