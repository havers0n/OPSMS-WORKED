import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEK_DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

interface ShiftDatePickerProps {
  selectedDate: string;     // YYYY-MM-DD
  todayDate: string;        // YYYY-MM-DD
  maxSelectableDate?: string; // YYYY-MM-DD (defaults to todayDate)
  onSelect: (date: string) => void;
  onClose: () => void;
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface CalendarCell {
  day: number | null;
  dateStr: string | null;
}

function getCalendarCells(year: number, month: number): CalendarCell[] {
  // month is 0-indexed
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  // Leading empty cells
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: null, dateStr: null });
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toYmd(new Date(year, month, d)) });
  }

  return cells;
}

export function ShiftDatePicker({
  selectedDate,
  todayDate,
  maxSelectableDate,
  onSelect,
  onClose
}: ShiftDatePickerProps) {
  const [viewYear, setViewYear] = useState(() => Number(selectedDate.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(selectedDate.slice(5, 7)) - 1);

  const cells = getCalendarCells(viewYear, viewMonth);

  const maxDateStr = maxSelectableDate ?? todayDate;
  const maxYear = Number(maxDateStr.slice(0, 4));
  const maxMonth = Number(maxDateStr.slice(5, 7)) - 1;
  const isAtMaxMonth = viewYear > maxYear || (viewYear === maxYear && viewMonth >= maxMonth);

  const monthLabel = new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    year: 'numeric'
  }).format(new Date(viewYear, viewMonth, 1));

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  }

  function goToNextMonth() {
    if (isAtMaxMonth) return;
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  }

  function handleDayClick(dateStr: string) {
    onSelect(dateStr);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative w-full max-w-[430px] bg-white rounded-t-2xl shadow-2xl px-5 pt-5 pb-8 flex flex-col gap-5">

        {/* Handle bar */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-200 rounded-full" />

        {/* Title row */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900">בחר תאריך</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200"
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>

        {/* Month navigation — RTL: right button = next, left button = prev */}
        <div className="flex items-center justify-between">
          {/* RIGHT side in RTL = next month */}
          <button
            onClick={goToNextMonth}
            disabled={isAtMaxMonth}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 disabled:opacity-25 transition-opacity"
            aria-label="חודש הבא"
          >
            <ChevronRight size={20} />
          </button>

          <span className="font-semibold text-base text-gray-800">{monthLabel}</span>

          {/* LEFT side in RTL = prev month */}
          <button
            onClick={goToPrevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="חודש קודם"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 text-center">
          {WEEK_DAYS_SHORT.map(d => (
            <div key={d} className="text-xs font-semibold text-gray-400 py-0.5">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 text-center gap-y-1">
          {cells.map((cell, i) => {
            if (!cell.day || !cell.dateStr) {
              return <div key={`empty-${i}`} />;
            }

            const isFuture = cell.dateStr > maxDateStr;
            const isToday = cell.dateStr === todayDate;
            const isSelected = cell.dateStr === selectedDate;

            let cellClass =
              'w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-all select-none';

            if (isFuture) {
              cellClass += ' text-gray-200 cursor-default';
            } else if (isSelected) {
              cellClass += ' bg-gray-900 text-white shadow-sm active:scale-95';
            } else if (isToday) {
              cellClass +=
                ' border-2 border-gray-800 text-gray-900 hover:bg-gray-50 active:scale-95 cursor-pointer';
            } else {
              cellClass +=
                ' text-gray-700 hover:bg-gray-100 active:scale-95 cursor-pointer';
            }

            return (
              <button
                key={cell.dateStr}
                disabled={isFuture}
                onClick={() => handleDayClick(cell.dateStr!)}
                className={cellClass}
                aria-label={cell.dateStr}
                aria-pressed={isSelected}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        {/* "Go to today" shortcut */}
        {selectedDate !== todayDate && (
          <button
            onClick={() => handleDayClick(todayDate)}
            className="w-full py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all"
          >
            עבור להיום
          </button>
        )}
      </div>
    </div>
  );
}
