import { useState, useMemo } from 'react';
import { AlertCircle, CheckSquare, Loader2, Square } from 'lucide-react';
import type { SourceOrder, SourceOrderItem } from './scheme-types';
import { useSchemeBuilderStore, getOrderSplitStatus } from './scheme-store';
import { Badge } from '@/shared/ui/badge';

export function ItemsDrawerV2({
  order,
  items,
  isLoading,
  isError,
  onClose,
  onAssignSelected,
  onAssignAllUnassigned,
}: {
  order: SourceOrder;
  items: SourceOrderItem[];
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
  onAssignSelected: (itemRowIds: string[]) => void;
  onAssignAllUnassigned: (itemRowIds: string[]) => void;
}) {
  const itemAssignments = useSchemeBuilderStore((s) => s.itemAssignments);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  const splitStatus = getOrderSplitStatus(order.orderId, itemIds, itemAssignments);

  const unassignedItemIds = useMemo(
    () => items.filter((i) => !(i.id in itemAssignments)).map((i) => i.id),
    [items, itemAssignments],
  );

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const toggleSelectUnassigned = () => {
    setSelectedIds(new Set(unassignedItemIds));
  };

  const handleAssignSelected = () => {
    if (selectedIds.size === 0) return;
    onAssignSelected(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleAssignAllUnassigned = () => {
    if (unassignedItemIds.length === 0) return;
    onAssignAllUnassigned(unassignedItemIds);
  };

  const statusLabel = () => {
    switch (splitStatus) {
      case 'unassigned': return { label: 'לא שובץ', tone: 'neutral' as const };
      case 'assigned': return { label: 'שובץ', tone: 'success' as const };
      case 'partial': return { label: 'שובץ חלקית', tone: 'warning' as const };
      case 'split': return { label: 'מפוצל', tone: 'info' as const };
    }
  };

  const sb = statusLabel();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-gray-900">פריטי הזמנה</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-sm font-bold text-gray-700">{order.orderNumber}</span>
                <Badge tone={sb.tone}>{sb.label}</Badge>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
            <div><span className="text-gray-500">לקוח:</span> {order.customerName}</div>
            <div><span className="text-gray-500">כמות:</span> {order.totalQuantity}</div>
            <div><span className="text-gray-500">קו הפצה מקורי:</span> {order.sourceDeliveryLine?.lineGroupName ?? '—'}</div>
            <div><span className="text-gray-500">נקודה:</span> {order.pointName ?? '—'}</div>
            <div><span className="text-gray-500">איזור:</span> {order.sourceZone ?? '—'}</div>
            <div><span className="text-gray-500">סטטוס ביצוע:</span> {order.backendStatus}</div>
          </div>
          {order.hasAshlama && (
            <div className="mt-2 text-amber-700 bg-amber-50 px-3 py-1 rounded text-xs font-bold">יש אשלמה פתוחה</div>
          )}
          {order.hasCheckUnits && (
            <div className="mt-1 text-amber-700 bg-amber-50 px-3 py-1 rounded text-xs font-bold">יש יחידות בדיקה</div>
          )}
        </div>

        <div className="px-6 py-3 border-b border-gray-200 shrink-0 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={toggleSelectAllVisible}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            {selectedIds.size === items.length ? <CheckSquare size={14} /> : <Square size={14} />}
            בחר הכל
          </button>
          <button
            type="button"
            onClick={toggleSelectUnassigned}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            <Square size={14} />
            בחר לא משויכות ({unassignedItemIds.length})
          </button>
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleAssignSelected}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              שייך מסומנים ({selectedIds.size})
            </button>
          )}
          {unassignedItemIds.length > 0 && (
            <button
              type="button"
              onClick={handleAssignAllUnassigned}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
            >
              שייך את כל השורות שלא שובצו ({unassignedItemIds.length})
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 size={20} className="animate-spin ml-2" />
              טוען פריטים...
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-10 text-red-600">
              <AlertCircle size={20} className="ml-2" />
              שגיאה בטעינת פריטים
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-gray-500">אין פריטים להזמנה זו</div>
          ) : (
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="p-2 w-8" />
                  <th className="p-2 font-medium text-gray-700">מק"ט</th>
                  <th className="p-2 font-medium text-gray-700">תיאור</th>
                  <th className="p-2 font-medium text-gray-700">קטגוריה</th>
                  <th className="p-2 font-medium text-gray-700 text-center">כמות</th>
                  <th className="p-2 font-medium text-gray-700">קבוצה</th>
                  <th className="p-2 font-medium text-gray-700">הערות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item) => {
                  const isAssigned = item.id in itemAssignments;
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 ${isAssigned ? 'bg-gray-50/50' : ''}`}>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => toggleId(item.id)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          {isSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                        </button>
                      </td>
                      <td className="p-2 font-mono text-xs">{item.sku}</td>
                      <td className="p-2 max-w-[180px] truncate text-xs" title={item.description ?? ''}>{item.description}</td>
                      <td className="p-2">
                        <Badge tone="neutral">{item.category}</Badge>
                      </td>
                      <td className="p-2 font-semibold text-center text-xs">{item.quantity}</td>
                      <td className="p-2 text-xs">
                        {isAssigned ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                            משויך
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-2 text-xs text-gray-500">
                        {item.notes && <div>{item.notes}</div>}
                        {item.sourceRows && item.sourceRows.length > 0 && (
                          <div className="text-gray-400">שורות: {item.sourceRows.join(', ')}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
