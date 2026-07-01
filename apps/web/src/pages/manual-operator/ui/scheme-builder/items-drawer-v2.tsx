import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckSquare, Loader2, Square } from 'lucide-react';
import type { SourceOrder, SourceOrderItem, SchemeBuilderCapabilities } from './scheme-types';
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
  targetWorkGroupName,
  capabilities,
}: {
  order: SourceOrder;
  items: SourceOrderItem[];
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
  onAssignSelected: (itemRowIds: string[]) => void;
  onAssignAllUnassigned: (itemRowIds: string[]) => void;
  targetWorkGroupName?: string | null;
  capabilities: SchemeBuilderCapabilities;
}) {
  const itemAllocations = useSchemeBuilderStore((s) => s.itemAllocations);
  const getWorkGroup = useSchemeBuilderStore((s) => s.getWorkGroup);
  const allocationsByItem = useMemo(() => {
    const map = new Map<string, typeof itemAllocations>();
    for (const alloc of itemAllocations) {
      const existing = map.get(alloc.itemRowId);
      if (existing) existing.push(alloc);
      else map.set(alloc.itemRowId, [alloc]);
    }
    return map;
  }, [itemAllocations]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [order.orderId]);

  const itemSplitStatus = getOrderSplitStatus(order.orderId, items, itemAllocations);

  const rowsWithRemaining = useMemo(
    () => items.filter((i) => {
      const allocs = allocationsByItem.get(i.id) ?? [];
      const assignedQty = allocs.reduce((s, a) => s + a.qty, 0);
      return i.quantity - assignedQty > 0;
    }),
    [items, allocationsByItem],
  );

  const unassignedItemIds = rowsWithRemaining.map((i) => i.id);
  const selectedUnassignedIds = useMemo(() => unassignedItemIds.filter((id) => selectedIds.has(id)), [selectedIds, unassignedItemIds]);
  const allUnassignedSelected = unassignedItemIds.length > 0 && selectedUnassignedIds.length === unassignedItemIds.length;

  const toggleId = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const allocs = allocationsByItem.get(id) ?? [];
    const assignedQty = allocs.reduce((s, a) => s + a.qty, 0);
    if (item.quantity - assignedQty <= 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allUnassignedSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unassignedItemIds));
    }
  };

  const toggleSelectUnassigned = () => {
    setSelectedIds(new Set(unassignedItemIds));
  };

  const handleAssignSelected = () => {
    if (selectedIds.size === 0) return;
    onAssignSelected(selectedUnassignedIds);
    setSelectedIds(new Set());
  };

  const handleAssignAllUnassigned = () => {
    if (unassignedItemIds.length === 0) return;
    onAssignAllUnassigned(unassignedItemIds);
  };

  const statusLabel = () => {
    switch (itemSplitStatus) {
      case 'unassigned': return { label: 'לא שובץ', tone: 'neutral' as const };
      case 'assigned': return { label: 'שובץ', tone: 'success' as const };
      case 'partial': return { label: 'שובץ חלקית', tone: 'warning' as const };
      case 'split': return { label: 'מפוצל', tone: 'info' as const };
    }
  };

  const sb = statusLabel();

  const workGroupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const alloc of itemAllocations) {
      if (!map.has(alloc.workGroupId)) {
        const wg = getWorkGroup(alloc.workGroupId);
        map.set(alloc.workGroupId, wg?.name ?? alloc.workGroupId);
      }
    }
    return map;
  }, [itemAllocations, getWorkGroup]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden"
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
            {capabilities.canWriteManualShift && (
              <>
                <div><span className="text-gray-500">קו הפצה מקורי:</span> {order.sourceDeliveryLine?.lineGroupName ?? '—'}</div>
                <div><span className="text-gray-500">נקודה:</span> {order.pointName ?? '—'}</div>
                <div><span className="text-gray-500">איזור:</span> {order.sourceZone ?? '—'}</div>
              </>
            )}
            <div><span className="text-gray-500">סטטוס ביצוע:</span> {order.backendStatus}</div>
          </div>
          {capabilities.canWriteManualShift && order.hasAshlama && (
            <div className="mt-2 text-amber-700 bg-amber-50 px-3 py-1 rounded text-xs font-bold">יש אשלמה פתוחה</div>
          )}
          {capabilities.canWriteManualShift && order.hasCheckUnits && (
            <div className="mt-1 text-amber-700 bg-amber-50 px-3 py-1 rounded text-xs font-bold">יש יחידות בדיקה</div>
          )}
          {targetWorkGroupName && capabilities.canAssignOrders && (
            <div className="mt-2 text-blue-700 bg-blue-50 px-3 py-1 rounded text-xs font-bold">
              קבוצת יעד: {targetWorkGroupName}
            </div>
          )}
        </div>

        {capabilities.canAssignOrders && (
          <div className="px-6 py-3 border-b border-gray-200 shrink-0 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              aria-pressed={allUnassignedSelected}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              {allUnassignedSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {"בחר את כל השורות שלא שובצו"}
            </button>
            <button
              type="button"
              onClick={toggleSelectUnassigned}
              aria-pressed={selectedUnassignedIds.length === unassignedItemIds.length && unassignedItemIds.length > 0}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              <Square size={14} />
              {"בחר שורות פנויות (" + unassignedItemIds.length + ")"}
            </button>
            <div className="flex-1" />
            {selectedUnassignedIds.length > 0 && (
              <button
                type="button"
                onClick={handleAssignSelected}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {targetWorkGroupName
                  ? `שייך שורות מסומנות בלבד לקבוצה: ${targetWorkGroupName} (${selectedIds.size})`
                  : `שייך שורות מסומנות בלבד (${selectedIds.size})`}
              </button>
            )}
            {!targetWorkGroupName && unassignedItemIds.length > 0 && (
              <button
                type="button"
                onClick={handleAssignAllUnassigned}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
              >
                {"שייך את כל השורות הפנויות (" + unassignedItemIds.length + ")"}
              </button>
            )}
          </div>
        )}

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
                  {capabilities.canAssignOrders && <th className="p-2 w-8" />}
                  <th className="p-2 font-medium text-gray-700">מק"ט</th>
                  <th className="p-2 font-medium text-gray-700">תיאור</th>
                  <th className="p-2 font-medium text-gray-700">קטגוריה</th>
                  <th className="p-2 font-medium text-gray-700 text-center">כמות מקורית</th>
                  <th className="p-2 font-medium text-gray-700 text-center">שויך</th>
                  <th className="p-2 font-medium text-gray-700 text-center">נותר</th>
                  {!capabilities.canWriteManualShift ? (
                    <th className="p-2 font-medium text-gray-700">טיפול מוצר</th>
                  ) : (
                    <th className="p-2 font-medium text-gray-700 min-w-[100px]">קבוצות</th>
                  )}
                  <th className="p-2 font-medium text-gray-700">הערות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item) => {
                  const allocs = allocationsByItem.get(item.id) ?? [];
                  const assignedQty = allocs.reduce((s, a) => s + a.qty, 0);
                  const remainingQty = item.quantity - assignedQty;
                  const isFullyAllocated = remainingQty <= 0;
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 ${isFullyAllocated && !capabilities.canAssignOrders ? 'opacity-60' : ''} ${item.isError ? 'bg-red-50' : ''} ${item.isSpecialFlow ? 'bg-amber-50' : ''}`}>
                      {capabilities.canAssignOrders && (
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => toggleId(item.id)}
                            disabled={isFullyAllocated}
                            aria-label={isSelected ? `בטל בחירה לשורה ${item.sku}` : `בחר שורה ${item.sku}`}
                            aria-pressed={isSelected}
                            className={`transition-colors ${isFullyAllocated ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-blue-600'}`}
                          >
                            {isSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                          </button>
                        </td>
                      )}
                      <td className="p-2 font-mono text-xs">{item.sku}</td>
                      <td className="p-2 max-w-[140px] truncate text-xs" title={item.description ?? ''}>{item.description}</td>
                      <td className="p-2">
                        <Badge tone="neutral">{item.category}</Badge>
                      </td>
                      <td className="p-2 font-semibold text-center text-xs">{item.quantity}</td>
                      <td className="p-2 text-center text-xs text-gray-500">{assignedQty > 0 ? assignedQty : '—'}</td>
                      <td className="p-2 text-center text-xs font-semibold">{remainingQty}</td>
                      {!capabilities.canWriteManualShift ? (
                        <td className="p-2 text-xs">
                          {item.productHandlingFlow && (
                            <Badge tone={item.isError ? 'danger' : item.isSpecialFlow ? 'warning' : 'neutral'}>
                              {item.productHandlingFlow}
                            </Badge>
                          )}
                          {item.issues && item.issues.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {item.issues.slice(0, 2).map((issue, i) => (
                                <div key={i} className={`text-[10px] ${issue.severity === 'error' ? 'text-red-600' : issue.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'}`}>
                                  {issue.message}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      ) : (
                        <td className="p-2 min-w-[100px]">
                          {allocs.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {Array.from(new Map(allocs.map((a) => [a.workGroupId, a.workGroupId])).entries()).map(([wgId]) => (
                                <span
                                  key={wgId}
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800"
                                >
                                  {workGroupNameById.get(wgId) ?? '???'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      )}
                      <td className="p-2 text-xs text-gray-500">
                        {item.notes && <div>{item.notes}</div>}
                        {capabilities.canWriteManualShift && item.sourceRows && item.sourceRows.length > 0 && (
                          <div className="text-gray-400">שורות: {item.sourceRows.join(', ')}</div>
                        )}
                        {!capabilities.canWriteManualShift && item.planningStatus && (
                          <div className={`text-[10px] ${item.planningStatus === 'error' ? 'text-red-600' : item.planningStatus === 'special_flow' ? 'text-amber-700' : 'text-gray-400'}`}>
                            {item.planningStatus}
                          </div>
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

