import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { demandExplorerOrderItemsQueryOptions } from '@/entities/demand/api/queries';
import type { DemandExplorerItem } from '@wos/domain';

export function DemandExplorerItemsTable({
  draftId,
  orderId,
}: {
  draftId: string;
  orderId: string;
}) {
  const { data, isLoading, isError } = useQuery({
    ...demandExplorerOrderItemsQueryOptions(draftId, orderId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-gray-500 text-xs">
        <Loader2 size={14} className="animate-spin ml-1" />
        טוען פרטים...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-4 text-red-600 text-xs">
        <AlertCircle size={14} className="ml-1" />
        שגיאה בטעינת פרטים
      </div>
    );
  }

  const items: DemandExplorerItem[] = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500 text-xs">
        אין פרטים להזמנה זו
      </div>
    );
  }

  return (
    <table className="w-full text-xs text-right">
      <thead className="bg-gray-50 border-y border-gray-200">
        <tr>
          <th className="p-1.5 font-medium text-gray-600">מק"ט</th>
          <th className="p-1.5 font-medium text-gray-600">תיאור</th>
          <th className="p-1.5 font-medium text-gray-600">קטגוריה</th>
          <th className="p-1.5 font-medium text-gray-600 text-center">כמות</th>
          <th className="p-1.5 font-medium text-gray-600 text-center">שויך</th>
          <th className="p-1.5 font-medium text-gray-600 text-center">נותר</th>
          <th className="p-1.5 font-medium text-gray-600">סטטוס</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item) => (
          <tr key={item.itemId} className="hover:bg-gray-50">
            <td className="p-1.5 font-mono text-gray-900">{item.sku}</td>
            <td className="p-1.5 max-w-[120px] truncate text-gray-600" title={item.description ?? ''}>{item.description}</td>
            <td className="p-1.5 text-gray-500">{item.category}</td>
            <td className="p-1.5 text-center font-semibold text-gray-900">{item.quantity}</td>
            <td className="p-1.5 text-center text-gray-500">{item.assignedQuantity > 0 ? item.assignedQuantity : '—'}</td>
            <td className="p-1.5 text-center font-semibold">{item.remainingQuantity}</td>
            <td className="p-1.5 text-gray-500">{item.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
