import type { AreaHierarchySummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopAreaCardProps {
  area: AreaHierarchySummary;
  isSpecialChannel?: boolean;
  onClick?: (areaName: string | null) => void;
}

export function DesktopAreaCard({ area, isSpecialChannel = false, onClick }: DesktopAreaCardProps) {
  const sb = area.statusBreakdown;

  return (
    <button
      type="button"
      className={`rounded-lg p-4 text-right w-full transition-colors border ${
        isSpecialChannel
          ? 'bg-amber-50 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
      }`}
      onClick={() => onClick?.(area.areaKey)}
      data-testid={`area-card-${area.areaKey}`}
      aria-label={`אזור הפצה ${area.displayName}`}
    >
      {isSpecialChannel && (
        <div className="mb-2 flex justify-end">
          <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            ערוץ מיוחד
          </span>
        </div>
      )}
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
