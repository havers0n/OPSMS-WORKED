import type { ManualShiftSession } from '@wos/domain';
import type {
  ActiveOrder,
  CheckQueue,
  LineSummary,
  PickerWorkload,
  ShiftSummary
} from '@/entities/manual-shift/model/shift-selectors';
import { DesktopEmptyState } from './desktop-empty-state';
import { DesktopKpiRow } from './desktop-kpi-row';
import { DesktopLinePanel } from './desktop-line-panel';
import { DesktopOrdersPanel } from './desktop-orders-panel';
import { DesktopPickerPanel } from './desktop-picker-panel';

interface DesktopOperatorShellProps {
  shift: ManualShiftSession | null;
  isLoading: boolean;
  kpi: ShiftSummary | undefined;
  lineSummaries: LineSummary[];
  activeOrders: ActiveOrder[];
  pickerWorkloads: PickerWorkload[];
  checkQueue: CheckQueue;
  onCreateShift: () => void;
  isCreatingShift: boolean;
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

function formatDate(): string {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());
}

export function DesktopOperatorShell({
  shift,
  isLoading,
  kpi,
  lineSummaries,
  activeOrders,
  pickerWorkloads,
  checkQueue,
  onCreateShift,
  isCreatingShift
}: DesktopOperatorShellProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-dvh bg-gray-50" dir="rtl">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="flex flex-col h-dvh bg-gray-50" dir="rtl">
        <DesktopEmptyState onCreateShift={onCreateShift} isCreating={isCreatingShift} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-100 overflow-hidden" dir="rtl">
      <header className="flex items-center gap-4 px-4 h-14 bg-white border-b border-gray-200 shrink-0">
        <div className="shrink-0">
          <p className="font-bold text-gray-900 text-sm leading-tight">{shift.name}</p>
          <p className="text-xs text-gray-500">{formatDate()}</p>
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

      <div className="flex flex-1 overflow-hidden gap-px">
        <aside className="w-72 bg-white overflow-y-auto shrink-0">
          <DesktopLinePanel lines={lineSummaries} />
        </aside>

        <main className="flex-1 bg-white overflow-y-auto min-w-0">
          <DesktopOrdersPanel orders={activeOrders} lineSummaries={lineSummaries} />
        </main>

        <aside className="w-72 bg-white overflow-y-auto shrink-0">
          <DesktopPickerPanel pickers={pickerWorkloads} checkQueue={checkQueue} />
        </aside>
      </div>
    </div>
  );
}
