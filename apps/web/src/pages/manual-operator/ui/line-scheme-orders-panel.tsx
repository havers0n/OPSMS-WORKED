import { Search } from 'lucide-react';
import type { LineSchemeOrder } from './line-scheme-types';
import { OrderCard } from './line-scheme-order-card';

export function OrdersPanel({
  orders,
  onOpenItems,
  onAssignAll,
  onUnassign,
  searchQuery,
  onSearchChange,
}: {
  orders: LineSchemeOrder[];
  onOpenItems: (orderId: string) => void;
  onAssignAll: (orderId: string) => void;
  onUnassign: (orderId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex-1 flex flex-col h-[calc(100vh-200px)] sticky top-36">
      <div className="p-4 border-b border-gray-200 bg-gray-50/50 rounded-t-lg">
        <h2 className="text-lg font-bold text-gray-900 mb-1">הזמנות</h2>
        <p className="text-sm text-gray-500 mb-4">{orders.length} הזמנות</p>
        <div className="relative">
          <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="חיפוש לקוח / הזמנה..."
            className="w-full text-sm border border-gray-300 rounded pl-3 pr-9 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {orders.map(order => (
          <OrderCard
            key={order.orderId}
            order={order}
            onOpenItems={() => onOpenItems(order.orderId)}
            onAssignAll={() => onAssignAll(order.orderId)}
            onUnassign={() => onUnassign(order.orderId)}
          />
        ))}
      </div>
    </div>
  );
}
