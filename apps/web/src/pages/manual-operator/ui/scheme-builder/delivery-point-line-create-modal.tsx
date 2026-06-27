import { useState, useMemo } from 'react';
import { AlertTriangle, Search, X } from 'lucide-react';
import type { SourceOrder } from './scheme-types';

interface GroupedDeliveryPoint {
  deliveryPointId: string;
  deliveryPointName: string;
  totalOrders: number;
  totalQuantity: number;
  matchedOrders: number;
  matchedQuantity: number;
  unmatchedOrders: number;
}

interface DeliveryPointLineCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  sourceOrders: SourceOrder[];
  isShiftMode: boolean;
  onCreateWithDeliveryPoint: (name: string, deliveryPointId: string, orderIds: string[]) => void;
}

type Mode = 'choice' | 'manual' | 'delivery_point';

const MODE_LABELS: Record<Mode, string> = {
  choice: 'בחר איך ליצור קו עבודה',
  manual: 'קו ידני',
  delivery_point: 'לפי נקודת משלוח',
};

export function DeliveryPointLineCreateModal({
  isOpen,
  onClose,
  onCreate,
  sourceOrders,
  isShiftMode,
  onCreateWithDeliveryPoint,
}: DeliveryPointLineCreateModalProps) {
  const [mode, setMode] = useState<Mode>('choice');
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDPId, setSelectedDPId] = useState<string | null>(null);

  const suggestions = ['ראשי', 'משני', 'צפון', 'דרום', 'מרכז', 'חירום', 'סלולר', 'כללי'];

  const deliveryPoints = useMemo(() => {
    const map = new Map<string, GroupedDeliveryPoint>();
    for (const order of sourceOrders) {
      if (!order.deliveryPointId || order.sourceDeliveryLine?.lineKind === 'delivery_channel') continue;
      const existing = map.get(order.deliveryPointId);
      if (existing) {
        existing.totalOrders++;
        existing.totalQuantity += order.totalQuantity;
        if (order.deliveryPointMatchStatus === 'matched') {
          existing.matchedOrders++;
          existing.matchedQuantity += order.totalQuantity;
        } else {
          existing.unmatchedOrders++;
        }
      } else {
        map.set(order.deliveryPointId, {
          deliveryPointId: order.deliveryPointId,
          deliveryPointName: order.deliveryPointName ?? '(ללא שם)',
          totalOrders: 1,
          totalQuantity: order.totalQuantity,
          matchedOrders: order.deliveryPointMatchStatus === 'matched' ? 1 : 0,
          matchedQuantity: order.deliveryPointMatchStatus === 'matched' ? order.totalQuantity : 0,
          unmatchedOrders: order.deliveryPointMatchStatus !== 'matched' ? 1 : 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.matchedOrders - a.matchedOrders);
  }, [sourceOrders]);

  const filteredDPs = useMemo(() => {
    if (!searchQuery.trim()) return deliveryPoints;
    const q = searchQuery.trim().toLowerCase();
    return deliveryPoints.filter(
      (dp) =>
        dp.deliveryPointName.toLowerCase().includes(q) ||
        dp.deliveryPointId.toLowerCase().includes(q),
    );
  }, [deliveryPoints, searchQuery]);

  const selectedDP = useMemo(() => {
    if (!selectedDPId) return null;
    return deliveryPoints.find((dp) => dp.deliveryPointId === selectedDPId) ?? null;
  }, [deliveryPoints, selectedDPId]);

  const candidateOrders = useMemo(() => {
    if (!selectedDPId) return [];
    return sourceOrders.filter(
      (o) =>
        o.deliveryPointId === selectedDPId &&
        o.deliveryPointMatchStatus === 'matched' &&
        o.sourceDeliveryLine?.lineKind !== 'delivery_channel',
    );
  }, [sourceOrders, selectedDPId]);

  const hasUnmatchedForDP = useMemo(() => {
    if (!selectedDPId) return false;
    return sourceOrders.some(
      (o) =>
        o.deliveryPointId === selectedDPId &&
        o.deliveryPointMatchStatus !== 'matched' &&
        o.sourceDeliveryLine?.lineKind !== 'delivery_channel',
    );
  }, [sourceOrders, selectedDPId]);

  const handleClose = () => {
    setMode('choice');
    setName('');
    setSearchQuery('');
    setSelectedDPId(null);
    onClose();
  };

  const handleModeSelect = (newMode: Mode) => {
    setMode(newMode);
  };

  const handleManualCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    handleClose();
  };

  const handleDPCreate = () => {
    if (!selectedDPId || candidateOrders.length === 0) return;
    const lineName = selectedDP?.deliveryPointName ?? 'לפי נקודת משלוח';
    const orderIds = candidateOrders.map((o) => o.orderId);
    onCreateWithDeliveryPoint(lineName, selectedDPId, orderIds);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{MODE_LABELS[mode]}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>

        {mode === 'choice' && (
          <div className="px-6 py-6 space-y-4">
            <div
              onClick={() => handleModeSelect('manual')}
              className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <h3 className="font-bold text-gray-900 mb-1">קו ידני</h3>
              <p className="text-sm text-gray-500">צור קו עבודה ריק עם שם חופשי</p>
            </div>

            {isShiftMode && deliveryPoints.length > 0 && (
              <div
                onClick={() => handleModeSelect('delivery_point')}
                className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <h3 className="font-bold text-gray-900 mb-1">לפי נקודת משלוח</h3>
                <p className="text-sm text-gray-500">
                  בחר נקודת משלוח, הצג הזמנות תואמות, צור קו ושייך את ההזמנות
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {deliveryPoints.length} נקודות משלוח זמינות במשמרת
                </p>
              </div>
            )}

            {isShiftMode && deliveryPoints.length === 0 && (
              <div className="border border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="font-bold text-gray-500 mb-1">לפי נקודת משלוח</h3>
                <p className="text-sm text-gray-400">לא נמצאו נקודות משלוח במשמרת זו</p>
              </div>
            )}
          </div>
        )}

        {mode === 'manual' && (
          <div className="px-6 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">שם הקו</label>
            <input
              autoFocus
              className="w-full border border-gray-300 rounded-md p-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              dir="rtl"
              onKeyDown={(e) => { if (e.key === 'Enter') handleManualCreate(); }}
            />
            <div className="text-sm text-gray-500 mb-2">הצעות מהירות:</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestions.map((s) => (
                <span
                  key={s}
                  onClick={() => setName(s)}
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {mode === 'delivery_point' && (
          <div className="px-6 py-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">נקודת משלוח</label>
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חיפוש נקודת משלוח..."
                  className="w-full pr-9 pl-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  dir="rtl"
                  autoFocus
                />
              </div>
            </div>

            {filteredDPs.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400">
                לא נמצאו נקודות משלוח
              </div>
            ) : selectedDPId === null ? (
              <div className="space-y-1 max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                {filteredDPs.map((dp) => (
                  <button
                    key={dp.deliveryPointId}
                    type="button"
                    onClick={() => setSelectedDPId(dp.deliveryPointId)}
                    className="w-full text-right px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-sm text-gray-900">{dp.deliveryPointName}</div>
                    <div className="text-xs text-gray-500">
                      {dp.matchedOrders} הזמנות מזוהות
                      {dp.unmatchedOrders > 0 && (
                        <span className="text-amber-600">, {dp.unmatchedOrders} לא מזוהות</span>
                      )}
                      {' | '}סה"כ {dp.matchedQuantity} יחידות
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{selectedDP?.deliveryPointName}</p>
                    <p className="text-xs text-gray-500">מזהה: {selectedDP?.deliveryPointId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDPId(null)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    שנה נקודת משלוח
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm font-bold text-blue-900">
                    נמצאו {candidateOrders.length} הזמנות תואמות
                  </p>
                  <p className="text-sm text-blue-700">
                    סה"כ כמות: {candidateOrders.reduce((s, o) => s + o.totalQuantity, 0)}
                  </p>
                </div>

                {hasUnmatchedForDP && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                    <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">
                      קיימות הזמנות נוספות עם נקודת משלוח זו שלא זוהו באופן מלא ולא יכללו אוטומטית
                    </p>
                  </div>
                )}

                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                  {candidateOrders.map((order) => (
                    <div
                      key={order.orderId}
                      className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 last:border-b-0 text-sm"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{order.orderNumber ?? '—'}</span>
                        <span className="text-gray-500 mx-1">|</span>
                        <span className="text-gray-600">{order.customerName ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">כמות: {order.totalQuantity}</span>
                        <span className="text-xs text-gray-400">{order.itemLinesCount} שורות</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          {mode !== 'choice' && (
            <button
              type="button"
              onClick={() => {
                setMode('choice');
                setName('');
                setSearchQuery('');
                setSelectedDPId(null);
              }}
              className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              חזור
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ביטול
          </button>
          {mode === 'manual' && (
            <button
              type="button"
              onClick={handleManualCreate}
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              צור קו
            </button>
          )}
          {mode === 'delivery_point' && selectedDPId && (
            <button
              type="button"
              onClick={handleDPCreate}
              disabled={candidateOrders.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              צור קו ושייך {candidateOrders.length} הזמנות
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
