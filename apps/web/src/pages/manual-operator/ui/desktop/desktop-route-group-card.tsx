import type { DistributionGroupSummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopRouteGroupCardProps {
  routeGroup: DistributionGroupSummary;
  onClick?: (distributionGroupKey: string) => void;
}

const CONFIDENCE_BADGE: Record<string, string> = {
  low: 'text-red-600 bg-red-50 border-red-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  high: ''
};

function confidenceBadge(confidence: string): string | null {
  if (confidence === 'high') return null;
  if (confidence === 'low') return 'חוסר ודאות';
  if (confidence === 'medium') return 'ודאות חלקית';
  return null;
}

export function DesktopRouteGroupCard({ routeGroup, onClick }: DesktopRouteGroupCardProps) {
  const sb = routeGroup.statusBreakdown;
  const badge = confidenceBadge(routeGroup.classificationConfidence);
  const badgeCls = CONFIDENCE_BADGE[routeGroup.classificationConfidence];

  return (
    <button
      type="button"
      className="bg-white border border-gray-200 rounded-lg p-4 text-right w-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
      onClick={() => onClick?.(routeGroup.routeGroupKey)}
      data-testid={`route-group-card-${routeGroup.routeGroupKey}`}
      aria-label={`קבוצת חלוקה ${routeGroup.routeGroupName}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-900 truncate">{routeGroup.routeGroupName}</p>
        {badge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeCls} shrink-0 mr-2`}>
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-3 mb-2 text-xs text-gray-600">
        <span>{routeGroup.workBucketCount} קבוצות עבודה</span>
        <span>{routeGroup.orderCount} הזמנות</span>
        <span>{routeGroup.totalQuantity} יח'</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        {sb.queued > 0 && <span className="text-gray-500">{sb.queued} בתור</span>}
        {sb.picking > 0 && <span className="text-blue-700">{sb.picking} בליקוט</span>}
        {sb.waitingCheck > 0 && <span className="text-amber-700">{sb.waitingCheck} בדיקה</span>}
        {sb.returned > 0 && <span className="text-red-600">{sb.returned} הוחזר</span>}
        {sb.done > 0 && <span className="text-green-700">{sb.done} הושלם</span>}
      </div>
    </button>
  );
}
