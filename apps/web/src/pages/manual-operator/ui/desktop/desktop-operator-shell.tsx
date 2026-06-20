import type { BucketProductRollupRow, ManualShiftSession } from '@wos/domain';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  AreaHierarchySummary,
  LineHierarchySummary,
  OrderDetail,
  RouteGroupSummary,
  RouteGroupWorkBucketSummary,
  WorkBucketSummary,
  ShiftSummary
} from '@/entities/manual-shift/model/shift-selectors';
import { DesktopDetailDrawer } from './desktop-detail-drawer';
import { DesktopEmptyState } from './desktop-empty-state';
import { DesktopHierarchyPanel } from './desktop-hierarchy-panel';
import { DesktopKpiRow } from './desktop-kpi-row';

export interface DesktopOperatorShellProps {
  shift: ManualShiftSession | null;
  isLoading: boolean;
  kpi: ShiftSummary | undefined;
  orderDetail: OrderDetail | null;
  selectedDetailType: 'order' | null;
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
  showProductRollupDeferred: boolean;
  onSelectOrder: (orderId: string) => void;
  onCloseDetail: () => void;
  onSelectArea: (areaName: string | null) => void;
  onSelectHierarchyLine: (lineId: string) => void;
  onSelectHierarchyRouteGroup: (routeGroupKey: string) => void;
  onSelectHierarchyBucket: (workBucketIdentifier: string) => void;
  onClearArea: () => void;
  onClearHierarchyLine: () => void;
  onClearHierarchyRouteGroup: () => void;
  onClearHierarchyBucket: () => void;
  workBucketView: 'products' | 'orders';
  productRollup: BucketProductRollupRow[] | undefined;
  productRollupLoading: boolean;
  onSetWorkBucketView: (view: 'products' | 'orders') => void;
  onCreateShift: () => void;
  isCreatingShift: boolean;
  selectedDate: string;
  todayDate: string;
  onChangeDate: (date: string) => void;
  onOpenDatePicker: () => void;
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-full gap-4 p-6 animate-pulse" aria-label="טוען נתונים">
      <div className="flex gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-14 w-16 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="flex flex-1 gap-px">
        <div className="flex-1 bg-gray-100 rounded" />
        <div className="w-72 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

function formatSelectedDate(dateYmd: string): string {
  const [year, month, day] = dateYmd.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(year, month - 1, day));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem'
  }).format(new Date(value));
}

function shiftDate(base: string, offsetDays: number): string {
  const [year, month, day] = base.split('-').map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + offsetDays);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DesktopOperatorShell({
  shift,
  isLoading,
  kpi,
  orderDetail,
  selectedDetailType,
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
  showProductRollupDeferred,
  onSelectOrder,
  onCloseDetail,
  onSelectArea,
  onSelectHierarchyLine,
  onSelectHierarchyRouteGroup,
  onSelectHierarchyBucket,
  onClearArea,
  onClearHierarchyLine,
  onClearHierarchyRouteGroup,
  onClearHierarchyBucket,
  workBucketView,
  productRollup,
  productRollupLoading,
  onSetWorkBucketView,
  onCreateShift,
  isCreatingShift,
  selectedDate,
  todayDate,
  onChangeDate,
  onOpenDatePicker
}: DesktopOperatorShellProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-dvh bg-gray-50" dir="rtl">
        <LoadingSkeleton />
      </div>
    );
  }

  const drawerState =
    selectedDetailType === 'order'
      ? { type: 'order' as const, detail: orderDetail }
      : null;
  const isTodaySelected = selectedDate === todayDate;
  const headerTitle = shift?.name ?? 'אין משמרת פעילה';
  const headerDateLabel = formatSelectedDate(selectedDate);
  const normalizedTitle = headerTitle.replace(/\s+/g, ' ').trim();
  const normalizedDate = headerDateLabel.replace(/\s+/g, ' ').trim();
  const titleContainsDate = normalizedTitle.includes(normalizedDate);
  const headerTimeLabel = shift ? formatTime(shift.createdAt) : null;
  const headerSubtitle =
    !shift ? headerDateLabel : titleContainsDate ? headerTimeLabel : `${headerDateLabel} · ${headerTimeLabel}`;

  return (
    <div className="flex flex-col h-dvh bg-gray-100 overflow-hidden" dir="rtl">
      <header className="flex items-center gap-4 px-4 h-14 bg-white border-b border-gray-200 shrink-0">
        <button
          type="button"
          onClick={onOpenDatePicker}
          className="shrink-0 text-right rounded-md px-1 py-0.5 hover:bg-gray-50"
          aria-label="פתח לוח שנה"
        >
          <p className="font-bold text-gray-900 text-sm leading-tight">{headerTitle}</p>
          <p className="text-xs text-gray-500">{headerSubtitle}</p>
        </button>
        <div className="w-px h-8 bg-gray-200 shrink-0" />
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChangeDate(shiftDate(selectedDate, -1))}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
            aria-label="תאריך קודם"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onChangeDate(shiftDate(selectedDate, 1))}
            disabled={isTodaySelected}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="תאריך הבא"
          >
            <ChevronRight size={16} />
          </button>
          {!isTodaySelected && (
            <button
              type="button"
              onClick={() => onChangeDate(todayDate)}
              className="px-2 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              היום
            </button>
          )}
        </div>
        <div className="w-px h-8 bg-gray-200 shrink-0" />
        {kpi ? (
          <DesktopKpiRow summary={kpi} />
        ) : (
          <div className="flex gap-2 animate-pulse">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-10 w-12 bg-gray-200 rounded-lg" />
            ))}
          </div>
        )}
      </header>

      {!shift ? (
        <div className="flex flex-1 bg-gray-50">
          <DesktopEmptyState onCreateShift={onCreateShift} isCreating={isCreatingShift} />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden gap-px">
          <main className="flex-1 bg-white overflow-y-auto min-w-0">
            <DesktopHierarchyPanel
              selectedAreaKey={selectedAreaKey}
              selectedLineId={selectedLineId}
              selectedRouteGroupKey={selectedRouteGroupKey}
              selectedWorkBucketKey={selectedWorkBucketKey}
              selectedWorkBucketName={selectedWorkBucketName}
              areaSummaries={areaSummaries}
              lineHierarchySummaries={lineHierarchySummaries}
              areaLineSummaries={areaLineSummaries}
              workBucketSummaries={workBucketSummaries}
              routeGroupSummaries={routeGroupSummaries}
              routeGroupWorkBucketSummaries={routeGroupWorkBucketSummaries}
              hasRouteGroups={hasRouteGroups}
              showProductRollupDeferred={showProductRollupDeferred}
              onSelectArea={onSelectArea}
              onSelectLine={onSelectHierarchyLine}
              onSelectRouteGroup={onSelectHierarchyRouteGroup}
              onSelectBucket={onSelectHierarchyBucket}
              onSelectOrder={onSelectOrder}
              onClearArea={onClearArea}
              onClearLine={onClearHierarchyLine}
              onClearRouteGroup={onClearHierarchyRouteGroup}
              onClearBucket={onClearHierarchyBucket}
              workBucketView={workBucketView}
              productRollup={productRollup}
              productRollupLoading={productRollupLoading}
              onSetWorkBucketView={onSetWorkBucketView}
            />
          </main>

          <DesktopDetailDrawer
            state={drawerState}
            onClose={onCloseDetail}
            onSelectOrder={onSelectOrder}
          />
        </div>
      )}
    </div>
  );
}
