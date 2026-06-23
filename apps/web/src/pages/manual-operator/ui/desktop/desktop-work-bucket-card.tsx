import type {
  RouteGroupWorkBucketSummary,
  WorkBucketSummary
} from '@/entities/manual-shift/model/shift-selectors';

type BucketForCard = WorkBucketSummary | RouteGroupWorkBucketSummary;

interface DesktopWorkBucketCardProps {
  bucket: BucketForCard;
  lineName?: string;
  routeGroupName?: string;
  onClick?: (workBucketIdentifier: string) => void;
}

function getWorkBucketIdentifier(bucket: BucketForCard): string {
  if ('workBucketKey' in bucket) return bucket.workBucketKey;
  return bucket.workBucketName;
}

function getWorkBucketDisplayName(bucket: BucketForCard): string {
  if ('workBucketDisplayName' in bucket) return bucket.workBucketDisplayName;
  return bucket.workBucketName;
}

function getOrdersCount(bucket: BucketForCard): number {
  if ('ordersCount' in bucket) return bucket.ordersCount;
  return bucket.orderCount;
}

function getItemLinesCount(bucket: BucketForCard): number {
  if ('itemLinesCount' in bucket) return bucket.itemLinesCount;
  return (bucket as WorkBucketSummary).itemLinesCount;
}

function getTotalQuantity(bucket: BucketForCard): number {
  if ('totalQuantity' in bucket) return bucket.totalQuantity;
  return (bucket as WorkBucketSummary).totalQuantity;
}

function bucketDisplayName(workBucketName: string, lineName?: string, routeGroupName?: string): string {
  if (routeGroupName && workBucketName === routeGroupName) return 'כללי';
  if (lineName && workBucketName === lineName) return 'כללי';
  return workBucketName;
}

export function DesktopWorkBucketCard({ bucket, lineName, routeGroupName, onClick }: DesktopWorkBucketCardProps) {
  const rawName = getWorkBucketIdentifier(bucket);
  const displayName = bucketDisplayName(getWorkBucketDisplayName(bucket), lineName, routeGroupName);
  const sb = bucket.statusBreakdown;
  const ordersCount = getOrdersCount(bucket);
  const itemLinesCount = getItemLinesCount(bucket);
  const totalQuantity = getTotalQuantity(bucket);
  return (
    <div className="bg-white border border-gray-200 rounded-lg w-full">
      <button
        type="button"
        className="w-full text-right p-4 hover:bg-gray-50 hover:border-gray-300 transition-colors rounded-lg"
        onClick={() => onClick?.(rawName)}
        data-testid={`work-bucket-card-${rawName}`}
        aria-label={`קבוצת עבודה ${displayName}`}
      >
        <p className="text-sm font-semibold text-gray-900 mb-2">{displayName}</p>
        <div className="flex items-baseline gap-3 mb-2 text-xs text-gray-600">
          <span>{ordersCount} הזמנה{ordersCount !== 1 ? 'ות' : ''}</span>
          {itemLinesCount > 0 && <span>{itemLinesCount} פריטים / שורות</span>}
          <span>{totalQuantity} יח'</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {sb.queued > 0 && <span className="text-gray-500">{sb.queued} בתור</span>}
          {sb.picking > 0 && <span className="text-blue-700">{sb.picking} בליקוט</span>}
          {sb.waitingCheck > 0 && <span className="text-amber-700">{sb.waitingCheck} בדיקה</span>}
          {sb.returned > 0 && <span className="text-red-600">{sb.returned} הוחזר</span>}
          {sb.done > 0 && <span className="text-green-700">{sb.done} הושלם</span>}
        </div>
      </button>
    </div>
  );
}
