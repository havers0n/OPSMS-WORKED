import { useQuery } from '@tanstack/react-query';
import { Loader2, Download } from 'lucide-react';
import { daySummaryQueryOptions, shiftOrdersQueryOptions } from '@/entities/manual-shift/api/queries';
import { exportShiftOrdersCSV } from './export-utils';

const ERROR_TYPE_LABELS: Record<string, string> = {
  wrong_quantity: 'כמות לא נכונה',
  wrong_item: 'פריט שגוי',
  missing_item: 'פריט חסר',
  bad_packing: 'אריזה פגומה',
  small_items_loose: 'פריטים קטנים בתפזורת',
  damaged: 'פגום',
  other: 'אחר'
};

interface DayTabProps {
  shiftId: string;
  shiftName: string;
}

export function DayTab({ shiftId, shiftName }: DayTabProps) {
  const { data: summary, isLoading } = useQuery(daySummaryQueryOptions(shiftId));
  const { data: orders = [] } = useQuery(shiftOrdersQueryOptions(shiftId));

  function handleExport() {
    const lineNameMap = new Map(
      (summary?.byLine ?? []).map(ls => [ls.line.id, ls.line.name])
    );
    exportShiftOrdersCSV(orders, lineNameMap, shiftName);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-4">
        <p className="text-gray-400 font-medium text-base">אין נתוני יום</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <button
        onClick={handleExport}
        disabled={orders.length === 0}
        className="w-full h-12 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
        aria-label="ייצא CSV"
      >
        <Download size={20} />
        ייצא CSV
      </button>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h3 className="font-bold text-gray-800 text-lg mb-3">סיכום יום</h3>
        <div className="grid grid-cols-2 gap-3">
          <TotalCell label="סה״כ נקודות" value={summary.totalOrders} />
          <TotalCell label="הסתיימו" value={summary.doneOrders} color="green" />
          <TotalCell label="ממתינות בדיקה" value={summary.waitingCheckOrders} color="amber" />
          <TotalCell label="הוחזרו" value={summary.returnedOrders} color="red" />
          <TotalCell label="בליקוט" value={summary.pickingOrders} color="blue" />
          <TotalCell label="בתור" value={summary.queuedOrders} />
        </div>
        {summary.errorsCount > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-red-600 font-bold text-sm">{summary.errorsCount} תקלות</p>
          </div>
        )}
      </div>

      {summary.byErrorType.length > 0 && (
        <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-red-700 text-base mb-3">פירוט תקלות</h3>
          <div className="flex flex-col gap-2">
            {summary.byErrorType.map(err => (
              <div key={err.type} className="flex justify-between items-center text-sm">
                <span className="text-gray-700">{ERROR_TYPE_LABELS[err.type] ?? err.type}</span>
                <span className="font-bold text-red-700">{err.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.byLine.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-800 text-base mb-3">לפי קו</h3>
          <div className="flex flex-col gap-3">
            {summary.byLine.map(ls => (
              <div key={ls.line.id} className="flex flex-col gap-1">
                <p className="font-bold text-gray-800 text-sm">{ls.line.name}</p>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>סה״כ: {ls.totalOrders}</span>
                  {ls.doneOrders > 0 && (
                    <span className="text-green-600">הסתיים: {ls.doneOrders}</span>
                  )}
                  {ls.waitingCheckOrders > 0 && (
                    <span className="text-amber-600">בדיקה: {ls.waitingCheckOrders}</span>
                  )}
                  {ls.returnedOrders > 0 && (
                    <span className="text-red-600">הוחזר: {ls.returnedOrders}</span>
                  )}
                  {ls.errorCount > 0 && (
                    <span className="text-red-500">תקלות: {ls.errorCount}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.byPicker.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-800 text-base mb-3">לפי מלקט</h3>
          <div className="flex flex-col gap-3">
            {summary.byPicker.map(p => (
              <div key={p.pickerName} className="flex flex-col gap-1">
                <p className="font-bold text-gray-800 text-sm">{p.pickerName}</p>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>סה״כ: {p.totalOrders}</span>
                  {p.doneOrders > 0 && (
                    <span className="text-green-600">הסתיים: {p.doneOrders}</span>
                  )}
                  {p.errorCount > 0 && (
                    <span className="text-red-600">תקלות: {p.errorCount}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type TotalColor = 'green' | 'amber' | 'red' | 'blue';

function TotalCell({
  label,
  value,
  color
}: {
  label: string;
  value: number;
  color?: TotalColor;
}) {
  const colorMap: Record<TotalColor, string> = {
    green: 'text-green-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    blue: 'text-blue-700'
  };

  return (
    <div className="flex flex-col gap-1 bg-gray-50 rounded-lg p-3">
      <span className={`font-bold text-2xl ${color ? colorMap[color] : 'text-gray-900'}`}>
        {value}
      </span>
      <span className="text-xs text-gray-500 font-medium">{label}</span>
    </div>
  );
}
