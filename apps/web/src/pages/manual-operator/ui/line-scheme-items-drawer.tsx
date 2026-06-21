import { AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Modal } from './line-scheme-modal';
import type { LineSchemeOrder, LineSchemeItemRow } from './line-scheme-types';

export function ItemsDrawer({
  order,
  items,
  isLoading,
  isError,
  onClose,
}: {
  order: LineSchemeOrder;
  items: LineSchemeItemRow[];
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen onClose={onClose} title="פריטי הזמנה" footer={
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">סגור</button>
    }>
      <div className="flex flex-col gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm text-gray-700">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div><span className="text-gray-500">הזמנה:</span> <span className="font-semibold text-gray-900">{order.orderNumber}</span></div>
            <div><span className="text-gray-500">לקוח:</span> <span className="font-semibold text-gray-900">{order.customerName}</span></div>
            <div><span className="text-gray-500">שורות:</span> {order.lineCount}</div>
            <div><span className="text-gray-500">כמות:</span> {order.totalQuantity}</div>
          </div>
          {order.hasAshlama && (
            <div className="mt-2 text-amber-700 bg-amber-50 px-3 py-1 rounded text-xs font-bold">
              יש אשלמה פתוחה
            </div>
          )}
          {order.hasCheckUnits && (
            <div className="mt-1 text-amber-700 bg-amber-50 px-3 py-1 rounded text-xs font-bold">
              יש יחידות בדיקה
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 size={20} className="animate-spin ml-2" />
            טוען פריטים...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertCircle size={20} className="ml-2" />
            שגיאה בטעינת פריטים
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            אין פריטים להזמנה זו
          </div>
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="p-2 font-medium text-gray-700">מק"ט</th>
                  <th className="p-2 font-medium text-gray-700">תיאור</th>
                  <th className="p-2 font-medium text-gray-700">קטגוריה</th>
                  <th className="p-2 font-medium text-gray-700 text-center">כמות</th>
                  <th className="p-2 font-medium text-gray-700">הערות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{item.sku}</td>
                    <td className="p-2 max-w-[200px] truncate text-xs" title={item.description ?? ''}>{item.description}</td>
                    <td className="p-2">
                      <Badge tone="neutral">{item.category}</Badge>
                    </td>
                    <td className="p-2 font-semibold text-center text-xs">{item.quantity}</td>
                    <td className="p-2 text-xs text-gray-500">
                      {item.notes && <div>{item.notes}</div>}
                      {item.sourceRows && item.sourceRows.length > 0 && (
                        <div className="text-gray-400">שורות: {item.sourceRows.join(', ')}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
