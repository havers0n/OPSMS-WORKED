import { useState } from 'react';
import { Package } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import { productControlFixtures } from '@/entities/product-control/product-control-fixtures';
import { ShortageTable } from '@/entities/product-control/shortage-table';
import { ProductControlDetailPanel } from '@/entities/product-control/product-control-detail-panel';
import type { ProductControlRow } from '@/entities/product-control/product-control-types';

export function ProductControlTab() {
  const rows = productControlFixtures;
  const [selectedRow, setSelectedRow] = useState<ProductControlRow | null>(null);

  const totalSkus = rows.filter((r) => r.status !== 'data_issue').length;
  const shortageSkus = rows.filter((r) => r.shortageQty > 0).length;
  const coverable = rows.filter(
    (r) => r.shortageQty > 0 && r.bondedAvailableQty >= r.shortageQty
  ).length;

  const handleSelectRow = (row: ProductControlRow) => {
    if (row.status === 'data_issue') return;
    setSelectedRow((prev) => (prev?.sku === row.sku ? null : row));
  };

  const handleCloseDetail = () => setSelectedRow(null);

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
    <div className="flex flex-col gap-6 h-full" dir="rtl">
      {/* Header with inline KPI cards */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">חוסרים להיום + כיסוי בונדד</h1>
          <p className="text-sm text-gray-500 mt-1">סקירת מלאי זמין מול דרישות הזמנה יומיות</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
            <span className="text-xs text-gray-400">סה״כ מק״טים</span>
            <span className="text-xl font-bold">{totalSkus}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
            <span className="text-xs text-gray-400 text-red-500">בחוסר</span>
            <span className="text-xl font-bold text-red-600">{shortageSkus}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
            <span className="text-xs text-gray-400 text-green-500">ניתן לכיסוי</span>
            <span className="text-xl font-bold text-green-600">{coverable}</span>
          </div>
        </div>
      </div>

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
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseDetail}
          />
          {/* Sheet panel */}
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
