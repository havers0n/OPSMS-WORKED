import { useState } from 'react';
import { useCreateBondedRequest } from '../api/mutations';
import type { ProductControlRow } from '@/entities/product-control/product-control-types';
import type { CreateBondedCoverageRequestInput } from '@wos/domain';

type BondedRequestCreateCardProps = {
  shiftId: string;
  row: ProductControlRow;
  planningDate: string;
  bondedSnapshotId?: string | null;
  warehouseStockSnapshotId?: string | null;
  onCreated?: (requestId: string) => void;
};

type CardState = 'idle' | 'pending' | 'success' | 'error';

export function BondedRequestCreateCard({
  shiftId,
  row,
  planningDate,
  bondedSnapshotId,
  warehouseStockSnapshotId,
  onCreated,
}: BondedRequestCreateCardProps) {
  const [requestedQty, setRequestedQty] = useState(row.bondedCoverQty);
  const [requestNotes, setRequestNotes] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [cardState, setCardState] = useState<CardState>('idle');

  const createRequest = useCreateBondedRequest();

  const isValid = requestedQty > 0;
  const recommendedMax = row.bondedCoverQty;

  const handleSubmit = () => {
    if (!isValid) return;
    setCardState('pending');

    const payload: CreateBondedCoverageRequestInput = {
      planningDate,
      title: `בקשת כיסוי - ${row.sku}`,
      notes: requestNotes || null,
      bondedSnapshotId: bondedSnapshotId ?? null,
      warehouseStockSnapshotId: warehouseStockSnapshotId ?? null,
      items: [
        {
          sku: row.sku,
          description: row.description,
          category: row.category,
          requestedQty,
          demandQtyAtCreate: row.demandQty,
          warehouseQtyAtCreate: row.warehouseQty,
          shortageQtyAtCreate: row.shortageQty,
          bondedAvailableQtyAtCreate: row.bondedAvailableQty,
          bondedCoverQtyAtCreate: row.bondedCoverQty,
          notes: itemNotes || null,
        },
      ],
    };

    createRequest.mutate(
      { shiftId, data: payload },
      {
        onSuccess: (result) => {
          setCardState('success');
          onCreated?.(result.id);
        },
        onError: () => {
          setCardState('error');
        },
      },
    );
  };

  if (cardState === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
          <span className="text-base font-bold text-green-800">בקשה נוצרה</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-800 mb-4">בקשת כיסוי בונדד</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-bold text-slate-600 mb-1">
            כמות מבוקשת
          </label>
          <input
            type="number"
            min={1}
            value={requestedQty}
            onChange={(e) => {
              const val = e.target.value;
              setRequestedQty(val === '' ? 0 : Number(val));
              if (cardState === 'error') setCardState('idle');
            }}
            className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
            disabled={cardState === 'pending'}
          />
          <p className="text-xs text-slate-400 mt-1">
            כמות מומלצת: {recommendedMax}
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-600 mb-1">
            הערות
          </label>
          <input
            type="text"
            value={requestNotes}
            onChange={(e) => {
              setRequestNotes(e.target.value);
              if (cardState === 'error') setCardState('idle');
            }}
            placeholder="הערות לבקשה"
            className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
            disabled={cardState === 'pending'}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-600 mb-1">
            הערות לפריט
          </label>
          <input
            type="text"
            value={itemNotes}
            onChange={(e) => {
              setItemNotes(e.target.value);
              if (cardState === 'error') setCardState('idle');
            }}
            placeholder="הערות לפריט בבקשה"
            className="w-full h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
            disabled={cardState === 'pending'}
          />
        </div>

        {cardState === 'error' && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            לא הצלחנו ליצור בקשת כיסוי
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || cardState === 'pending'}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cardState === 'pending' ? 'יוצר בקשה...' : 'צור בקשת כיסוי'}
        </button>

        {!isValid && (
          <p className="text-xs text-red-500">
            לא ניתן ליצור בקשה ללא כמות תקינה
          </p>
        )}
      </div>
    </div>
  );
}
