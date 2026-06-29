import { Loader2 } from 'lucide-react';
import type { ManualShiftSession } from '@wos/domain';

interface AppendCurrentShiftHeaderProps {
  targetShift: ManualShiftSession | null;
  isLoading: boolean;
  ordersCount: number;
}

export function AppendCurrentShiftHeader({
  targetShift,
  isLoading,
  ordersCount,
}: AppendCurrentShiftHeaderProps) {
  if (isLoading || !targetShift) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 size={16} className="animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">טוען פרטי משמרת...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{targetShift.name}</h2>
        <p className="text-xs text-gray-500">
          {ordersCount} הזמנות במשמרת
          <span className={`mx-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
            targetShift.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {targetShift.status === 'active' ? 'פעילה' : 'סגורה'}
          </span>
        </p>
      </div>
    </div>
  );
}
