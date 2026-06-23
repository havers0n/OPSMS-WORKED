import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { bondedRequestDetailQueryOptions } from '../api/queries';
import { useUpdateBondedRequestItem, useCloseBondedRequest, useCancelBondedRequest } from '../api/mutations';
import { BondedRequestStatusBadge } from './bonded-request-status-badge';
import { BondedRequestCloseForm } from './bonded-request-close-form';
import type { BondedCoverageRequestItem } from '@wos/domain';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type BondedRequestDetailPanelProps = {
  requestId: string;
  shiftId?: string;
  onClose: () => void;
};

export function BondedRequestDetailPanel({
  requestId,
  shiftId,
  onClose,
}: BondedRequestDetailPanelProps) {
  const { data: detail, isLoading, error } = useQuery(
    bondedRequestDetailQueryOptions(requestId),
  );

  const updateItem = useUpdateBondedRequestItem();
  const closeRequest = useCloseBondedRequest();
  const cancelRequest = useCancelBondedRequest();

  const [showCloseForm, setShowCloseForm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [editingQty, setEditingQty] = useState<Record<string, number>>({});
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const isOpen = detail?.status === 'open';
  const isPendingAction = closeRequest.isPending || cancelRequest.isPending;

  const handleUpdateQty = (item: BondedCoverageRequestItem, newQty: number) => {
    if (newQty <= 0) return;
    updateItem.mutate({
      requestId,
      itemId: item.id,
      data: { requestedQty: newQty },
    });
  };

  const handleUpdateNotes = (item: BondedCoverageRequestItem, newNotes: string) => {
    updateItem.mutate({
      requestId,
      itemId: item.id,
      data: { notes: newNotes || null },
    });
  };

  const handleClose = (data: { notes: string | null; items: { itemId: string; fulfilledQty: number }[] }) => {
    closeRequest.mutate(
      { requestId, data: { notes: data.notes, items: data.items }, shiftId },
      {
        onSuccess: () => {
          setShowCloseForm(false);
        },
      },
    );
  };

  const handleCancel = () => {
    cancelRequest.mutate(
      { requestId, data: {}, shiftId },
      {
        onSuccess: () => {
          setShowCancelConfirm(false);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-7xl mx-auto bg-white shadow-xl rounded-b-2xl border-b border-gray-200 overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0" dir="rtl">
          <div className="flex items-center gap-3 min-w-0">
            {isLoading ? (
              <Loader2 size={20} className="animate-spin text-gray-400" />
            ) : detail ? (
              <>
                <BondedRequestStatusBadge status={detail.status} />
                <h2 className="text-lg font-bold text-slate-800 truncate">
                  {detail.title ?? 'בקשת כיסוי'}
                </h2>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            aria-label="סגור"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4" dir="rtl">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-gray-400" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <AlertCircle size={28} className="text-red-400" />
              <span className="text-sm font-medium text-red-600">
                לא הצלחנו לטעון בקשות כיסוי
              </span>
            </div>
          )}

          {detail && (
            <div className="space-y-5">
              {/* Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {detail.notes && (
                  <div className="col-span-full">
                    <span className="text-slate-500">הערות:</span>
                    <span className="mr-2 text-slate-800">{detail.notes}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">נוצר על ידי:</span>
                  <span className="mr-2 text-slate-800">{detail.createdByName ?? '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">נוצר בתאריך:</span>
                  <span className="mr-2 text-slate-800">{formatDateTime(detail.createdAt)}</span>
                </div>
                <div>
                  <span className="text-slate-500">תאריך תכנון:</span>
                  <span className="mr-2 text-slate-800">{detail.planningDate ?? '—'}</span>
                </div>
                {detail.status === 'closed' && (
                  <>
                    <div>
                      <span className="text-slate-500">נסגר על ידי:</span>
                      <span className="mr-2 text-slate-800">{detail.closedByName ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">נסגר בתאריך:</span>
                      <span className="mr-2 text-slate-800">{formatDateTime(detail.closedAt)}</span>
                    </div>
                  </>
                )}
                {detail.status === 'cancelled' && (
                  <>
                    <div>
                      <span className="text-slate-500">בוטל על ידי:</span>
                      <span className="mr-2 text-slate-800">{detail.cancelledByName ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">בוטל בתאריך:</span>
                      <span className="mr-2 text-slate-800">{formatDateTime(detail.cancelledAt)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Items table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">SKU</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">תיאור</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">כמות מבוקשת</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">כמות שסופקה</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">דרישה ביצירה</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">במחסן ביצירה</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">חסר ביצירה</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">זמין בבונדד</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">כיסוי בבונדד</th>
                      <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">הערות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{item.sku}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-600">{item.description ?? '—'}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          {isOpen ? (
                            <input
                              type="number"
                              min={1}
                              value={editingQty[item.id] ?? item.requestedQty}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingQty((prev) => ({ ...prev, [item.id]: val === '' ? 0 : Number(val) }));
                              }}
                              onBlur={() => {
                                const qty = editingQty[item.id];
                                if (qty !== undefined && qty !== item.requestedQty) {
                                  handleUpdateQty(item, qty);
                                }
                                setEditingQty((prev) => {
                                  const next = { ...prev };
                                  delete next[item.id];
                                  return next;
                                });
                              }}
                              className="w-16 h-7 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-center"
                            />
                          ) : (
                            item.requestedQty
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{item.fulfilledQty}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-500">{item.demandQtyAtCreate ?? '—'}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-500">{item.warehouseQtyAtCreate ?? '—'}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-500">{item.shortageQtyAtCreate ?? '—'}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-500">{item.bondedAvailableQtyAtCreate ?? '—'}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-500">{item.bondedCoverQtyAtCreate ?? '—'}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          {isOpen ? (
                            <input
                              type="text"
                              value={editingNotes[item.id] ?? item.notes ?? ''}
                              onChange={(e) => {
                                setEditingNotes((prev) => ({ ...prev, [item.id]: e.target.value }));
                              }}
                              onBlur={() => {
                                const notes = editingNotes[item.id];
                                if (notes !== undefined && notes !== (item.notes ?? '')) {
                                  handleUpdateNotes(item, notes);
                                }
                                setEditingNotes((prev) => {
                                  const next = { ...prev };
                                  delete next[item.id];
                                  return next;
                                });
                              }}
                              placeholder="—"
                              className="w-24 h-7 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs"
                            />
                          ) : (
                            item.notes ?? '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Open request actions */}
              {isOpen && !showCloseForm && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCloseForm(true)}
                    disabled={isPendingAction}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    סגור בקשה
                  </button>
                  {!showCancelConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={isPendingAction}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 transition-colors bg-red-50 hover:bg-red-100 disabled:opacity-50"
                    >
                      בטל בקשה
                    </button>
                  ) : null}
                </div>
              )}

              {/* Cancel confirmation */}
              {isOpen && showCancelConfirm && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800 mb-3">
                    האם אתה בטוח שברצונך לבטל בקשה זו?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={cancelRequest.isPending}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      {cancelRequest.isPending ? 'מבטל...' : 'בטל בקשה'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={cancelRequest.isPending}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 transition-colors bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                    >
                      חזור
                    </button>
                  </div>
                  {cancelRequest.isError && (
                    <p className="text-xs text-red-600 mt-2">
                      לא הצלחנו לבטל בקשה
                    </p>
                  )}
                </div>
              )}

              {/* Close form */}
              {isOpen && showCloseForm && (
                <BondedRequestCloseForm
                  items={detail.items}
                  isPending={closeRequest.isPending}
                  onSubmit={handleClose}
                  onCancel={() => setShowCloseForm(false)}
                />
              )}

              {/* Close/cancel errors */}
              {closeRequest.isError && !showCloseForm && (
                <p className="text-xs text-red-600">
                  לא הצלחנו לסגור בקשה
                </p>
              )}
              {cancelRequest.isError && !showCancelConfirm && (
                <p className="text-xs text-red-600">
                  לא הצלחנו לבטל בקשה
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
