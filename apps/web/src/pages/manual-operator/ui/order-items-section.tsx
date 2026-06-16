import type { ManualShiftOrderItem } from '@wos/domain';

type OrderItemsSectionProps = {
  items: ManualShiftOrderItem[];
  totalQuantity: number;
};

export function OrderItemsSection({ items, totalQuantity }: OrderItemsSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white px-3 py-2.5" dir="rtl">
      <h3 className="mb-2 text-xs font-semibold text-gray-700">פריטי הזמנה</h3>
      <div className="mb-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div className="rounded-md bg-gray-50 px-2 py-1.5">
          <div className="text-gray-500">מספר פריטים</div>
          <div className="font-semibold text-gray-900">{items.length}</div>
        </div>
        <div className="rounded-md bg-gray-50 px-2 py-1.5">
          <div className="text-gray-500">כמות כוללת</div>
          <div className="font-semibold text-gray-900">{totalQuantity}</div>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 break-words">{item.sku}</div>
              {item.description && (
                <div className="text-xs text-gray-500 break-words">{item.description}</div>
              )}
            </div>
            <div className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-sm font-semibold text-gray-800">
              {item.quantity}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
