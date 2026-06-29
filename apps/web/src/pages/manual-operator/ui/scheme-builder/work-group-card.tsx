import { Plus, Trash2 } from 'lucide-react';
import type { SourceOrderItem, WorkGroup, SchemeBuilderCapabilities } from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';

export function WorkGroupCard({
  workGroup,
  orderItemMap,
  onStartAssign,
  capabilities,
  orderNumberMap,
}: {
  workGroup: WorkGroup;
  orderItemMap: Record<string, SourceOrderItem[]>;
  onStartAssign: (workGroupId: string) => void;
  capabilities: SchemeBuilderCapabilities;
  orderNumberMap: Record<string, string | null>;
}) {
  const deleteWorkGroup = useSchemeBuilderStore((s) => s.deleteWorkGroup);
  const getWorkGroupItemCount = useSchemeBuilderStore((s) => s.getWorkGroupItemCount);
  const getWorkGroupTotalQuantity = useSchemeBuilderStore((s) => s.getWorkGroupTotalQuantity);
  const getWorkGroupOrderIds = useSchemeBuilderStore((s) => s.getWorkGroupOrderIds);

  const itemCount = getWorkGroupItemCount(workGroup.id);
  const totalQty = getWorkGroupTotalQuantity(workGroup.id);
  const orderIds = getWorkGroupOrderIds(workGroup.id, orderItemMap);
  const uniqueOrdersCount = orderIds.size;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-2 py-1.5 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 block shrink-0" />
          <h3 className="text-sm font-bold text-gray-900">{workGroup.name}</h3>
        </div>
        {capabilities.canCreateWorkGroups && (
          <button
            type="button"
            onClick={() => {
              if (itemCount > 0) {
                alert('לא ניתן למחוק קבוצת עבודה שיש בה שורות משויכות');
                return;
              }
              const result = deleteWorkGroup(workGroup.id);
              if (!result.ok && result.reason === 'has_assignments') {
                alert('לא ניתן למחוק קבוצת עבודה שיש בה שורות משויכות');
              }
            }}
            className="text-gray-400 hover:text-red-600 transition-colors p-1"
            title="מחק קבוצה"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="px-2 py-1.5 space-y-0.5">
        <div className="text-xs text-gray-500">
          שורות <span className="font-semibold text-gray-700">{itemCount}</span>
          &ensp;·&ensp;כמות <span className="font-semibold text-gray-700">{totalQty}</span>
          &ensp;·&ensp;הזמנות <span className="font-semibold text-gray-700">{uniqueOrdersCount}</span>
        </div>

        {itemCount > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {Array.from(orderIds).slice(0, 4).map((oid) => (
              <span key={oid} className="text-[10px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 truncate max-w-[110px]">
                {orderNumberMap[oid] ?? '???'}
              </span>
            ))}
            {orderIds.size > 4 && (
              <span className="text-[10px] text-gray-500">+{orderIds.size - 4}</span>
            )}
          </div>
        )}

        {itemCount === 0 && capabilities.canAssignOrders && (
          <button
            type="button"
            onClick={() => onStartAssign(workGroup.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors pt-1"
          >
            <Plus size={12} />
            שייך שורות לקבוצה
          </button>
        )}
      </div>
    </div>
  );
}
