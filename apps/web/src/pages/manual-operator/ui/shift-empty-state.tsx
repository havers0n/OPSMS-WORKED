interface ShiftEmptyStateProps {
  onCreateShift?: () => void;
  isCreating?: boolean;
}

export function ShiftEmptyState({ onCreateShift, isCreating }: ShiftEmptyStateProps) {
  const isPastDate = !onCreateShift;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-8 gap-6 text-center" dir="rtl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl">
          {isPastDate ? '-' : '+'}
        </div>
        <h2 className="font-bold text-xl text-gray-900">No shift</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          {isPastDate
            ? 'No shift found for this date. Create or open a shift before importing the Excel file.'
            : 'No open shift for today. Open a shift to start the queue.'}
        </p>
      </div>

      {!isPastDate && (
        <button
          onClick={onCreateShift}
          disabled={isCreating}
          className="w-full max-w-xs bg-gray-900 text-white font-bold py-4 px-6 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 text-lg"
        >
          {isCreating ? 'Opening shift...' : 'Open shift for today'}
        </button>
      )}
    </div>
  );
}
