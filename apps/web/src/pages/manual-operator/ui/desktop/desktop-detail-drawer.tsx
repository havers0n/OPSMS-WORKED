import type { LineDetail, OrderDetail, PickerDetail } from '@/entities/manual-shift/model/shift-selectors';
import { DesktopLineDetail } from './desktop-line-detail';
import { DesktopOrderDetail } from './desktop-order-detail';
import { DesktopPickerDetail } from './desktop-picker-detail';

type DesktopDetailDrawerState =
  | { type: 'line'; detail: LineDetail }
  | { type: 'picker'; detail: PickerDetail }
  | { type: 'order'; detail: OrderDetail | null }
  | null;

interface DesktopDetailDrawerProps {
  state: DesktopDetailDrawerState;
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
}

export function DesktopDetailDrawer({ state, onClose, onSelectOrder }: DesktopDetailDrawerProps) {
  if (!state) return null;

  return (
    <aside className="w-[480px] bg-white border-r border-gray-200 overflow-y-auto shrink-0" dir="rtl">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">
          {state.type === 'line' ? 'פרטי קו' : state.type === 'picker' ? 'פרטי מלקט' : 'פרטי הזמנה'}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs rounded-md border border-gray-300 px-2.5 py-1 text-gray-700 hover:bg-gray-50"
        >
          סגור
        </button>
      </div>

      {state.type === 'line' && (
        <DesktopLineDetail detail={state.detail} onClose={onClose} onSelectOrder={onSelectOrder} />
      )}
      {state.type === 'picker' && (
        <DesktopPickerDetail detail={state.detail} onClose={onClose} onSelectOrder={onSelectOrder} />
      )}
      {state.type === 'order' && <DesktopOrderDetail detail={state.detail} onClose={onClose} />}
    </aside>
  );
}
