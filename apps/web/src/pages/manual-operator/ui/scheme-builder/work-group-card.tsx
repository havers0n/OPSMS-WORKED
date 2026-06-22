import { Plus, Trash2 } from 'lucide-react';
import type { SourceOrderItem, WorkGroup } from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';

export function WorkGroupCard({
  workGroup,
  orderItemMap,
  onAssignItems,
}: {
  workGroup: WorkGroup;
  orderItemMap: Record<string, SourceOrderItem[]>;
  onAssignItems: () => void;
}) {
  const deleteWorkGroup = useSchemeBuilderStore((s) => s.deleteWorkGroup);
  const itemAssignments = useSchemeBuilderStore((s) => s.itemAssignments);

  const assignedIds = Object.entries(itemAssignments)
    .filter(([, wgId]) => wgId === workGroup.id)
    .map(([itemId]) => itemId);

  const itemCount = assignedIds.length;

  const orderIds = new Set<string>();
  let totalQty = 0;
  for (const [orderId, items] of Object.entries(orderItemMap)) {
    for (const item of items) {
      if (assignedIds.includes(item.id)) {
        orderIds.add(orderId);
        totalQty += item.quantity;
      }
    }
  }

  const uniqueOrdersCount = orderIds.size;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 block shrink-0" />
          <h3 className="text-base font-bold text-gray-900">{workGroup.name}</h3>
        </div>
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
          <Trash2 size={16} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-1.5">
        <div className="text-sm text-gray-600">
          <span className="font-semibold">{itemCount}</span> שורות משויכות
        </div>
        <div className="text-sm text-gray-600">
          כמות כוללת: <span className="font-semibold">{totalQty}</span>
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-semibold">{uniqueOrdersCount}</span> הזמנות
        </div>

        {itemCount > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Array.from(orderIds).slice(0, 5).map((oid) => (
              <span key={oid} className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 truncate max-w-[130px]">
                {oid.slice(0, 8)}...
              </span>
            ))}
            {orderIds.size > 5 && (
              <span className="text-xs text-gray-500">+{orderIds.size - 5}</span>
            )}
          </div>
        )}

        {itemCount === 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={onAssignItems}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              <Plus size={14} />
              שייך שורות לקבוצה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
