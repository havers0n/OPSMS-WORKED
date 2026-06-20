import type { ProductControlRow } from './product-control-types';
import { CoverageStatusBadge } from './coverage-status-badge';

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
      <td className="px-3 py-2.5 text-xs"><CoverageStatusBadge status={row.status} /></td>
    </tr>
  );
}

function NormalRow({
  row,
  selected,
  onSelect,
}: {
  row: ProductControlRow;
  selected: boolean;
  onSelect: (row: ProductControlRow) => void;
}) {
  const shortage = row.shortageQty > 0 ? row.shortageQty : null;
  const bonded = row.bondedAvailableQty > 0 ? row.bondedAvailableQty : null;
  const cover = row.bondedCoverQty > 0 ? row.bondedCoverQty : null;
  const missing = row.finalMissingQty > 0 ? row.finalMissingQty : null;

  return (
    <tr
      className={`border-b border-gray-100 last:border-b-0 hover:bg-blue-50/50 cursor-pointer transition-colors ${
        selected ? 'bg-blue-50' : ''
      }`}
      onClick={() => onSelect(row)}
    >
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
      <td className="px-3 py-2.5 text-xs"><CoverageStatusBadge status={row.status} /></td>
    </tr>
  );
}

type ShortageTableProps = {
  rows: ProductControlRow[];
  selectedSku: string | null;
  onSelectRow: (row: ProductControlRow) => void;
};

export function ShortageTable({ rows, selectedSku, onSelectRow }: ShortageTableProps) {
  return (
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
              <NormalRow key={row.sku} row={row} selected={selectedSku === row.sku} onSelect={onSelectRow} />
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
