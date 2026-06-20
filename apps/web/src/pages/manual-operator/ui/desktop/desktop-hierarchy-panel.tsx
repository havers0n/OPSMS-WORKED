import type {
  AreaHierarchySummary,
  LineHierarchySummary,
  RouteGroupSummary,
  RouteGroupWorkBucketSummary,
  WorkBucketSummary
} from '@/entities/manual-shift/model/shift-selectors';
import type { BucketProductRollupRow } from '@wos/domain';
import { DesktopAreaCard } from './desktop-area-card';
import { DesktopLineSummaryCard } from './desktop-line-summary-card';
import { DesktopRouteGroupCard } from './desktop-route-group-card';
import { DesktopWorkBucketCard } from './desktop-work-bucket-card';
import { DesktopOrderMiniCard } from './desktop-order-mini-card';
import { DesktopBucketProductTable } from './desktop-bucket-product-table';

interface DesktopHierarchyPanelProps {
  selectedAreaKey: string | null;
  selectedLineId: string | null;
  selectedRouteGroupKey: string | null;
  selectedWorkBucketKey: string | null;
  selectedWorkBucketName: string | null;
  areaSummaries: AreaHierarchySummary[];
  lineHierarchySummaries: LineHierarchySummary[];
  areaLineSummaries: LineHierarchySummary[];
  workBucketSummaries: WorkBucketSummary[];
  routeGroupSummaries: RouteGroupSummary[];
  routeGroupWorkBucketSummaries: RouteGroupWorkBucketSummary[];
  hasRouteGroups: boolean;
  onSelectArea: (areaKey: string | null) => void;
  onSelectLine: (lineId: string) => void;
  onSelectRouteGroup: (routeGroupKey: string) => void;
  onSelectBucket: (workBucketIdentifier: string) => void;
  onSelectOrder: (orderId: string) => void;
  onClearArea: () => void;
  onClearLine: () => void;
  onClearRouteGroup: () => void;
  onClearBucket: () => void;
  workBucketView: 'products' | 'orders';
  productRollup: BucketProductRollupRow[] | undefined;
  productRollupLoading: boolean;
  showProductRollupDeferred: boolean;
  onSetWorkBucketView: (view: 'products' | 'orders') => void;
}

function AreaBreadcrumb({ areaName, onClearArea }: { areaName: string; onClearArea: () => void }) {
  return (
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
      <span className="text-xs text-gray-700 font-medium">{areaName}</span>
    </div>
  );
}

export function DesktopHierarchyPanel({
  selectedAreaKey,
  selectedLineId,
  selectedRouteGroupKey,
  selectedWorkBucketKey,
  selectedWorkBucketName,
  areaSummaries,
  lineHierarchySummaries,
  areaLineSummaries,
  workBucketSummaries,
  routeGroupSummaries,
  routeGroupWorkBucketSummaries,
  hasRouteGroups,
  onSelectArea,
  onSelectLine,
  onSelectRouteGroup,
  onSelectBucket,
  onSelectOrder,
  onClearArea,
  onClearLine,
  onClearRouteGroup,
  onClearBucket,
  workBucketView,
  productRollup,
  productRollupLoading,
  showProductRollupDeferred,
  onSetWorkBucketView
}: DesktopHierarchyPanelProps) {
  // ── State 1: No area selected → area cards ──────────────────────────────
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

  // ── State 2: Area selected, no line → line cards ────────────────────────
  if (!selectedLineId) {
    if (areaLineSummaries.length === 0) {
      return (
        <div className="p-4">
          <AreaBreadcrumb areaName={selectedArea?.displayName ?? ''} onClearArea={onClearArea} />
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">אין קווים באזור זה</p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4">
        <AreaBreadcrumb areaName={selectedArea?.displayName ?? ''} onClearArea={onClearArea} />
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

  // ── State 3: Route group selected, but no work bucket yet ──────────────
  if (hasRouteGroups && selectedRouteGroupKey && !selectedWorkBucketKey && !selectedWorkBucketName) {
    const selectedRouteGroup = routeGroupSummaries.find((rg) => rg.routeGroupKey === selectedRouteGroupKey);

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
          <button
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={onClearRouteGroup}
            aria-label="חזרה לקבוצות חלוקה"
          >
            {selectedArea?.displayName ?? ''}
          </button>
          <span className="text-xs text-gray-400">&gt;</span>
          <span className="text-xs text-gray-700 font-medium">קבוצת חלוקה: {selectedRouteGroup?.routeGroupName ?? ''}</span>
        </div>
        {routeGroupWorkBucketSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">אין קבוצות עבודה בקבוצת חלוקה זו</p>
          </div>
        ) : (
          <>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">קבוצות עבודה</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {routeGroupWorkBucketSummaries.map((wb) => (
                <DesktopWorkBucketCard
                  key={wb.workBucketKey}
                  bucket={wb}
                  routeGroupName={selectedRouteGroup?.routeGroupName}
                  onClick={onSelectBucket}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── State 4: Line selected, route groups shown (no route group selected) ──
  if (hasRouteGroups && !selectedRouteGroupKey && !selectedWorkBucketKey && !selectedWorkBucketName) {
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
        {routeGroupSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">אין קבוצות חלוקה בקו זה</p>
          </div>
        ) : (
          <>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">קבוצות חלוקה</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {routeGroupSummaries.map((rg) => (
                <DesktopRouteGroupCard key={rg.routeGroupKey} routeGroup={rg} onClick={onSelectRouteGroup} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── State 5: Legacy fallback — no route groups, no work bucket selected ──
  if (!selectedWorkBucketKey && !selectedWorkBucketName) {
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
            {isAutoSkippedSingleLine && !!selectedLine && (
              <>
                <p className="text-xs text-gray-500 mb-1">קו הפצה: {selectedLine.lineName}</p>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">קבוצות עבודה</h2>
              </>
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

  // ── State 6: Work bucket selected → products/orders ──────────────────────
  const selectedBucketLegacy = workBucketSummaries.find((p) => p.workBucketName === selectedWorkBucketName);
  const selectedBucketRouteGroup = routeGroupWorkBucketSummaries.find((wb) => wb.workBucketKey === selectedWorkBucketKey);

  const isRouteGroupBucket = hasRouteGroups && !!selectedRouteGroupKey;
  const selectedRouteGroup = isRouteGroupBucket
    ? routeGroupSummaries.find((rg) => rg.routeGroupKey === selectedRouteGroupKey)
    : undefined;

  const bucketOrders = isRouteGroupBucket
    ? (selectedBucketRouteGroup?.orders ?? [])
    : (selectedBucketLegacy?.orders ?? []);

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
        {isRouteGroupBucket ? (
          <>
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={onClearRouteGroup}
              aria-label={`חזרה לקבוצות חלוקה באזור ${selectedArea?.displayName ?? ''}`}
            >
              {selectedArea?.displayName ?? ''}
            </button>
            <span className="text-xs text-gray-400">&gt;</span>
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={onClearRouteGroup}
              aria-label={`חזרה לקבוצות עבודה בקבוצת חלוקה ${selectedRouteGroup?.routeGroupName ?? ''}`}
            >
              קבוצת חלוקה: {selectedRouteGroup?.routeGroupName ?? ''}
            </button>
          </>
        ) : isAutoSkippedSingleLine ? (
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
        showProductRollupDeferred ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">תצוגת מוצרים לקבוצת חלוקה מרובת מקורות תתווסף בשלב הבא</p>
          </div>
        ) : productRollupLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <DesktopBucketProductTable products={productRollup ?? []} />
        )
      ) : bucketOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
          <p className="text-sm font-medium text-gray-500">אין הזמנות בקבוצת עבודה זו</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bucketOrders.map((order) => (
            <DesktopOrderMiniCard key={order.orderId} order={order} onClick={onSelectOrder} />
          ))}
        </div>
      )}
    </div>
  );
}
