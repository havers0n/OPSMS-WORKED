import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Loader2 } from 'lucide-react';
import { shiftByDateQueryOptions } from '@/entities/manual-shift/api/queries';

export function DateShiftSelector({
  selectedDate,
  onSelectDate,
  shiftId,
}: {
  selectedDate: string;
  onSelectDate: (date: string, shiftId: string | null) => void;
  shiftId: string | null;
}) {
  const [dateInput, setDateInput] = useState(selectedDate);
  const { data, isLoading } = useQuery(shiftByDateQueryOptions(dateInput));

  const currentShiftId = shiftId ?? data?.shift?.id ?? null;

  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2.5 shadow-sm">
      <Calendar size={18} className="text-gray-400 shrink-0" />
      <input
        type="date"
        value={dateInput}
        onChange={(e) => {
          setDateInput(e.target.value);
          onSelectDate(e.target.value, data?.shift?.id ?? null);
        }}
        className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        dir="ltr"
      />
      {isLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
      {!isLoading && !currentShiftId && (
        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
          אין משמרת לתאריך זה
        </span>
      )}
    </div>
  );
}
