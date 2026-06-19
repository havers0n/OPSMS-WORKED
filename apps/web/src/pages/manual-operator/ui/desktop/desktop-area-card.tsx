import type { AreaHierarchySummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopAreaCardProps {
  area: AreaHierarchySummary;
  onClick?: (areaName: string | null) => void;
}

export function DesktopAreaCard({ area, onClick }: DesktopAreaCardProps) {
  const sb = area.statusBreakdown;

  return (
    <button
      type="button"
      className="bg-white border border-gray-200 rounded-lg p-4 text-right w-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
      onClick={() => onClick?.(area.areaKey)}
      data-testid={`area-card-${area.areaKey}`}
      aria-label={`אזור הפצה ${area.displayName}`}
    >
      <p className="text-sm font-semibold text-gray-900 truncate mb-2">{area.displayName}</p>
      <div className="flex items-baseline gap-3 mb-2 text-xs text-gray-600">
        <span>{area.totalLines} קווים</span>
        <span>{area.totalBuckets} קבוצות</span>
        <span>{area.totalOrders} הזמנות</span>
        <span>{area.totalQuantity} יח&apos;</span>
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
