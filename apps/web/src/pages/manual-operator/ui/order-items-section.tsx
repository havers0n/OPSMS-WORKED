import type { ManualShiftOrderItem } from '@wos/domain';

type OrderItemsSectionProps = {
  items: ManualShiftOrderItem[];
  totalQuantity: number;
};

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <div className="text-[11px] font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold leading-none text-gray-900 tabular-nums">{value}</div>
    </div>
  );
}

export function OrderItemsSection({ items, totalQuantity }: OrderItemsSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm"
      dir="rtl"
      data-testid="order-items-section"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">פריטי הזמנה</h3>
          <p className="mt-1 text-xs text-gray-500">SKU, תיאור וכמות לסריקה מהירה</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SummaryStat label="שורות" value={items.length} />
          <SummaryStat label="כמות כוללת" value={totalQuantity} />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5"
          >
            <div className="rounded-xl bg-gray-900 px-3 py-2 text-center text-white shadow-sm">
              <div className="text-[11px] font-medium text-gray-200">כמות</div>
              <div className="mt-1 text-xl font-semibold leading-none tabular-nums">{item.quantity}</div>
            </div>

            <div className="min-w-0">
              <div className="text-[11px] font-medium text-gray-500">SKU</div>
              <div className="mt-0.5 break-words font-mono text-sm font-semibold text-gray-900">{item.sku}</div>
              {item.description && (
                <>
                  <div className="mt-2 text-[11px] font-medium text-gray-500">תיאור</div>
                  <div className="mt-0.5 break-words text-sm text-gray-700">{item.description}</div>
                </>
              )}
              {item.category && (
                <>
                  <div className="mt-2 text-[11px] font-medium text-gray-500">קטגוריה</div>
                  <div className="mt-0.5 break-words text-sm text-gray-700">{item.category}</div>
                </>
              )}
              {item.zone && (
                <>
                  <div className="mt-2 text-[11px] font-medium text-gray-500">אזור</div>
                  <div className="mt-0.5 break-words text-sm text-gray-700">{item.zone}</div>
                </>
              )}
              {item.notes && (
                <>
                  <div className="mt-2 text-[11px] font-medium text-gray-500">הערות</div>
                  <div className="mt-0.5 break-words text-sm text-gray-700">{item.notes}</div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
