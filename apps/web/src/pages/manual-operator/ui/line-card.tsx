import type { ManualShiftLineSummary } from '@wos/domain';

const LINE_STATUS_LABELS: Record<string, string> = {
  open: 'פתוח',
  in_progress: 'בתהליך',
  done: 'הסתיים'
};

const LINE_STATUS_COLORS: Record<string, string> = {
  open: 'bg-gray-100 text-gray-700 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  done: 'bg-green-100 text-green-700 border-green-200'
};

interface LineCardProps {
  summary: ManualShiftLineSummary;
}

export function LineCard({ summary }: LineCardProps) {
  const { line, totalOrders, queuedOrders, pickingOrders, waitingCheckOrders, returnedOrders, doneOrders } = summary;
  const statusLabel = LINE_STATUS_LABELS[line.status] ?? line.status;
  const statusColor = LINE_STATUS_COLORS[line.status] ?? 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm" dir="rtl">
      <div className="flex justify-between items-start gap-2">
        <span className="font-bold text-lg text-gray-900">{line.name}</span>
        <span className={`px-2.5 py-1 text-sm font-bold rounded-md border shrink-0 ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {totalOrders > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm bg-gray-50 p-2.5 rounded-lg border border-gray-100">
          <span className="text-gray-700">סה״כ: <strong>{totalOrders}</strong></span>
          {queuedOrders > 0 && <span className="text-gray-500">תור: {queuedOrders}</span>}
          {pickingOrders > 0 && <span className="text-blue-600">ליקוט: {pickingOrders}</span>}
          {waitingCheckOrders > 0 && <span className="text-amber-600">בדיקה: {waitingCheckOrders}</span>}
          {returnedOrders > 0 && <span className="text-red-600">תיקון: {returnedOrders}</span>}
          {doneOrders > 0 && <span className="text-green-600">הסתיים: {doneOrders}</span>}
        </div>
      ) : (
        <div className="text-sm text-gray-400">אין הזמנות בקו זה</div>
      )}
    </div>
  );
}
