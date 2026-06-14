import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import type { ManualShiftOrderItem } from '@wos/domain';
import { orderItemsQueryOptions } from '@/entities/manual-shift/api/queries';

interface OrderItemsSectionProps {
  orderId: string;
  defaultExpanded?: boolean;
  mode?: 'mobile' | 'desktop';
}

function normalizeItems(items: ManualShiftOrderItem[]): ManualShiftOrderItem[] {
  return items.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

function isNonEmptyValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function formatSourceRows(sourceRows: number[] | null): string {
  if (!sourceRows || sourceRows.length === 0) {
    return '—';
  }

  return sourceRows.join(', ');
}

export function OrderItemsSection({
  orderId,
  defaultExpanded = false,
  mode = 'mobile'
}: OrderItemsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const query = useQuery(orderItemsQueryOptions(orderId));

  const items = useMemo(() => normalizeItems((query.data ?? []) as ManualShiftOrderItem[]), [query.data]);

  const itemRowsCount = items.length;
  const uniqueSkuCount = new Set(items.map((item) => item.sku).filter(isNonEmptyValue)).size;
  const totalQuantity = items.reduce((sum, item) => sum + (Number.isFinite(item.quantity) ? item.quantity : 0), 0);

  const hasItems = itemRowsCount > 0;
  const isLoading = query.isLoading;
  const isError = query.isError;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm" dir="rtl" data-testid="order-items-section">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 text-right"
        aria-expanded={isExpanded}
        aria-controls={`order-items-panel-${orderId}`}
      >
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{mode === 'desktop' ? 'מוצרים בהזמנה' : 'מוצרים בהזמנה'}</p>
          <p className="text-xs text-gray-500">
            {hasItems
              ? 'פריטי המלאי שנקלטו מהאקסל'
              : isLoading
                ? 'טוען פריטי הזמנה'
                : 'אין מוצרים להזמנה זו'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            שורות פריטים {itemRowsCount}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            SKU ייחודיים {uniqueSkuCount}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            כמות כוללת {totalQuantity}
          </span>
          {isExpanded ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
        </div>
      </button>

      {isExpanded && (
        <div id={`order-items-panel-${orderId}`} className="px-4 py-4">
          {isLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
              <Loader2 size={16} className="animate-spin" />
              טוען מוצרים...
            </div>
          )}

          {isError && !isLoading && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
              <div className="font-medium">לא ניתן לטעון את פריטי ההזמנה.</div>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700"
              >
                <RefreshCw size={14} />
                נסה שוב
              </button>
            </div>
          )}

          {!isLoading && !isError && !hasItems && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500">
              אין מוצרים להזמנה זו.
            </div>
          )}

          {!isLoading && !isError && hasItems && mode === 'mobile' && (
            <div className="max-h-72 overflow-y-auto space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900" dir="ltr">
                        {item.sku}
                      </div>
                      {item.description && (
                        <div className="mt-0.5 text-gray-700 break-words">{item.description}</div>
                      )}
                    </div>
                    <div className="shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-sm font-bold text-gray-900 tabular-nums" dir="ltr">
                      {item.quantity}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    {item.category && <span>{item.category}</span>}
                    {item.notes && <span>{item.notes}</span>}
                    {item.sourceFile && <span>{item.sourceFile}</span>}
                    {item.sourceRows?.length ? <span>שורות מקור: {formatSourceRows(item.sourceRows)}</span> : null}
                    {item.zone && <span>אזור: {item.zone}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && !isError && hasItems && mode === 'desktop' && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[760px] text-sm" dir="rtl">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">SKU</th>
                    <th className="px-3 py-2 text-right font-medium">תיאור</th>
                    <th className="px-3 py-2 text-right font-medium">קטגוריה</th>
                    <th className="px-3 py-2 text-right font-medium">כמות</th>
                    <th className="px-3 py-2 text-right font-medium">הערות</th>
                    <th className="px-3 py-2 text-right font-medium">שורות מקור</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-semibold text-gray-900" dir="ltr">{item.sku}</td>
                      <td className="px-3 py-2 text-gray-700 break-words">{item.description ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{item.category ?? '—'}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900 tabular-nums" dir="ltr">{item.quantity}</td>
                      <td className="px-3 py-2 text-gray-700 break-words">{item.notes ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{formatSourceRows(item.sourceRows)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
