import { Package } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { EmptyState } from '@/shared/ui/empty-state';
import { productControlFixtures } from '@/entities/product-control/product-control-fixtures';
import type { ProductControlRow, ProductControlStatus } from '@/entities/product-control/product-control-types';

const STATUS_TONE: Record<ProductControlStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  covered_by_bonded: 'success',
  partial_bonded: 'warning',
  unresolved: 'danger',
  data_issue: 'danger',
};

const STATUS_LABEL: Record<ProductControlStatus, string> = {
  ok: 'תקין',
  covered_by_bonded: 'מכוסה מבונדד',
  partial_bonded: 'כיסוי חלקי',
  unresolved: 'חוסר לא פתור',
  data_issue: 'בעיית נתונים',
};

function StatusBadge({ status }: { status: ProductControlStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

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

function DataIssueRow({ row }: { row: ProductControlRow }) {
  return (
    <tr className="bg-red-50/50">
      <td className="px-3 py-2.5 text-xs text-gray-900">{row.sku}</td>
      <td className="px-3 py-2.5 text-xs text-gray-900">{row.description}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500">{row.category}</td>
      <td className="px-3 py-2.5 text-xs text-red-600">{row.demandQty}</td>
      <td className="px-3 py-2.5 text-xs">{row.warehouseQty}</td>
      <td className="px-3 py-2.5 text-xs text-gray-400">—</td>
      <td className="px-3 py-2.5 text-xs text-gray-400">—</td>
      <td className="px-3 py-2.5 text-xs text-gray-400">—</td>
      <td className="px-3 py-2.5 text-xs text-gray-400">—</td>
      <td className="px-3 py-2.5 text-xs"><StatusBadge status={row.status} /></td>
    </tr>
  );
}

function NormalRow({ row }: { row: ProductControlRow }) {
  const shortage = row.shortageQty > 0 ? row.shortageQty : null;
  const bonded = row.bondedAvailableQty > 0 ? row.bondedAvailableQty : null;
  const cover = row.bondedCoverQty > 0 ? row.bondedCoverQty : null;
  const missing = row.finalMissingQty > 0 ? row.finalMissingQty : null;

  return (
    <tr className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50">
      <td className="px-3 py-2.5 text-xs font-medium text-gray-900 whitespace-nowrap">{row.sku}</td>
      <td className="px-3 py-2.5 text-xs text-gray-700">{row.description}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500">{row.category}</td>
      <td className="px-3 py-2.5 text-xs font-medium text-gray-900 text-left" dir="ltr">{row.demandQty}</td>
      <td className="px-3 py-2.5 text-xs text-gray-900 text-left" dir="ltr">{row.warehouseQty}</td>
      <td className="px-3 py-2.5 text-xs text-left" dir="ltr">
        {shortage !== null ? <span className="font-medium text-red-600">{shortage}</span> : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-left" dir="ltr">
        {bonded !== null ? <span className="text-gray-900">{bonded}</span> : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-left" dir="ltr">
        {cover !== null ? <span className="font-medium text-emerald-600">{cover}</span> : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-left" dir="ltr">
        {missing !== null ? <span className="font-medium text-red-700">{missing}</span> : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2.5 text-xs"><StatusBadge status={row.status} /></td>
    </tr>
  );
}

export function ProductControlTab() {
  const rows = productControlFixtures;

  const totalSkus = rows.filter((r) => r.status !== 'data_issue').length;
  const shortageSkus = rows.filter((r) => r.shortageQty > 0).length;
  const bondedCovered = rows.filter((r) => r.status === 'covered_by_bonded').length;
  const unresolved = rows.filter((r) => r.status === 'unresolved').length;

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

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">מק״ט</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">תיאור</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">קטגוריה</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">דרישה</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">מלאי</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">חוסר</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">זמין בבונדד</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">כיסוי מבונדד</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">חוסר סופי</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              row.status === 'data_issue' ? (
                <DataIssueRow key={row.sku} row={row} />
              ) : (
                <NormalRow key={row.sku} row={row} />
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
