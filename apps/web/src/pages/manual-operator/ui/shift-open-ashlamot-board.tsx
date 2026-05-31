import { useQuery } from '@tanstack/react-query';
import type { OpenAshlamaBoardItem } from '@wos/domain';
import { shiftOpenAshlamotQueryOptions } from '@/entities/manual-shift/api/queries';
import { usePatchManualShiftOrderAshlama } from '@/entities/manual-shift/api/mutations';

interface ShiftOpenAshlamotBoardProps {
  shiftId: string;
  canInteract: boolean;
  variant: 'mobile' | 'desktop';
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem'
  }).format(new Date(iso));
}

function AshlamaRow({
  item,
  canInteract
}: {
  item: OpenAshlamaBoardItem;
  canInteract: boolean;
}) {
  const patch = usePatchManualShiftOrderAshlama(item.orderId);
  const contextLine = [
    item.lineName,
    item.orderNumber ? `הזמנה ${item.orderNumber}` : null,
    item.pointName
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3"
      data-testid={`open-ashlama-board-item-${item.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-orange-600 leading-snug">{contextLine}</p>
        <span className="shrink-0 text-xs text-gray-400">{formatTime(item.createdAt)}</span>
      </div>
      <p className="font-bold text-orange-900 text-sm leading-snug">{item.text}</p>
      {canInteract && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => patch.mutate({ ashlamaId: item.id, status: 'done' })}
            disabled={patch.isPending}
            className="flex-1 h-8 rounded-lg border border-green-300 bg-white text-xs font-bold text-green-700 disabled:opacity-50 active:scale-[0.98] transition-transform"
            data-testid={`ashlama-done-${item.id}`}
          >
            הושלם ✓
          </button>
          <button
            type="button"
            onClick={() => patch.mutate({ ashlamaId: item.id, status: 'cancelled' })}
            disabled={patch.isPending}
            className="h-8 rounded-lg border border-gray-300 bg-white px-3 text-xs font-bold text-gray-600 disabled:opacity-50 active:scale-[0.98] transition-transform"
            data-testid={`ashlama-cancel-${item.id}`}
          >
            בטל
          </button>
        </div>
      )}
    </div>
  );
}

export function ShiftOpenAshlamotBoard({ shiftId, canInteract }: ShiftOpenAshlamotBoardProps) {
  const { data: items = [], isLoading } = useQuery(shiftOpenAshlamotQueryOptions(shiftId));

  if (isLoading) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="shift-open-ashlamot-board">
      <h3 className="font-bold text-orange-700 text-sm px-1">
        השלמות פתוחות{items.length > 0 ? ` (${items.length})` : ''}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 px-1" data-testid="shift-open-ashlamot-empty">
          אין השלמות פתוחות
        </p>
      ) : (
        items.map((item) => (
          <AshlamaRow key={item.id} item={item} canInteract={canInteract} />
        ))
      )}
    </div>
  );
}
