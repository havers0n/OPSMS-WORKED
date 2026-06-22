import { useState } from 'react';
import { Package, Loader2, AlertCircle, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@/shared/ui/empty-state';
import { productControlQueryOptions } from '@/entities/manual-shift/api/queries';
import { ShortageTable } from '@/entities/product-control/shortage-table';
import { ProductControlDetailPanel } from '@/entities/product-control/product-control-detail-panel';
import type { ProductControlRow } from '@/entities/product-control/product-control-types';

type ProductControlTabProps = {
  shiftId: string;
};

function formatDateTime(iso: string): string {
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

export function ProductControlTab({ shiftId }: ProductControlTabProps) {
  const { data, isLoading, error } = useQuery(productControlQueryOptions(shiftId));
  const [selectedRow, setSelectedRow] = useState<ProductControlRow | null>(null);

  const handleSelectRow = (row: ProductControlRow) => {
    setSelectedRow((prev) => (prev?.sku === row.sku ? null : row));
  };

  const handleCloseDetail = () => setSelectedRow(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">טוען נתוני בקרת מוצרים...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20" dir="rtl">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <AlertCircle size={32} className="text-red-400" />
          <span className="text-sm font-medium text-red-600">שגיאה בטעינת נתוני בקרת מוצרים</span>
          <span className="text-xs text-gray-500">אנא נסה שוב מאוחר יותר</span>
        </div>
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  if (rows.length === 0) {
    return (
      <EmptyState
        title="אין נתוני מוצרים"
        description="לא נמצאו נתוני בקרת מוצרים להצגה"
        icon={<Package size={24} className="text-gray-400" />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full" dir="rtl">
      {/* Header with inline KPI cards */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">חוסרים להיום + כיסוי בונדד</h1>
          <p className="text-sm text-gray-500 mt-1">סקירת מלאי זמין מול דרישות הזמנה יומיות</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
            <span className="text-xs text-gray-400">סה״כ מק״טים</span>
            <span className="text-xl font-bold">{totals?.totalSkus ?? 0}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
            <span className="text-xs text-gray-400 text-red-500">בחוסר</span>
            <span className="text-xl font-bold text-red-600">{totals?.shortageSkus ?? 0}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
            <span className="text-xs text-gray-400 text-green-500">ניתן לכיסוי בבונדד</span>
            <span className="text-xl font-bold text-green-600">{totals?.coveredByBondedSkus ?? 0}</span>
          </div>
          {(totals?.dataIssueSkus ?? 0) > 0 && (
            <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-sm flex flex-col items-center min-w-[100px]">
              <span className="text-xs text-amber-500">בעיות נתונים</span>
              <span className="text-xl font-bold text-amber-600">{totals?.dataIssueSkus ?? 0}</span>
            </div>
          )}
        </div>
      </div>

      {/* Warehouse stock snapshot banner */}
      {data?.warehouseStockSnapshot && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <Info size={16} className="text-green-600 shrink-0" />
          <div className="text-sm text-green-800">
            <span className="font-bold">Snapshot מלאי מחסן פעיל לתאריך זה</span>
            <span className="mx-2 text-green-400">|</span>
            <span>
              קובץ: {data.warehouseStockSnapshot.fileName ?? '—'}
              <span className="mx-1.5 text-green-400">·</span>
              מק״טים: {data.warehouseStockSnapshot.uniqueSkuCount}
              <span className="mx-1.5 text-green-400">·</span>
              שורות מקור: {data.warehouseStockSnapshot.sourceRowCount}
            </span>
          </div>
        </div>
      )}
      {!data?.warehouseStockSnapshot && data?.warnings?.includes('no_warehouse_stock_snapshot_for_planning_date') && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800">
            לא נמצא Snapshot מלאי מחסן לתאריך העבודה הנבחר. המערכת משתמשת במקור המלאי הישן.
          </span>
        </div>
      )}

      {/* Bonded snapshot banner */}
      {data?.bondedSnapshot && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <Info size={16} className="text-green-600 shrink-0" />
          <div className="text-sm text-green-800">
            <span className="font-bold">Snapshot בונדד פעיל לתאריך זה</span>
            <span className="mx-2 text-green-400">|</span>
            <span>
              קובץ: {data.bondedSnapshot.fileName ?? '—'}
              <span className="mx-1.5 text-green-400">·</span>
              שורות: {data.bondedSnapshot.rowCount}
              <span className="mx-1.5 text-green-400">·</span>
              הועלה: {formatDateTime(data.bondedSnapshot.importedAt)}
            </span>
          </div>
        </div>
      )}
      {!data?.bondedSnapshot && data?.warnings?.includes('no_bonded_snapshot_for_planning_date') && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800">
            לא נמצא Snapshot בונדד לתאריך העבודה הנבחר. כיסוי בונדד יוצג כ-0.
          </span>
        </div>
      )}

      {/* Shortage table */}
      <div className="flex-1 min-h-0">
        <ShortageTable
          rows={rows}
          selectedSku={selectedRow?.sku ?? null}
          onSelectRow={handleSelectRow}
        />
      </div>

      {/* Bottom drawer overlay */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-start justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseDetail}
          />
          <div
            className="relative z-10 w-full max-w-7xl mx-auto bg-white shadow-xl rounded-b-2xl border-b border-gray-200 overflow-hidden flex flex-col"
            style={{ maxHeight: '80vh' }}
          >
            <ProductControlDetailPanel row={selectedRow} onClose={handleCloseDetail} />
          </div>
        </div>
      )}
    </div>
  );
}