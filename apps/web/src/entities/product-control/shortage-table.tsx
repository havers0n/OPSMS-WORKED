import { useState, useMemo } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import type { ProductControlRow } from './product-control-types';
import { CoverageStatusBadge } from './coverage-status-badge';

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

// ---- filter / sort ----

type FilterType = 'actionable_bonded' | 'uncovered' | 'data_issues' | 'all_shortages' | 'all';

const FILTER_DEFS: { type: FilterType; label: string }[] = [
  { type: 'actionable_bonded', label: 'לטיפול עכשיו' },
  { type: 'uncovered', label: 'חסר ללא כיסוי' },
  { type: 'data_issues', label: 'בעיות נתונים' },
  { type: 'all_shortages', label: 'כל החוסרים' },
  { type: 'all', label: 'הכל' },
];

function filterRows(rows: ProductControlRow[], filter: FilterType): ProductControlRow[] {
  switch (filter) {
    case 'actionable_bonded':
      return rows.filter((r) => r.shortageQty > 0 && r.bondedAvailableQty > 0 && r.status !== 'data_issue');
    case 'uncovered':
      return rows.filter((r) => r.shortageQty > 0 && r.bondedAvailableQty <= 0 && r.status !== 'data_issue');
    case 'data_issues':
      return rows.filter((r) => r.status === 'data_issue');
    case 'all_shortages':
      return rows.filter((r) => r.shortageQty > 0);
    default:
      return rows;
  }
}

function sortForDisplay(rows: ProductControlRow[], filter: FilterType): ProductControlRow[] {
  if (filter === 'all') return rows;
  if (filter === 'data_issues') {
    return [...rows].sort((a, b) => b.shortageQty - a.shortageQty);
  }
  return [...rows].sort((a, b) => {
    const d = b.shortageQty - a.shortageQty;
    if (d !== 0) return d;
    const la = a.affectedLinesCount ?? 0;
    const lb = b.affectedLinesCount ?? 0;
    if (lb !== la) return lb - la;
    return b.demandQty - a.demandQty;
  });
}

// ---- row helpers ----

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

function DataIssueExplanation({ dataIssues }: { dataIssues: string[] }) {
  const explanations = dataIssues.map((issue) => {
    switch (issue) {
      case 'unknown_sku':
        return 'מק"ט לא נמצא בקטלוג המוצרים';
      case 'duplicate_canonical_sku':
        return 'נמצאו כמה מוצרים בקטלוג לאותו מק"ט';
      case 'missing_warehouse_stock_snapshot_sku':
        return 'המק"ט לא נמצא ב-Snapshot מלאי המחסן';
      default:
        return issue;
    }
  });
  return (
    <div className="flex flex-col gap-0.5 mt-1">
      {explanations.map((text, i) => (
        <span key={i} className="text-[10px] text-red-600 leading-tight flex items-center gap-1">
          <AlertTriangle size={10} className="shrink-0" />
          {text}
        </span>
      ))}
    </div>
  );
}

function BondedCoverageSummary({
  bondedCoverQty,
  shortageQty,
}: {
  bondedCoverQty: number;
  shortageQty: number;
}) {
  if (bondedCoverQty > 0) {
    return (
      <span className="text-[10px] text-blue-600 mt-0.5 block leading-tight">
        כיסוי בונדד: {bondedCoverQty} מתוך {shortageQty}
      </span>
    );
  }
  return (
    <span className="text-[10px] text-gray-400 mt-0.5 block leading-tight">
      אין כיסוי בונדד
    </span>
  );
}

// ---- row components ----

function NormalRow({
  row,
  selected,
  onSelect,
}: {
  row: ProductControlRow;
  selected: boolean;
  onSelect: (row: ProductControlRow) => void;
}) {
  const isUnavailable = row.status === 'unresolved';
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
      <td className="p-3 text-sm font-mono text-center text-red-600 font-bold">
        {row.shortageQty > 0 ? row.shortageQty : 0}
      </td>
      <td className="p-3 text-sm font-mono text-center text-blue-600">
        {row.bondedAvailableQty > 0 ? row.bondedAvailableQty : '-'}
      </td>
      <td className="p-3 text-sm font-mono text-center text-blue-600">
        {row.bondedCoverQty > 0 ? row.bondedCoverQty : '-'}
      </td>
      <td className="p-3 text-sm font-mono text-center text-red-500">
        {row.finalMissingQty > 0 ? row.finalMissingQty : '-'}
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
      <td className="p-3 text-xs text-gray-400">{row.category}</td>
      <td className="p-3 text-sm font-mono text-center text-gray-400">{row.demandQty}</td>
      <td className="p-3 text-sm font-mono text-center text-gray-400">{row.warehouseQty}</td>
      <td className="p-3 text-center">
        <CoverageStatusBadge status={row.status} />
        {row.dataIssues && row.dataIssues.length > 0 && (
          <DataIssueExplanation dataIssues={row.dataIssues} />
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

function DataIssueRow({
  row,
  selected,
  onSelect,
}: {
  row: ProductControlRow;
  selected: boolean;
  onSelect: (row: ProductControlRow) => void;
}) {
  const action = getActionLabel(row.status);

  return (
    <tr
      className={joinClassNames(
        'border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors bg-red-50/20 hover:bg-red-50/50',
        selected ? 'bg-red-50/40' : ''
      )}
      onClick={() => onSelect(row)}
    >
      <td className="p-3 text-sm font-mono font-medium text-gray-900 whitespace-nowrap">{row.sku}</td>
      <td className="p-3 text-sm font-semibold text-gray-900">{row.description}</td>
      <td className="p-3 text-sm font-mono text-center text-red-600 font-bold">
        {row.shortageQty > 0 ? row.shortageQty : 0}
      </td>
      <td className="p-3 text-sm font-mono text-center text-blue-600">
        {row.bondedAvailableQty > 0 ? row.bondedAvailableQty : '-'}
      </td>
      <td className="p-3 text-sm font-mono text-center text-blue-600">
        {row.bondedCoverQty > 0 ? row.bondedCoverQty : '-'}
      </td>
      <td className="p-3 text-sm font-mono text-center text-red-500">
        {row.finalMissingQty > 0 ? row.finalMissingQty : '-'}
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
      <td className="p-3 text-xs text-gray-400">{row.category}</td>
      <td className="p-3 text-sm font-mono text-center text-gray-400">{row.demandQty}</td>
      <td className="p-3 text-sm font-mono text-center text-gray-400">{row.warehouseQty}</td>
      <td className="p-3 text-center">
        <CoverageStatusBadge status={row.status} />
        {row.dataIssues && row.dataIssues.length > 0 && (
          <DataIssueExplanation dataIssues={row.dataIssues} />
        )}
        <BondedCoverageSummary
          bondedCoverQty={row.bondedCoverQty}
          shortageQty={row.shortageQty}
        />
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

// ---- exported component ----

type ShortageTableProps = {
  rows: ProductControlRow[];
  selectedSku: string | null;
  onSelectRow: (row: ProductControlRow) => void;
};

export function ShortageTable({ rows, selectedSku, onSelectRow }: ShortageTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('actionable_bonded');

  const counts = useMemo(() => {
    const result: Record<FilterType, number> = {
      actionable_bonded: 0,
      uncovered: 0,
      data_issues: 0,
      all_shortages: 0,
      all: rows.length,
    };
    for (const r of rows) {
      if (r.shortageQty > 0) result.all_shortages++;
      if (r.shortageQty > 0 && r.bondedAvailableQty > 0 && r.status !== 'data_issue') result.actionable_bonded++;
      if (r.shortageQty > 0 && r.bondedAvailableQty <= 0 && r.status !== 'data_issue') result.uncovered++;
      if (r.status === 'data_issue') result.data_issues++;
    }
    return result;
  }, [rows]);

  const displayedRows = useMemo(() => {
    let result = rows;
    if (searchTerm) {
      result = result.filter(
        (r) => r.sku.includes(searchTerm) || r.description.includes(searchTerm)
      );
    }
    result = filterRows(result, activeFilter);
    result = sortForDisplay(result, activeFilter);
    return result;
  }, [rows, searchTerm, activeFilter]);

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

      <div className="flex gap-2 px-5 py-2.5 border-b border-gray-100 flex-wrap">
        {FILTER_DEFS.map((f) => (
          <button
            key={f.type}
            type="button"
            onClick={() => setActiveFilter(f.type)}
            className={joinClassNames(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors',
              activeFilter === f.type
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >
            {f.label} {counts[f.type]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <th className="p-3 text-right whitespace-nowrap">מק"ט</th>
              <th className="p-3 text-right whitespace-nowrap">תיאור פריט</th>
              <th className="p-3 text-center whitespace-nowrap">חסר</th>
              <th className="p-3 text-center whitespace-nowrap">זמין בבונדד</th>
              <th className="p-3 text-center whitespace-nowrap">כיסוי בבונדד</th>
              <th className="p-3 text-center whitespace-nowrap">נותר חסר</th>
              <th className="p-3 text-center whitespace-nowrap">שורות מושפעות</th>
              <th className="p-3 text-right whitespace-nowrap text-[10px] text-gray-300 font-normal">קטגוריה</th>
              <th className="p-3 text-center whitespace-nowrap text-[10px] text-gray-300 font-normal">כמות בהזמנה</th>
              <th className="p-3 text-center whitespace-nowrap text-[10px] text-gray-300 font-normal">כמות במחסן</th>
              <th className="p-3 text-center whitespace-nowrap text-[10px] text-gray-300 font-normal">סטטוס כיסוי</th>
              <th className="p-3 text-center whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row) =>
              row.status === 'data_issue' ? (
                <DataIssueRow
                  key={row.sku}
                  row={row}
                  selected={selectedSku === row.sku}
                  onSelect={onSelectRow}
                />
              ) : (
                <NormalRow
                  key={row.sku}
                  row={row}
                  selected={selectedSku === row.sku}
                  onSelect={onSelectRow}
                />
              )
            )}
            {displayedRows.length === 0 && (
              <tr>
                <td colSpan={12} className="h-24 text-center text-sm text-gray-500">
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
