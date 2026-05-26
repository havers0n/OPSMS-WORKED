import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ManualShiftBulkAddResult } from '@wos/domain';
import { useBulkCreateManualShiftOrders } from '@/entities/manual-shift/api/mutations';

interface BulkPasteSheetProps {
  lineId: string;
  onClose: () => void;
}

export function BulkPasteSheet({ lineId, onClose }: BulkPasteSheetProps) {
  const [rawText, setRawText] = useState('');
  const [result, setResult] = useState<ManualShiftBulkAddResult | null>(null);

  const bulkCreate = useBulkCreateManualShiftOrders(lineId);

  function handleSubmit() {
    if (!rawText.trim()) return;
    bulkCreate.mutate({ rawText }, { onSuccess: data => setResult(data) });
  }

  if (result) {
    return (
      <div className="absolute inset-0 bg-white z-20 flex flex-col pb-16" dir="rtl">
        <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500"
          >
            <ArrowRight size={24} />
          </button>
          <h2 className="font-bold text-xl flex-1 text-gray-900">תוצאות הייבוא</h2>
        </header>

        <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 text-right">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <span className="font-bold text-green-800 text-lg">
              נוצרו {result.createdCount} הזמנות
            </span>
          </div>

          {result.skippedRows.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col gap-2">
              <span className="font-bold text-amber-800">
                שורות שנדלגו ({result.skippedRows.length})
              </span>
              {result.skippedRows.map((row, i) => (
                <span key={i} className="text-sm text-amber-700 font-mono">
                  {row}
                </span>
              ))}
            </div>
          )}
        </main>

        <footer className="shrink-0 border-t border-gray-200 bg-white p-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform"
          >
            סיים
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-white z-20 flex flex-col pb-16" dir="rtl">
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          onClick={onClose}
          className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500"
        >
          <ArrowRight size={24} />
        </button>
        <h2 className="font-bold text-xl flex-1 text-gray-900">הוסף מרובה</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 text-right">
        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700">הזן הזמנות (שורה אחת לכל הזמנה)</label>
          <p className="text-sm text-gray-500 leading-relaxed">
            פורמט: נקודה, מלקט, מספר שורות, מספר משטחים
            <br />
            דוגמאות:
            <span className="block font-mono text-gray-700 mt-1">ירושלים</span>
            <span className="block font-mono text-gray-700">ירושלים, יהודה</span>
            <span className="block font-mono text-gray-700">תל אביב, רפאל, 12</span>
            <span className="block font-mono text-gray-700">תל אביב, רפאל, 12, 3</span>
          </p>
          <textarea
            className="w-full bg-gray-50 border border-gray-300 rounded-xl p-4 text-base font-mono min-h-[200px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder={'ירושלים\nירושלים, יהודה\nתל אביב, רפאל, 12'}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            dir="ltr"
          />
        </div>
      </main>

      <footer className="shrink-0 border-t border-gray-200 bg-white p-4">
        <button
          onClick={handleSubmit}
          disabled={!rawText.trim() || bulkCreate.isPending}
          className="w-full bg-gray-900 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {bulkCreate.isPending ? 'מייבא...' : 'ייבא הזמנות'}
        </button>
      </footer>
    </div>
  );
}
