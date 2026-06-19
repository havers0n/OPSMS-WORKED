import type { BucketProductRollupRow, ManualShiftSession } from '@wos/domain';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  AreaHierarchySummary,
  CheckQueue,
  LineHierarchySummary,
  OrderDetail,
  PickerDetail,
  PickerWorkload,
  WorkBucketSummary,
  ShiftSummary
} from '@/entities/manual-shift/model/shift-selectors';
import { DesktopDetailDrawer } from './desktop-detail-drawer';
import { DesktopEmptyState } from './desktop-empty-state';
import { DesktopHierarchyPanel } from './desktop-hierarchy-panel';
import { DesktopKpiRow } from './desktop-kpi-row';
import { DesktopLinePanel } from './desktop-line-panel';
import { DesktopPickerPanel } from './desktop-picker-panel';
import { ShiftOpenAshlamotBoard } from '../shift-open-ashlamot-board';

export interface DesktopOperatorShellProps {
  shift: ManualShiftSession | null;
  isLoading: boolean;
  kpi: ShiftSummary | undefined;
  pickerWorkloads: PickerWorkload[];
  checkQueue: CheckQueue;
  pickerDetail: PickerDetail | null;
  orderDetail: OrderDetail | null;
  selectedDetailType: 'picker' | 'order' | null;
  selectedAreaKey: string | null;
  selectedLineId: string | null;
  selectedWorkBucketName: string | null;
  areaSummaries: AreaHierarchySummary[];
  lineHierarchySummaries: LineHierarchySummary[];
  areaLineSummaries: LineHierarchySummary[];
  workBucketSummaries: WorkBucketSummary[];
  onSelectPicker: (pickerKey: string) => void;
  onSelectOrder: (orderId: string) => void;
  onCloseDetail: () => void;
  onSelectArea: (areaName: string | null) => void;
  onSelectHierarchyLine: (lineId: string) => void;
  onSelectHierarchyBucket: (workBucketName: string) => void;
  onClearArea: () => void;
  onClearHierarchyLine: () => void;
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
  canInteract: boolean;
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
        <div className="w-72 bg-gray-100 rounded" />
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
  pickerWorkloads,
  checkQueue,
  pickerDetail,
  orderDetail,
  selectedDetailType,
  selectedAreaKey,
  selectedLineId,
  selectedWorkBucketName,
  areaSummaries,
  lineHierarchySummaries,
  areaLineSummaries,
  workBucketSummaries,
  onSelectPicker,
  onSelectOrder,
  onCloseDetail,
  onSelectArea,
  onSelectHierarchyLine,
  onSelectHierarchyBucket,
  onClearArea,
  onClearHierarchyLine,
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
  onOpenDatePicker,
  canInteract
}: DesktopOperatorShellProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-dvh bg-gray-50" dir="rtl">
        <LoadingSkeleton />
      </div>
    );
  }

  const drawerState =
    selectedDetailType === 'picker'
      ? {
          type: 'picker' as const,
          detail: pickerDetail ?? { summary: null, orders: [], lineBreakdown: [] }
        }
      : selectedDetailType === 'order'
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
          <aside className="w-72 bg-white overflow-y-auto shrink-0">
            <DesktopLinePanel
              lines={lineHierarchySummaries}
              selectedLineId={selectedLineId}
              onSelectLine={onSelectHierarchyLine}
            />
          </aside>

          <main className="flex-1 bg-white overflow-y-auto min-w-0">
            <DesktopHierarchyPanel
              selectedAreaKey={selectedAreaKey}
              selectedLineId={selectedLineId}
              selectedWorkBucketName={selectedWorkBucketName}
              areaSummaries={areaSummaries}
              lineHierarchySummaries={lineHierarchySummaries}
              areaLineSummaries={areaLineSummaries}
              workBucketSummaries={workBucketSummaries}
              onSelectArea={onSelectArea}
              onSelectLine={onSelectHierarchyLine}
              onSelectBucket={onSelectHierarchyBucket}
              onSelectOrder={onSelectOrder}
              onClearArea={onClearArea}
              onClearLine={onClearHierarchyLine}
              onClearBucket={onClearHierarchyBucket}
              workBucketView={workBucketView}
              productRollup={productRollup}
              productRollupLoading={productRollupLoading}
              onSetWorkBucketView={onSetWorkBucketView}
            />
          </main>

          {!drawerState && (
            <aside className="w-72 bg-white overflow-y-auto shrink-0">
              <div className="p-3 border-b border-gray-100">
                <ShiftOpenAshlamotBoard
                  shiftId={shift.id}
                  canInteract={canInteract}
                  variant="desktop"
                />
              </div>
              <DesktopPickerPanel
                pickers={pickerWorkloads}
                checkQueue={checkQueue}
                onSelectPicker={onSelectPicker}
              />
            </aside>
          )}

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
