import { useState } from 'react';
import { Search } from 'lucide-react';
import type { ProductControlRow } from './product-control-types';
import { CoverageStatusBadge } from './coverage-status-badge';

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

function getActionLabel(status: ProductControlRow['status']) {
  switch (status) {
    case 'ok':
      return { label: 'צפייה', className: 'text-gray-500 hover:text-gray-700' };
    case 'covered_by_bonded':
    case 'partial_bonded':
      return { label: 'פתח בונדד', className: 'text-blue-600 hover:text-blue-800' };
    case 'unresolved':
      return { label: 'בדוק ידנית', className: 'text-amber-600 hover:text-amber-800' };
    case 'data_issue':
      return { label: 'בדוק ידנית', className: 'text-amber-600 hover:text-amber-800' };
  }
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
  const isUnavailable = row.status === 'unresolved' || row.status === 'data_issue';
  const action = getActionLabel(row.status);

  return (
    <tr
      className={joinClassNames(
        'border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors',
        isUnavailable ? 'bg-red-50/20 hover:bg-red-50/50' : 'hover:bg-blue-50/50',
        selected ? (isUnavailable ? 'bg-red-50/40' : 'bg-blue-50') : ''
      )}
      onClick={() => onSelect(row)}
    >
      <td className="p-3 text-sm font-mono font-medium text-gray-900 whitespace-nowrap">{row.sku}</td>
      <td className="p-3 text-sm font-semibold text-gray-900">{row.description}</td>
      <td className="p-3 text-xs text-gray-500">{row.category}</td>
      <td className="p-3 text-sm font-mono text-center">{row.demandQty}</td>
      <td className="p-3 text-sm font-mono text-center">{row.warehouseQty}</td>
      <td className="p-3 text-sm font-mono text-center text-red-600 font-bold">
        {row.shortageQty > 0 ? row.shortageQty : 0}
      </td>
      <td className="p-3 text-sm font-mono text-center text-blue-600">
        {row.bondedAvailableQty > 0 ? row.bondedAvailableQty : '-'}
      </td>
      <td className="p-3 text-center">
        <CoverageStatusBadge status={row.status} />
      </td>
      <td className="p-3 text-center">
        {row.affectedLinesCount && row.affectedLinesCount > 0 ? (
          <span className="text-xs font-bold text-gray-500">
            {row.affectedLinesCount} שורות
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </td>
      <td className="p-3 text-left">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(row); }}
          className={joinClassNames(
            'font-bold text-xs transition-colors',
            action.className
          )}
        >
          {action.label}
        </button>
      </td>
    </tr>
  );
}

function DataIssueRow({ row }: { row: ProductControlRow }) {
  return (
    <tr className="bg-red-50/50">
      <td className="p-3 text-sm font-mono font-medium text-gray-900 whitespace-nowrap">{row.sku}</td>
      <td className="p-3 text-sm text-gray-900">{row.description}</td>
      <td className="p-3 text-xs text-gray-500">{row.category}</td>
      <td className="p-3 text-sm font-mono text-center text-red-600">{row.demandQty}</td>
      <td className="p-3 text-sm font-mono text-center">{row.warehouseQty}</td>
      <td className="p-3 text-sm font-mono text-center text-gray-400">-</td>
      <td className="p-3 text-sm font-mono text-center text-gray-400">-</td>
      <td className="p-3 text-center"><CoverageStatusBadge status={row.status} /></td>
      <td className="p-3 text-center text-gray-300">-</td>
      <td className="p-3 text-left">
        <span className="text-amber-600 font-bold text-xs">בדוק ידנית</span>
      </td>
    </tr>
  );
}

type ShortageTableProps = {
  rows: ProductControlRow[];
  selectedSku: string | null;
  onSelectRow: (row: ProductControlRow) => void;
};

export function ShortageTable({ rows, selectedSku, onSelectRow }: ShortageTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRows = searchTerm
    ? rows.filter(
        (r) =>
          r.sku.includes(searchTerm) ||
          r.description.includes(searchTerm)
      )
    : rows;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">טבלת פריטים</h3>
        <div className="relative w-64">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            placeholder="חיפוש מקט או תיאור..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 rounded-md border border-slate-200 bg-transparent pr-9 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <th className="p-3 text-right whitespace-nowrap">מק"ט</th>
              <th className="p-3 text-right whitespace-nowrap">תיאור פריט</th>
              <th className="p-3 text-right whitespace-nowrap">קטגוריה</th>
              <th className="p-3 text-center whitespace-nowrap">כמות בהזמנה</th>
              <th className="p-3 text-center whitespace-nowrap">כמות במחסן</th>
              <th className="p-3 text-center whitespace-nowrap">חסר</th>
              <th className="p-3 text-center whitespace-nowrap">זמין בבונדד</th>
              <th className="p-3 text-center whitespace-nowrap">סטטוס כיסוי</th>
              <th className="p-3 text-center whitespace-nowrap">שורות מושפעות</th>
              <th className="p-3 text-center whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) =>
              row.status === 'data_issue' ? (
                <DataIssueRow key={row.sku} row={row} />
              ) : (
                <NormalRow key={row.sku} row={row} selected={selectedSku === row.sku} onSelect={onSelectRow} />
              )
            )}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={10} className="h-24 text-center text-sm text-gray-500">
                  לא נמצאו פריטים תואמים
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
