import { useState } from 'react';
import { Package } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import { productControlFixtures } from '@/entities/product-control/product-control-fixtures';
import { ShortageTable } from '@/entities/product-control/shortage-table';
import { ProductControlDetailPanel } from '@/entities/product-control/product-control-detail-panel';
import type { ProductControlRow } from '@/entities/product-control/product-control-types';

function KpiCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
  };

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3">
      <span className={`font-bold text-2xl ${color ? colorMap[color] : 'text-gray-900'}`}>{value}</span>
      <span className="text-xs font-medium text-gray-500">{label}</span>
    </div>
  );
}

export function ProductControlTab() {
  const rows = productControlFixtures;
  const [selectedRow, setSelectedRow] = useState<ProductControlRow | null>(null);

  const totalSkus = rows.filter((r) => r.status !== 'data_issue').length;
  const shortageSkus = rows.filter((r) => r.shortageQty > 0).length;
  const bondedCovered = rows.filter((r) => r.status === 'covered_by_bonded').length;
  const unresolved = rows.filter((r) => r.status === 'unresolved').length;

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
    <div className="flex flex-col gap-4 p-4" dir="rtl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">בקרת מוצרים וחוסרים</h2>
        <p className="mt-1 text-sm text-gray-500">
          תצוגת בקרת חוסרים וכיסוי מבונדד — נתוני דמו בשלב זה
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="סה״כ מק״טים" value={totalSkus} color="blue" />
        <KpiCard label="מק״טים בחוסר" value={shortageSkus} color="amber" />
        <KpiCard label="מכוסים מבונדד" value={bondedCovered} color="green" />
        <KpiCard label="חוסר לא פתור" value={unresolved} color="red" />
      </div>

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <ShortageTable
            rows={rows}
            selectedSku={selectedRow?.sku ?? null}
            onSelectRow={handleSelectRow}
          />
        </div>
        {selectedRow && (
          <ProductControlDetailPanel row={selectedRow} onClose={handleCloseDetail} />
        )}
      </div>
    </div>
  );
}
