import { useQuery } from '@tanstack/react-query';
import { orderAshlamotQueryOptions } from '@/entities/manual-shift/api/queries';
import { usePatchManualShiftOrderAshlama } from '@/entities/manual-shift/api/mutations';

interface OrderAshlamotSectionProps {
  orderId: string;
  interactive?: boolean;
  canInteract?: boolean;
}

export function OrderAshlamotSection({ orderId, interactive = false, canInteract = true }: OrderAshlamotSectionProps) {
  const ashlamotQuery = useQuery(orderAshlamotQueryOptions(orderId));
  const patchAshlama = usePatchManualShiftOrderAshlama(orderId);

  const ashlamot = Array.isArray(ashlamotQuery.data) ? ashlamotQuery.data : [];
  const openAshlamot = ashlamot.filter((a) => a.status === 'open');

  if (openAshlamot.length === 0) return null;

  const canPerformActions = interactive && canInteract;

  return (
    <div className="flex flex-col gap-2" data-testid="order-open-ashlamot">
      {openAshlamot.map((ashlama) => (
        <div
          key={ashlama.id}
          className="rounded-xl border border-orange-300 bg-orange-50 p-4 flex flex-col gap-3 text-right"
          data-testid={`open-ashlama-${ashlama.id}`}
        >
          <div>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-0.5">השלמה פתוחה</p>
            <p className="font-bold text-orange-900 text-base leading-snug">{ashlama.text}</p>
          </div>
          {interactive && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => patchAshlama.mutate({ ashlamaId: ashlama.id, status: 'done' })}
                disabled={!canPerformActions || patchAshlama.isPending}
                className="flex-1 h-9 rounded-lg border border-green-300 bg-white text-sm font-bold text-green-700 disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                הושלם ✓
              </button>
              <button
                type="button"
                onClick={() => patchAshlama.mutate({ ashlamaId: ashlama.id, status: 'cancelled' })}
                disabled={!canPerformActions || patchAshlama.isPending}
                className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-sm font-bold text-gray-600 disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                בטל
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
