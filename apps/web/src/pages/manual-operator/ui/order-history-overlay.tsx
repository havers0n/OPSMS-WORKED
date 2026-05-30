import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock } from 'lucide-react';
import { orderEventsQueryOptions } from '@/entities/manual-shift/api/queries';
import { formatDateTimeHe } from '@/shared/lib/format-date-time';
import { formatOrderEventLabel } from './order-event-formatter';

interface OrderHistoryOverlayProps {
  orderId: string;
  onClose: () => void;
}

export function OrderHistoryOverlay({ orderId, onClose }: OrderHistoryOverlayProps) {
  const eventsQuery = useQuery(orderEventsQueryOptions(orderId, true));
  const events = Array.isArray(eventsQuery.data) ? eventsQuery.data : [];

  return (
    <div className="absolute inset-0 bg-white z-30 flex flex-col anim-slide-in" dir="rtl">
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors"
          aria-label="סגור היסטוריה"
        >
          <ArrowRight size={24} />
        </button>
        <h2 className="font-bold text-xl flex-1 text-gray-900">היסטוריית הזמנה</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {eventsQuery.isLoading && (
          <p className="text-center text-gray-400 py-8">טוען...</p>
        )}
        {eventsQuery.isError && (
          <p className="text-center text-red-500 py-8">שגיאה בטעינת ההיסטוריה</p>
        )}
        {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 && (
          <p className="text-center text-gray-400 py-8">אין פעולות מתועדות</p>
        )}
        {events.length > 0 && (
          <ol className="flex flex-col gap-0">
            {events.map((event, index) => (
              <li key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                  {index < events.length - 1 && (
                    <div className="w-px flex-1 bg-gray-200 my-1" />
                  )}
                </div>
                <div className="pb-4 flex-1">
                  <p className="font-medium text-gray-900 text-sm leading-snug">
                    {formatOrderEventLabel(event)}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                    <Clock size={11} />
                    <span dir="ltr">{formatDateTimeHe(event.createdAt)}</span>
                    {event.actorName && (
                      <>
                        <span>·</span>
                        <span>{event.actorName}</span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
