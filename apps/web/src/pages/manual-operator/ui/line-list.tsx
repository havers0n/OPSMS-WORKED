import type { ManualShiftLineSummary } from '@wos/domain';
import { LineCard } from './line-card';

interface LineListProps {
  lines: ManualShiftLineSummary[];
}

export function LineList({ lines }: LineListProps) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-3" dir="rtl">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
          📦
        </div>
        <p className="text-gray-500 text-sm">אין קווים עדיין. לחץ על + להוסיף קו חדש.</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-8 flex flex-col gap-3" dir="rtl">
      {lines.map((summary) => (
        <LineCard key={summary.line.id} summary={summary} />
      ))}
    </div>
  );
}
