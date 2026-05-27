import { Loader2 } from 'lucide-react';

interface DesktopEmptyStateProps {
  onCreateShift: () => void;
  isCreating: boolean;
}

export function DesktopEmptyState({ onCreateShift, isCreating }: DesktopEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6" dir="rtl">
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-800 mb-2">אין משמרת פעילה</p>
        <p className="text-gray-500 text-sm">פתח משמרת כדי להתחיל לעקוב אחר ההזמנות</p>
      </div>
      <button
        onClick={onCreateShift}
        disabled={isCreating}
        className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm disabled:opacity-60"
      >
        {isCreating && <Loader2 size={16} className="animate-spin" />}
        פתח משמרת להיום
      </button>
    </div>
  );
}