import { useState, useMemo } from 'react';
import type { SourceOrderItem } from './scheme-types';

interface QuantityRow {
  item: SourceOrderItem;
  remainingQty: number;
  assignedQty: number;
}

export function QuantityAllocationModal({
  isOpen,
  onClose,
  itemRows,
  workGroupName,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  itemRows: QuantityRow[];
  workGroupName: string;
  onConfirm: (allocations: { itemRowId: string; qty: number }[]) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const validRows = useMemo(() => itemRows.filter((r) => r.remainingQty > 0), [itemRows]);
  const fullyAllocatedRows = useMemo(() => itemRows.filter((r) => r.remainingQty === 0), [itemRows]);

  const getQty = (itemRowId: string, remainingQty: number): number => {
    if (itemRowId in quantities) return quantities[itemRowId];
    return remainingQty;
  };

  const allValid = validRows.length > 0 && validRows.every((r) => {
    const q = getQty(r.item.id, r.remainingQty);
    return Number.isInteger(q) && q > 0 && q <= r.remainingQty;
  });

  const handleConfirm = () => {
    if (!allValid) return;
    const result = validRows.map((r) => ({
      itemRowId: r.item.id,
      qty: getQty(r.item.id, r.remainingQty),
    }));
    onConfirm(result);
    setQuantities({});
  };

  const handleClose = () => {
    setQuantities({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">הקצאת כמויות לשורות המסומנות</h2>
          <p className="text-sm text-gray-500 mt-1">
            קבוצת עבודה: <span className="font-semibold text-blue-700">{workGroupName}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">הפעולה תחול רק על השורות שנבחרו.</p>
        </div>

        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {validRows.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">
              כל השורות הנבחרות הוקצו במלואן
            </div>
          ) : (
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="p-2 font-medium text-gray-700">מק&quot;ט</th>
                  <th className="p-2 font-medium text-gray-700">תיאור</th>
                  <th className="p-2 font-medium text-gray-700 text-center">כמות מקורית</th>
                  <th className="p-2 font-medium text-gray-700 text-center">שויך</th>
                  <th className="p-2 font-medium text-gray-700 text-center">נותר</th>
                  <th className="p-2 font-medium text-gray-700 text-center">הקצאה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {validRows.map((row) => {
                  const q = getQty(row.item.id, row.remainingQty);
                  const isOver = q > row.remainingQty;
                  return (
                    <tr key={row.item.id} className="hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{row.item.sku}</td>
                      <td className="p-2 max-w-[140px] truncate text-xs" title={row.item.description ?? ''}>{row.item.description}</td>
                      <td className="p-2 text-center text-xs font-semibold">{row.item.quantity}</td>
                      <td className="p-2 text-center text-xs text-gray-500">{row.assignedQty}</td>
                      <td className="p-2 text-center text-xs font-semibold">{row.remainingQty}</td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min={1}
                          max={row.remainingQty}
                          value={q}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setQuantities((prev) => ({
                              ...prev,
                              [row.item.id]: Number.isNaN(val) ? 0 : val,
                            }));
                          }}
                          className={`w-16 text-center border rounded px-1 py-0.5 text-xs ${
                            isOver ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                          dir="ltr"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {fullyAllocatedRows.length > 0 && (
            <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
              {fullyAllocatedRows.length} שורות שהיו מסומנות כבר הוקצו במלואן
            </div>
          )}

          {validRows.length > 0 && (
            <div className="mt-3 text-xs text-gray-500 bg-blue-50 rounded px-3 py-2">
              כברירת מחדל, ההקצאה תמלא את הכמות שנותרה. אפשר לשנות לכל שורה.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!allValid}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            אשר הקצאה לשורות המסומנות
          </button>
        </div>
      </div>
    </div>
  );
}
