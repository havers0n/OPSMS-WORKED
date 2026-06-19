import type {
  AreaHierarchySummary,
  LineHierarchySummary,
  WorkBucketSummary
} from '@/entities/manual-shift/model/shift-selectors';
import type { BucketProductRollupRow } from '@wos/domain';
import { DesktopAreaCard } from './desktop-area-card';
import { DesktopLineSummaryCard } from './desktop-line-summary-card';
import { DesktopWorkBucketCard } from './desktop-work-bucket-card';
import { DesktopOrderMiniCard } from './desktop-order-mini-card';
import { DesktopBucketProductTable } from './desktop-bucket-product-table';

interface DesktopHierarchyPanelProps {
  selectedAreaKey: string | null;
  selectedLineId: string | null;
  selectedWorkBucketName: string | null;
  areaSummaries: AreaHierarchySummary[];
  lineHierarchySummaries: LineHierarchySummary[];
  areaLineSummaries: LineHierarchySummary[];
  workBucketSummaries: WorkBucketSummary[];
  onSelectArea: (areaKey: string | null) => void;
  onSelectLine: (lineId: string) => void;
  onSelectBucket: (workBucketName: string) => void;
  onSelectOrder: (orderId: string) => void;
  onClearArea: () => void;
  onClearLine: () => void;
  onClearBucket: () => void;
  workBucketView: 'products' | 'orders';
  productRollup: BucketProductRollupRow[] | undefined;
  productRollupLoading: boolean;
  onSetWorkBucketView: (view: 'products' | 'orders') => void;
}

export function DesktopHierarchyPanel({
  selectedAreaKey,
  selectedLineId,
  selectedWorkBucketName,
  areaSummaries,
  lineHierarchySummaries,
  areaLineSummaries,
  workBucketSummaries,
  onSelectArea,
  onSelectLine,
  onSelectBucket,
  onSelectOrder,
  onClearArea,
  onClearLine,
  onClearBucket,
  workBucketView,
  productRollup,
  productRollupLoading,
  onSetWorkBucketView
}: DesktopHierarchyPanelProps) {
  if (!selectedAreaKey) {
    if (areaSummaries.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-40 px-4 gap-1">
          <p className="text-sm font-medium text-gray-500">אין אזורים פעילים</p>
          <p className="text-xs text-gray-400">בחר משמרת כדי לראות אזורים</p>
        </div>
      );
    }

    return (
      <div className="p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">אזורי הפצה</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {areaSummaries.map((area) => (
            <DesktopAreaCard key={area.areaKey} area={area} onClick={onSelectArea} />
          ))}
        </div>
      </div>
    );
  }

  const selectedArea = areaSummaries.find((a) => a.areaKey === selectedAreaKey);
  const isAutoSkippedSingleLine = selectedLineId !== null && areaLineSummaries.length === 1;

  if (!selectedLineId) {
    if (areaLineSummaries.length === 0) {
      return (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={onClearArea}
              aria-label="חזרה לאזורי הפצה"
            >
              אזורי הפצה
            </button>
            <span className="text-xs text-gray-400">&gt;</span>
            <span className="text-xs text-gray-700 font-medium">{selectedArea?.displayName ?? ''}</span>
          </div>
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">אין קווים באזור זה</p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={onClearArea}
            aria-label="חזרה לאזורי הפצה"
          >
            אזורי הפצה
          </button>
          <span className="text-xs text-gray-400">&gt;</span>
          <span className="text-xs text-gray-700 font-medium">{selectedArea?.displayName ?? ''}</span>
        </div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">קווים</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {areaLineSummaries.map((line) => (
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
            onClick={onClearArea}
            aria-label="חזרה לאזורי הפצה"
          >
            אזורי הפצה
          </button>
          <span className="text-xs text-gray-400">&gt;</span>
          {isAutoSkippedSingleLine ? (
            <span className="text-xs text-gray-700 font-medium">{selectedArea?.displayName ?? ''}</span>
          ) : (
            <>
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={onClearArea}
                aria-label={`חזרה לקווים באזור ${selectedArea?.displayName ?? ''}`}
              >
                {selectedArea?.displayName ?? ''}
              </button>
              <span className="text-xs text-gray-400">&gt;</span>
              <span className="text-xs text-gray-700 font-medium">קו: {selectedLine?.lineName ?? ''}</span>
            </>
          )}
        </div>
        {workBucketSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">אין קבוצות עבודה בקו זה</p>
          </div>
        ) : (
          <>
            {isAutoSkippedSingleLine && (
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">קבוצות עבודה</h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {workBucketSummaries.map((bucket) => (
                <DesktopWorkBucketCard key={bucket.workBucketName} bucket={bucket} lineName={selectedLine?.lineName} onClick={onSelectBucket} />
              ))}
            </div>
          </>
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
          onClick={onClearArea}
          aria-label="חזרה לאזורי הפצה"
        >
          אזורי הפצה
        </button>
        <span className="text-xs text-gray-400">&gt;</span>
        {isAutoSkippedSingleLine ? (
          <button
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={onClearBucket}
            aria-label={`חזרה לקבוצות עבודה באזור ${selectedArea?.displayName ?? ''}`}
          >
            {selectedArea?.displayName ?? ''}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={onClearArea}
              aria-label={`חזרה לקווים באזור ${selectedArea?.displayName ?? ''}`}
            >
              {selectedArea?.displayName ?? ''}
            </button>
            <span className="text-xs text-gray-400">&gt;</span>
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={onClearLine}
              aria-label={`חזרה לקבוצות עבודה קו ${selectedLine?.lineName ?? ''}`}
            >
              קו: {selectedLine?.lineName ?? ''}
            </button>
          </>
        )}
        <span className="text-xs text-gray-400">&gt;</span>
        <span className="text-xs text-gray-700 font-medium">קבוצת עבודה: {selectedWorkBucketName}</span>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
            workBucketView === 'products'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          onClick={() => onSetWorkBucketView('products')}
          data-testid="tab-products"
        >
          מוצרים
        </button>
        <button
          type="button"
          className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
            workBucketView === 'orders'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          onClick={() => onSetWorkBucketView('orders')}
          data-testid="tab-orders"
        >
          הזמנות
        </button>
      </div>

      {workBucketView === 'products' ? (
        productRollupLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <DesktopBucketProductTable products={productRollup ?? []} />
        )
      ) : !selectedBucket || selectedBucket.orders.length === 0 ? (
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
