import type { DemandImportAppendDiffOrder } from '@wos/domain';
import { Badge } from '@/shared/ui/badge';

const CLASSIFICATION_BADGE: Record<
  string,
  { tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; label: string }
> = {
  new: { tone: 'success', label: 'חדש' },
  already_exists: { tone: 'neutral', label: 'כבר קיים' },
  quantity_changed: { tone: 'warning', label: 'כמות השתנתה' },
  duplicate: { tone: 'info', label: 'כפול' },
  special_flow: { tone: 'warning', label: 'Special Flow' },
  requires_review: { tone: 'danger', label: 'דורש בדיקה' }
};

interface AppendOrderCardProps {
  order: DemandImportAppendDiffOrder;
}

export function AppendOrderCard({ order }: AppendOrderCardProps) {
  const badge = CLASSIFICATION_BADGE[order.classification];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 hover:border-blue-300 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-mono text-xs text-gray-500 font-bold truncate">
          {order.orderNumber ?? '—'}
        </span>
        <Badge tone={badge.tone} className="!text-[10px] !px-1.5 !py-0">
          {badge.label}
        </Badge>
      </div>

      <div className="text-sm font-semibold text-gray-900 truncate mb-1">
        {order.customerName ?? '—'}
      </div>

      {order.distributionArea && (
        <div className="text-xs text-gray-500 mb-1">
          אזור: {order.distributionArea}
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-0.5">
        <div>שורות: {order.rows.length}</div>
        <div>כמות כוללת: {order.totalQuantity}</div>
      </div>

      {order.suggestedLineName && (
        <div className="mt-1.5 text-xs text-blue-600 font-medium">
          קו מוצע: {order.suggestedLineName}
        </div>
      )}
    </div>
  );
}
