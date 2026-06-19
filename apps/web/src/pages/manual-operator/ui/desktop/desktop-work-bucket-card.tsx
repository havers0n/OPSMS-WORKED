import type { WorkBucketSummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopWorkBucketCardProps {
  bucket: WorkBucketSummary;
  lineName?: string;
  onClick?: (workBucketName: string) => void;
}

function bucketDisplayName(workBucketName: string, lineName?: string): string {
  if (lineName && workBucketName === lineName) {
    return 'כללי';
  }
  return workBucketName;
}

export function DesktopWorkBucketCard({ bucket, lineName, onClick }: DesktopWorkBucketCardProps) {
  const displayName = bucketDisplayName(bucket.workBucketName, lineName);
  const sb = bucket.statusBreakdown;
  return (
    <button
      type="button"
      className="bg-white border border-gray-200 rounded-lg p-4 text-right w-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
      onClick={() => onClick?.(bucket.workBucketName)}
      data-testid={`work-bucket-card-${bucket.workBucketName}`}
      aria-label={`קבוצת עבודה ${displayName}`}
    >
      <p className="text-sm font-semibold text-gray-900 mb-2">{displayName}</p>
      <div className="flex items-baseline gap-3 mb-2 text-xs text-gray-600">
        <span>{bucket.ordersCount} הזמנה{bucket.ordersCount !== 1 ? 'ות' : ''}</span>
        {bucket.itemLinesCount > 0 && <span>{bucket.itemLinesCount} פריטים / שורות</span>}
        <span>{bucket.totalQuantity} יח'</span>
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
