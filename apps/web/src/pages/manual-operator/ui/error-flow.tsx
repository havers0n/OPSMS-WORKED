import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ManualShiftOrderErrorType } from '@wos/domain';
import { useCreateManualShiftOrderError } from '@/entities/manual-shift/api/mutations';

const ERROR_TYPE_LABELS: Record<ManualShiftOrderErrorType, string> = {
  wrong_quantity: 'כמות לא נכונה',
  wrong_item: 'פריט שגוי',
  missing_item: 'פריט חסר',
  bad_packing: 'אריזה פגומה',
  small_items_loose: 'פריטים קטנים בתפזורת',
  damaged: 'פגום',
  other: 'אחר'
};

const ERROR_TYPES: ManualShiftOrderErrorType[] = [
  'wrong_quantity',
  'wrong_item',
  'missing_item',
  'bad_packing',
  'small_items_loose',
  'damaged',
  'other'
];

interface ErrorFlowProps {
  orderId: string;
  lineId: string;
  orderNumber: string | null;
  onClose: () => void;
}

export function ErrorFlow({ orderId, lineId, orderNumber, onClose }: ErrorFlowProps) {
  const [selectedType, setSelectedType] = useState<ManualShiftOrderErrorType | null>(null);
  const [comment, setComment] = useState('');

  const createError = useCreateManualShiftOrderError();

  function handleSubmit() {
    if (!selectedType) return;
    createError.mutate(
      { orderId, lineId, type: selectedType, comment: comment.trim() || undefined },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col pb-16" dir="rtl">
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          onClick={onClose}
          className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500"
        >
          <ArrowRight size={24} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-xl text-red-700">דיווח תקלה</h2>
        </div>
        {orderNumber && (
          <span className="font-bold text-gray-700 font-mono text-sm">{orderNumber}</span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        <div>
          <h3 className="text-xl font-bold mb-4">מה הבעיה בהזמנה?</h3>
          <div className="grid grid-cols-2 gap-3">
            {ERROR_TYPES.map(type => {
              const isSelected = selectedType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`border-2 rounded-xl p-4 text-right transition-all flex items-center min-h-[80px] ${
                    isSelected
                      ? 'border-red-600 bg-red-50 text-red-900 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 active:bg-gray-50'
                  }`}
                >
                  <span className={`font-bold leading-tight ${isSelected ? 'text-lg' : 'text-base'}`}>
                    {ERROR_TYPE_LABELS[type]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700">הערה (אופציונלי)</label>
          <textarea
            className="w-full bg-gray-50 border border-gray-300 rounded-xl p-4 text-base focus:border-red-500 focus:ring-1 focus:ring-red-500"
            rows={3}
            placeholder="פרט איזה פריט, כמות וכו'..."
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
        </div>
      </main>

      <footer className="shrink-0 border-t border-gray-200 bg-white p-4">
        <button
          disabled={!selectedType || createError.isPending}
          onClick={handleSubmit}
          className={`w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center transition-all ${
            selectedType && !createError.isPending
              ? 'bg-red-600 text-white active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {createError.isPending ? 'שולח...' : 'חזרה לתיקון'}
        </button>
      </footer>
    </div>
  );
}
