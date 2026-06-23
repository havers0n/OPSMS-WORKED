import { useState } from 'react';
import type { BondedCoverageRequestItem } from '@wos/domain';

type CloseItem = {
  itemId: string;
  fulfilledQty: number;
};

type BondedRequestCloseFormProps = {
  items: BondedCoverageRequestItem[];
  isPending: boolean;
  onSubmit: (data: {
    notes: string | null;
    items: CloseItem[];
  }) => void;
  onCancel: () => void;
};

export function BondedRequestCloseForm({
  items,
  isPending,
  onSubmit,
  onCancel,
}: BondedRequestCloseFormProps) {
  const [fulfilledQtys, setFulfilledQtys] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.id] = item.requestedQty;
    }
    return map;
  });
  const [notes, setNotes] = useState('');

  const updateQty = (itemId: string, value: number) => {
    setFulfilledQtys((prev) => ({ ...prev, [itemId]: Math.max(0, value) }));
  };

  const handleSubmit = () => {
    const closeItems = items
      .filter((item) => fulfilledQtys[item.id] >= 0)
      .map((item) => ({
        itemId: item.id,
        fulfilledQty: fulfilledQtys[item.id],
      }));
    onSubmit({ notes: notes || null, items: closeItems });
  };

  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <h4 className="text-base font-bold text-slate-800 mb-3">סגירת בקשת כיסוי</h4>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">
                {item.sku}
              </div>
              {item.description && (
                <div className="text-xs text-slate-500 truncate">
                  {item.description}
                </div>
              )}
            </div>
            <div className="text-xs text-slate-500 shrink-0">
              <span className="font-medium">כמות מבוקשת:</span> {item.requestedQty}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <label className="text-xs text-slate-500">כמות שסופקה</label>
              <input
                type="number"
                min={0}
                value={fulfilledQtys[item.id]}
                onChange={(e) => {
                  const val = e.target.value;
                  updateQty(item.id, val === '' ? 0 : Number(val));
                }}
                className="w-20 h-8 rounded border border-slate-200 bg-white px-2 py-1 text-sm text-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                disabled={isPending}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <label className="block text-sm font-medium text-slate-600 mb-1">
          הערות לסגירה
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערות לסגירת הבקשה"
          className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
          disabled={isPending}
        />
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {isPending ? 'סוגר...' : 'סגור בקשה'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 transition-colors bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
