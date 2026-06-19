import type {
  LineHierarchySummary,
  WorkBucketSummary
} from '@/entities/manual-shift/model/shift-selectors';
import { DesktopLineSummaryCard } from './desktop-line-summary-card';
import { DesktopWorkBucketCard } from './desktop-work-bucket-card';
import { DesktopOrderMiniCard } from './desktop-order-mini-card';

interface DesktopHierarchyPanelProps {
  selectedLineId: string | null;
  selectedWorkBucketName: string | null;
  lineHierarchySummaries: LineHierarchySummary[];
  workBucketSummaries: WorkBucketSummary[];
  onSelectLine: (lineId: string) => void;
  onSelectBucket: (workBucketName: string) => void;
  onSelectOrder: (orderId: string) => void;
  onClearLine: () => void;
  onClearBucket: () => void;
}

export function DesktopHierarchyPanel({
  selectedLineId,
  selectedWorkBucketName,
  lineHierarchySummaries,
  workBucketSummaries,
  onSelectLine,
  onSelectBucket,
  onSelectOrder,
  onClearLine,
  onClearBucket
}: DesktopHierarchyPanelProps) {
  if (!selectedLineId) {
    if (lineHierarchySummaries.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-40 px-4 gap-1">
          <p className="text-sm font-medium text-gray-500">אין קווים פעילים</p>
          <p className="text-xs text-gray-400">בחר משמרת כדי לראות קווים</p>
        </div>
      );
    }

    return (
      <div className="p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">קווים</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lineHierarchySummaries.map((line) => (
            <DesktopLineSummaryCard key={line.lineId} line={line} onClick={onSelectLine} />
          ))}
        </div>
      </div>
    );
  }

  const selectedLine = lineHierarchySummaries.find((l) => l.lineId === selectedLineId);

  if (!selectedWorkBucketName) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={onClearLine}
            aria-label="חזרה לקווים"
          >
            קווים
          </button>
          <span className="text-xs text-gray-400">&gt;</span>
          <span className="text-xs text-gray-700 font-medium">קו: {selectedLine?.lineName ?? ''}</span>
        </div>
        {workBucketSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">אין קבוצות עבודה בקו זה</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {workBucketSummaries.map((bucket) => (
              <DesktopWorkBucketCard key={bucket.workBucketName} bucket={bucket} lineName={selectedLine?.lineName} onClick={onSelectBucket} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const selectedBucket = workBucketSummaries.find((p) => p.workBucketName === selectedWorkBucketName);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          className="text-xs text-blue-600 hover:text-blue-800"
          onClick={onClearBucket}
          aria-label="חזרה לקבוצות עבודה"
        >
          קווים
        </button>
        <span className="text-xs text-gray-400">&gt;</span>
        <button
          type="button"
          className="text-xs text-blue-600 hover:text-blue-800"
          onClick={onClearBucket}
          aria-label={`חזרה לקבוצות עבודה קו ${selectedLine?.lineName ?? ''}`}
        >
          קו: {selectedLine?.lineName ?? ''}
        </button>
        <span className="text-xs text-gray-400">&gt;</span>
        <span className="text-xs text-gray-700 font-medium">קבוצת עבודה: {selectedWorkBucketName}</span>
      </div>
      {!selectedBucket || selectedBucket.orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
          <p className="text-sm font-medium text-gray-500">אין הזמנות בקבוצת עבודה זו</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {selectedBucket.orders.map((order) => (
            <DesktopOrderMiniCard key={order.orderId} order={order} onClick={onSelectOrder} />
          ))}
        </div>
      )}
    </div>
  );
}