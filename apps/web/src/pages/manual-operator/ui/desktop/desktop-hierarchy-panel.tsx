import type {
  LineHierarchySummary,
  PointHierarchySummary
} from '@/entities/manual-shift/model/shift-selectors';
import { DesktopLineSummaryCard } from './desktop-line-summary-card';
import { DesktopPointGroupCard } from './desktop-point-group-card';
import { DesktopOrderMiniCard } from './desktop-order-mini-card';

interface DesktopHierarchyPanelProps {
  selectedLineId: string | null;
  selectedPointName: string | null;
  lineHierarchySummaries: LineHierarchySummary[];
  pointSummaries: PointHierarchySummary[];
  onSelectLine: (lineId: string) => void;
  onSelectPoint: (pointName: string) => void;
  onSelectOrder: (orderId: string) => void;
  onClearLine: () => void;
  onClearPoint: () => void;
}

export function DesktopHierarchyPanel({
  selectedLineId,
  selectedPointName,
  lineHierarchySummaries,
  pointSummaries,
  onSelectLine,
  onSelectPoint,
  onSelectOrder,
  onClearLine,
  onClearPoint
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

  if (!selectedPointName) {
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
        {pointSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">אין נקודות בקו זה</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pointSummaries.map((point) => (
              <DesktopPointGroupCard key={point.pointName} point={point} onClick={onSelectPoint} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const selectedPoint = pointSummaries.find((p) => p.pointName === selectedPointName);

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
        <button
          type="button"
          className="text-xs text-blue-600 hover:text-blue-800"
          onClick={onClearPoint}
          aria-label={`חזרה לנקודות קו ${selectedLine?.lineName ?? ''}`}
        >
          קו: {selectedLine?.lineName ?? ''}
        </button>
        <span className="text-xs text-gray-400">&gt;</span>
        <span className="text-xs text-gray-700 font-medium">נקודה: {selectedPointName}</span>
      </div>
      {!selectedPoint || selectedPoint.orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
          <p className="text-sm font-medium text-gray-500">אין הזמנות בנקודה זו</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {selectedPoint.orders.map((order) => (
            <DesktopOrderMiniCard key={order.orderId} order={order} onClick={onSelectOrder} />
          ))}
        </div>
      )}
    </div>
  );
}