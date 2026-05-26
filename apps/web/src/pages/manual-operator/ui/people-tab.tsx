import { useQuery } from '@tanstack/react-query';
import { Loader2, User } from 'lucide-react';
import type { ManualShiftPeopleSummaryItem } from '@wos/domain';
import { peopleSummaryQueryOptions } from '@/entities/manual-shift/api/queries';

interface PeopleTabProps {
  shiftId: string;
}

export function PeopleTab({ shiftId }: PeopleTabProps) {
  const { data, isLoading } = useQuery(peopleSummaryQueryOptions(shiftId));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-4">
        <User size={48} className="text-gray-300" />
        <p className="text-gray-400 font-medium text-base">אין מלקטים פעילים</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {data.items.map((item, i) => (
        <PickerCard key={item.pickerName || i} item={item} />
      ))}
    </div>
  );
}

function PickerCard({ item }: { item: ManualShiftPeopleSummaryItem }) {
  const name = item.pickerName || 'ללא מלקט';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-base shrink-0">
          {name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base truncate">{name}</p>
          {item.currentActiveOrder && (
            <p className="text-sm text-blue-600 truncate">
              פעיל: {item.currentActiveOrder.pointName ?? 'ללא נקודה'}
            </p>
          )}
        </div>
        {item.errorCount > 0 && (
          <span className="text-xs text-red-600 font-bold bg-red-50 border border-red-100 rounded-full px-2 py-0.5 shrink-0">
            {item.errorCount} תקלות
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <StatCell label="פעיל" value={item.activeOrdersCount} color="blue" />
        <StatCell label="בדיקה" value={item.waitingCheckCount} color="amber" />
        <StatCell label="הוחזר" value={item.returnedCount} color="red" />
        <StatCell label="הסתיים" value={item.doneCount} color="green" />
      </div>
    </div>
  );
}

type StatColor = 'blue' | 'amber' | 'red' | 'green';

function StatCell({ label, value, color }: { label: string; value: number; color: StatColor }) {
  const colorMap: Record<StatColor, string> = {
    blue: 'text-blue-700 bg-blue-50',
    amber: 'text-amber-700 bg-amber-50',
    red: 'text-red-700 bg-red-50',
    green: 'text-green-700 bg-green-50'
  };

  return (
    <div className={`rounded-lg p-2 ${colorMap[color]}`}>
      <p className="font-bold text-lg leading-none">{value}</p>
      <p className="text-xs mt-1 font-medium">{label}</p>
    </div>
  );
}
