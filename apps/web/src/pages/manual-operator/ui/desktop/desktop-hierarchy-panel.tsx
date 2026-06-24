import { Link } from 'react-router-dom';
import type {
  AreaHierarchySummary,
  LineHierarchySummary,
  DistributionGroupSummary,
  RouteGroupWorkBucketSummary,
  WorkGroupSummary
} from '@/entities/manual-shift/model/shift-selectors';
import type { BucketProductRollupRow } from '@wos/domain';
import { useOpenPickerSheetPdf } from '@/pages/manual-operator/printing/hooks/use-open-picker-sheet-pdf';
import {
  buildPickerSheetLinePdfUrl,
  buildPickerSheetLinePreviewUrl,
  buildPickerSheetWorkGroupPdfUrl,
  buildPickerSheetWorkGroupPreviewUrl
} from '@/pages/manual-operator/printing/lib/picker-sheet-urls';
import { DesktopAreaCard } from './desktop-area-card';
import { DesktopLineSummaryCard } from './desktop-line-summary-card';
import { DesktopRouteGroupCard } from './desktop-route-group-card';
import { DesktopWorkBucketCard } from './desktop-work-bucket-card';
import { DesktopOrderMiniCard } from './desktop-order-mini-card';
import { DesktopBucketProductTable } from './desktop-bucket-product-table';

interface DesktopHierarchyPanelProps {
  selectedAreaKey: string | null;
  selectedAreaLineKey?: string | null;
  selectedLineId?: string | null;
  selectedDistributionGroupKey: string | null;
  selectedWorkGroupKey: string | null;
  selectedDistributionGroupWorkGroup: RouteGroupWorkBucketSummary | undefined;
  selectedWorkBucketName: string | null;
  areaSummaries: AreaHierarchySummary[];
  specialAreaSummaries: AreaHierarchySummary[];
  lineHierarchySummaries: LineHierarchySummary[];
  areaLineSummaries: LineHierarchySummary[];
  workGroupSummaries: WorkGroupSummary[];
  distributionGroupSummaries: DistributionGroupSummary[];
  distributionGroupWorkGroupSummaries: RouteGroupWorkBucketSummary[];
  hasDistributionGroups: boolean;
  shiftId: string | null;
  onSelectArea: (areaKey: string | null) => void;
  onSelectLine: (areaLineKey: string) => void;
  onSelectDistributionGroup: (distributionGroupKey: string) => void;
  onSelectBucket: (workBucketIdentifier: string) => void;
  onSelectOrder: (orderId: string) => void;
  onClearArea: () => void;
  onClearLine: () => void;
  onClearDistributionGroup: () => void;
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
  selectedAreaLineKey,
  selectedLineId,
  selectedDistributionGroupKey,
  selectedWorkGroupKey,
  selectedDistributionGroupWorkGroup,
  selectedWorkBucketName,
  areaSummaries,
  specialAreaSummaries,
  lineHierarchySummaries,
  areaLineSummaries,
  workGroupSummaries,
  distributionGroupSummaries,
  distributionGroupWorkGroupSummaries,
  hasDistributionGroups,
  shiftId,
  onSelectArea,
  onSelectLine,
  onSelectDistributionGroup,
  onSelectBucket,
  onSelectOrder,
  onClearArea,
  onClearLine,
  onClearDistributionGroup,
  onClearBucket,
  workBucketView,
  productRollup,
  productRollupLoading,
  showProductRollupDeferred,
  onSetWorkBucketView
}: DesktopHierarchyPanelProps) {
  const effectiveSelectedAreaLineKey = selectedAreaLineKey ?? selectedLineId ?? null;
  const specialAreaKeySet = new Set(specialAreaSummaries.map((area) => area.areaKey));
  const normalAreaSummaries = areaSummaries.filter((area) => !specialAreaKeySet.has(area.areaKey));
  const selectedArea = areaSummaries.find((a) => a.areaKey === selectedAreaKey);
  const selectedLine = lineHierarchySummaries.find((l) => (l.areaLineKey ?? l.lineId) === effectiveSelectedAreaLineKey);
  const selectedBucketLegacy = workGroupSummaries.find((p) => p.workBucketName === selectedWorkBucketName);
  const detailWorkGroupName = hasDistributionGroups && !!selectedDistributionGroupKey
    ? selectedDistributionGroupWorkGroup?.workBucketName
    : selectedBucketLegacy?.workBucketName;
  const linePdfUrl = buildPickerSheetLinePdfUrl({
    shiftId,
    distributionArea: selectedLine?.distributionArea,
    planningLineName: selectedLine?.lineName
  });
  const linePreviewUrl = buildPickerSheetLinePreviewUrl({
    shiftId,
    distributionArea: selectedLine?.distributionArea,
    planningLineName: selectedLine?.lineName
  });
  const detailPdfUrl = buildPickerSheetWorkGroupPdfUrl({
    shiftId,
    distributionArea: selectedLine?.distributionArea,
    planningLineName: selectedLine?.lineName,
    workGroupName: detailWorkGroupName
  });
  const detailPreviewUrl = buildPickerSheetWorkGroupPreviewUrl({
    shiftId,
    distributionArea: selectedLine?.distributionArea,
    planningLineName: selectedLine?.lineName,
    workGroupName: detailWorkGroupName
  });
  const linePdf = useOpenPickerSheetPdf(linePdfUrl);
  const detailPdf = useOpenPickerSheetPdf(detailPdfUrl);

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
        {specialAreaSummaries.length > 0 && (
          <section className="mb-3" data-testid="special-areas-section">
            <div className="flex flex-wrap gap-2">
              {specialAreaSummaries.map((area) => (
                <button
                  key={area.areaKey}
                  type="button"
                  onClick={() => onSelectArea(area.areaKey)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900 hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer"
                  data-testid={`special-area-chip-${area.areaKey}`}
                  aria-label={`ערוץ מיוחד ${area.displayName}`}
                >
                  <span className="font-semibold">{area.displayName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{area.totalLines} קווים</span>
                  <span aria-hidden="true">·</span>
                  <span>{area.totalBuckets} קבוצות</span>
                  <span aria-hidden="true">·</span>
                  <span>{area.totalOrders} הזמנות</span>
                  <span aria-hidden="true">·</span>
                  <span>{area.totalQuantity} יח׳</span>
                </button>
              ))}
            </div>
          </section>
        )}
        <section data-testid="normal-areas-section">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">אזורי הפצה</h2>
          {normalAreaSummaries.length === 0 ? null : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {normalAreaSummaries.map((area) => (
                <DesktopAreaCard key={area.areaKey} area={area} onClick={onSelectArea} />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const isAutoSkippedSingleLine = effectiveSelectedAreaLineKey !== null && areaLineSummaries.length === 1;

  // ── State 2: Area selected, no line → line cards ────────────────────────
  if (!effectiveSelectedAreaLineKey) {
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

  // ── State 3: Route group selected, but no work bucket yet ──────────────
  if (hasDistributionGroups && selectedDistributionGroupKey && !selectedWorkGroupKey && !selectedWorkBucketName) {
    const selectedDistributionGroup = distributionGroupSummaries.find((rg) => rg.routeGroupKey === selectedDistributionGroupKey);

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
            onClick={onClearDistributionGroup}
            aria-label="חזרה לקבוצות חלוקה"
          >
            {selectedArea?.displayName ?? ''}
          </button>
          <span className="text-xs text-gray-400">&gt;</span>
          <span className="text-xs text-gray-700 font-medium">קבוצת חלוקה: {selectedDistributionGroup?.routeGroupName ?? ''}</span>
        </div>
        {distributionGroupWorkGroupSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">אין קבוצות עבודה בקבוצת חלוקה זו</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">קבוצות עבודה</h2>
              {linePdfUrl && (
                <div className="flex items-center gap-3">
                  {linePreviewUrl && (
                    <Link
                      to={linePreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                      data-testid="print-picker-sheet-line-preview"
                    >
                      תצוגת הדפסה
                    </Link>
                  )}
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400"
                    data-testid="print-picker-sheet-line"
                    disabled={linePdf.isLoading}
                    onClick={() => void linePdf.openPdf()}
                  >
                    {linePdf.isLoading ? 'מכין PDF...' : 'פתח PDF דף ליקוט'}
                  </button>
                </div>
              )}
            </div>
            {linePdf.error && (
              <p className="mb-3 text-xs text-red-600" role="alert">
                {linePdf.error}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {distributionGroupWorkGroupSummaries.map((wb) => (
                <DesktopWorkBucketCard
                  key={wb.workBucketKey}
                  bucket={wb}
                  routeGroupName={selectedDistributionGroup?.routeGroupName}
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
  if (hasDistributionGroups && !selectedDistributionGroupKey && !selectedWorkGroupKey && !selectedWorkBucketName) {
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
        {distributionGroupSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">אין קבוצות חלוקה בקו זה</p>
          </div>
        ) : (
          <>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">קבוצות חלוקה</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {distributionGroupSummaries.map((rg) => (
                <DesktopRouteGroupCard key={rg.routeGroupKey} routeGroup={rg} onClick={onSelectDistributionGroup} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── State 5: Legacy fallback — no route groups, no work bucket selected ──
  if (!selectedWorkGroupKey && !selectedWorkBucketName) {
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
              <span className="text-xs text-gray-700 font-medium">{selectedLine?.lineKind === 'delivery_channel' ? 'ערוץ משלוח: ' : 'קו: '}{selectedLine?.lineName ?? ''}</span>
            </>
          )}
        </div>
        {workGroupSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
            <p className="text-sm font-medium text-gray-500">אין קבוצות עבודה בקו זה</p>
          </div>
        ) : (
          <>
            {isAutoSkippedSingleLine && !!selectedLine && (
              <>
                <p className="text-xs text-gray-500 mb-1">{selectedLine.lineKind === 'delivery_channel' ? 'ערוץ משלוח: ' : 'קו הפצה: '}{selectedLine.lineName}</p>
              </>
            )}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">קבוצות עבודה</h2>
              {linePdfUrl && (
                <div className="flex items-center gap-3">
                  {linePreviewUrl && (
                    <Link
                      to={linePreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                      data-testid="print-picker-sheet-line-preview"
                    >
                      תצוגת הדפסה
                    </Link>
                  )}
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400"
                    data-testid="print-picker-sheet-line"
                    disabled={linePdf.isLoading}
                    onClick={() => void linePdf.openPdf()}
                  >
                    {linePdf.isLoading ? 'מכין PDF...' : 'פתח PDF דף ליקוט'}
                  </button>
                </div>
              )}
            </div>
            {linePdf.error && (
              <p className="mb-3 text-xs text-red-600" role="alert">
                {linePdf.error}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {workGroupSummaries.map((bucket) => (
                <DesktopWorkBucketCard
                  key={bucket.workBucketName}
                  bucket={bucket}
                  lineName={selectedLine?.lineName}
                  onClick={onSelectBucket}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── State 6: Work bucket selected → products/orders ──────────────────────
  // selectedDistributionGroupWorkGroup is the single source of truth for routeGroups mode.
  // It is derived in the parent from the same distributionGroupWorkGroupSummaries list
  // and selectedWorkGroupKey.  Do not add a secondary find fallback here —
  // the Products tab pointName derivation and showProductRollupDeferred in the
  // parent depend on exactly the same bucket object.
  const isDistributionGroupBucket = hasDistributionGroups && !!selectedDistributionGroupKey;
  const selectedDistributionGroup = isDistributionGroupBucket
    ? distributionGroupSummaries.find((rg) => rg.routeGroupKey === selectedDistributionGroupKey)
    : undefined;

  const bucketOrders = isDistributionGroupBucket
    ? (selectedDistributionGroupWorkGroup?.orders ?? [])
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
        {isDistributionGroupBucket ? (
          <>
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={onClearDistributionGroup}
              aria-label={`חזרה לקבוצות חלוקה באזור ${selectedArea?.displayName ?? ''}`}
            >
              {selectedArea?.displayName ?? ''}
            </button>
            <span className="text-xs text-gray-400">&gt;</span>
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={onClearDistributionGroup}
              aria-label={`חזרה לקבוצות עבודה בקבוצת חלוקה ${selectedDistributionGroup?.routeGroupName ?? ''}`}
            >
              קבוצת חלוקה: {selectedDistributionGroup?.routeGroupName ?? ''}
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
              aria-label={`חזרה לקבוצות עבודה ${selectedLine?.lineKind === 'delivery_channel' ? 'ערוץ משלוח' : 'קו'} ${selectedLine?.lineName ?? ''}`}
            >
              {selectedLine?.lineKind === 'delivery_channel' ? 'ערוץ משלוח: ' : 'קו: '}{selectedLine?.lineName ?? ''}
            </button>
          </>
        )}
        <span className="text-xs text-gray-400">&gt;</span>
        <span className="text-xs text-gray-700 font-medium">קבוצת עבודה: {selectedWorkBucketName}</span>
      </div>

      <div className="flex gap-2 mb-4 items-center">
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
        <div className="grow" />
        {detailPdfUrl && (
          <div className="flex items-center gap-3">
            {detailPreviewUrl && (
              <Link
                to={detailPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                data-testid="print-picker-sheet-detail-preview"
              >
                תצוגת הדפסה
              </Link>
            )}
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400"
              data-testid="print-picker-sheet-detail"
              disabled={detailPdf.isLoading}
              onClick={() => void detailPdf.openPdf()}
            >
              {detailPdf.isLoading ? 'מכין PDF...' : 'פתח PDF דף ליקוט'}
            </button>
          </div>
        )}
      </div>
      {detailPdf.error && (
        <p className="mb-3 text-xs text-red-600" role="alert">
          {detailPdf.error}
        </p>
      )}

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
