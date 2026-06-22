import { X, Truck, PackageOpen, AlertTriangle, Info } from 'lucide-react';
import { CoverageStatusBadge } from './coverage-status-badge';
import type { ProductControlRow } from './product-control-types';

type DetailPanelProps = {
  row: ProductControlRow;
  onClose: () => void;
};

export function ProductControlDetailPanel({ row, onClose }: DetailPanelProps) {
  const candidates = row.bondedCandidates ?? [];
  const workLines = row.workLines ?? [];
  const isDataIssue = row.status === 'data_issue';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="p-5 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded uppercase">
                פריט נבחר
              </span>
              <h2 className="text-xl font-bold text-slate-900">{row.description}</h2>
            </div>
            <div className="flex items-center gap-5 text-sm font-medium text-slate-500">
              <span>
                מק"ט: <span className="font-mono text-slate-900">{row.sku}</span>
              </span>
              <span>
                קטגוריה: <span className="font-mono text-slate-900">{row.category}</span>
              </span>
              <span>
                סטטוס: <CoverageStatusBadge status={row.status} />
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="סגור פרטי מוצר"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stat cards */}
        <div className="flex gap-4 mt-4">
          <div className="flex flex-col items-center bg-slate-100 px-6 py-3 rounded-xl border border-slate-200 min-w-[120px]">
            <span className="text-sm font-bold text-slate-500 mb-1">במחסן</span>
            <span className="text-2xl font-mono text-slate-900 font-bold">{row.warehouseQty}</span>
          </div>
          <div className="flex flex-col items-center bg-red-50 px-6 py-3 rounded-xl border border-red-200 shadow-sm min-w-[120px]">
            <span className="text-sm font-bold text-red-800 mb-1">כמות חסרה להיום</span>
            <span className="text-2xl font-mono text-red-600 font-bold">{row.shortageQty}</span>
          </div>
          <div className="flex flex-col items-center bg-blue-50 px-6 py-3 rounded-xl border border-blue-200 shadow-sm min-w-[120px]">
            <span className="text-sm font-bold text-blue-800 mb-1">כרגע בבונדד</span>
            <span className="text-2xl font-mono text-blue-600 font-bold">{row.bondedAvailableQty}</span>
          </div>
          <div className="flex flex-col items-center bg-amber-50 px-6 py-3 rounded-xl border border-amber-200 shadow-sm min-w-[120px]">
            <span className="text-sm font-bold text-amber-800 mb-1">כיסוי בונדד</span>
            <span className="text-2xl font-mono text-amber-700 font-bold">{row.bondedCoverQty}</span>
          </div>
          <div className="flex flex-col items-center bg-red-50 px-6 py-3 rounded-xl border border-red-200 shadow-sm min-w-[120px]">
            <span className="text-sm font-bold text-red-800 mb-1">נותר חסר</span>
            <span className="text-2xl font-mono text-red-600 font-bold">{row.finalMissingQty}</span>
          </div>
        </div>
      </div>

      {/* 3-column body */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
          {/* Right column (RTL): Impact */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Truck className="h-5 w-5 text-slate-500" />
              השפעה על הפצה
            </h3>
            {workLines.length > 0 ? (
              workLines.map((wl, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-300 transition-colors"
                >
                  <div className="font-bold text-sm mb-3 border-b border-slate-100 pb-2">{wl.name}</div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                      <span className="text-xs text-slate-600 font-medium">יח' בחוסר:</span>
                      <span className="font-mono text-base font-bold text-red-600">{wl.units}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                      <span className="text-xs text-slate-600 font-medium">הזמנות חסומות:</span>
                      <span className="font-mono text-base font-bold text-slate-800">{wl.blockedOrders}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-white border border-dashed border-slate-300 rounded-xl text-slate-400 font-medium text-sm">
                אין שורות מושפעות
              </div>
            )}
          </div>

          {/* Middle column: Bonded candidates */}
          <div className="lg:col-span-6 space-y-4 flex flex-col">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <PackageOpen className="h-5 w-5 text-blue-600" />
              מועמדי בונדד
            </h3>

            {candidates.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="p-2 text-right whitespace-nowrap">גוש</th>
                        <th className="p-2 text-right whitespace-nowrap">מקור</th>
                        <th className="p-2 text-center whitespace-nowrap">זמין</th>
                        <th className="p-2 text-center whitespace-nowrap">משוחרר</th>
                        <th className="p-2 text-center whitespace-nowrap">נמשך</th>
                        <th className="p-2 text-center whitespace-nowrap">יתרה</th>
                        <th className="p-2 text-center whitespace-nowrap">גורם אריזה</th>
                        <th className="p-2 text-center whitespace-nowrap">קרטונים במשטח</th>
                        <th className="p-2 text-center whitespace-nowrap">יחידות במשטח</th>
                        <th className="p-2 text-right whitespace-nowrap">הערות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((c, i) => (
                        <tr
                          key={i}
                          className={joinClassNames(
                            'border-b border-slate-100 last:border-b-0',
                            c.releasedBalanceQty < 0 && c.availableQty === 0
                              ? 'bg-red-50/40'
                              : ''
                          )}
                        >
                          <td className="p-2 font-mono font-medium text-slate-900 whitespace-nowrap">
                            {c.block || '—'}
                          </td>
                          <td className="p-2 text-slate-600 whitespace-nowrap">
                            {c.sourceLabel || '—'}
                          </td>
                          <td className={joinClassNames(
                            'p-2 text-center font-mono',
                            c.availableQty === 0 ? 'text-red-500' : 'text-slate-900'
                          )}>
                            {c.availableQty}
                          </td>
                          <td className="p-2 text-center font-mono text-slate-900">
                            {c.releasedQty}
                          </td>
                          <td className="p-2 text-center font-mono text-slate-900">
                            {c.totalPulledQty}
                          </td>
                          <td className="p-2 text-center">
                            <span className={joinClassNames(
                              'font-mono',
                              c.releasedBalanceQty < 0
                                ? 'text-red-600 font-bold'
                                : 'text-slate-900'
                            )}>
                              {c.releasedBalanceQty}
                            </span>
                            {c.releasedBalanceQty < 0 && c.availableQty === 0 && (
                              <span className="block text-[10px] text-red-700 font-bold mt-0.5">
                                יתרה שלילית
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center font-mono text-slate-600">
                            {c.packFactor ?? '—'}
                          </td>
                          <td className="p-2 text-center font-mono text-slate-600">
                            {c.cartonsPerPallet ?? '—'}
                          </td>
                          <td className="p-2 text-center font-mono text-slate-600">
                            {c.unitsPerPallet ?? '—'}
                          </td>
                          <td className="p-2 text-xs text-slate-500 max-w-[120px] truncate" title={c.notes ?? ''}>
                            {c.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-14 bg-white border-2 border-dashed border-slate-300 rounded-xl text-slate-400 flex flex-col items-center">
                <PackageOpen className="h-10 w-10 text-slate-300 mb-3" />
                <span className="text-sm font-medium">לא נמצאו מועמדי בונדד למק"ט זה</span>
              </div>
            )}

            {/* Data issues section */}
            {isDataIssue && row.dataIssues && row.dataIssues.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/30 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={16} className="text-red-600" />
                  <span className="text-sm font-semibold text-red-700">בעיות נתונים</span>
                </div>
                {row.dataIssues.map((issue, i) => (
                  <p key={i} className="text-sm text-red-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    {issue === 'unknown_sku'
                      ? 'מק"ט לא נמצא בקטלוג המוצרים'
                      : issue === 'duplicate_canonical_sku'
                        ? 'נמצאו כמה מוצרים בקטלוג לאותו מק"ט'
                        : issue === 'missing_warehouse_stock_snapshot_sku'
                          ? 'המק"ט לא נמצא ב-Snapshot מלאי המחסן'
                          : issue}
                  </p>
                ))}
                {row.bondedCoverQty > 0 && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">
                    <Info size={14} className="inline ml-1" />
                    קיימת בעיית נתונים אך נמצא כיסוי בונדד.
                  </p>
                )}
              </div>
            )}

            {row.notes && !(isDataIssue && row.dataIssues && row.dataIssues.length > 0) && (
              <div className="mt-2 text-xs text-amber-700 font-bold bg-amber-50 inline-block px-2 py-1 rounded">
                <Info className="inline h-3 w-3 ml-1" />
                {row.notes}
              </div>
            )}
          </div>

          {/* Left column (RTL): Active pulls tracking */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              מעקב משיכות משטח
            </h3>
            <div className="text-center py-12 bg-white border border-dashed border-slate-300 rounded-xl text-slate-400 font-medium">
              <p className="text-sm">אין משיכות פעילות</p>
              <p className="text-xs mt-1 text-slate-300">משיכות יופיעו כאן לאחר הוספה</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 px-6">
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          בטל וסגור
        </button>
        <button
          disabled
          className="px-6 py-2.5 bg-slate-300 cursor-not-allowed rounded-lg text-sm font-bold text-white opacity-60"
        >
          סגור אירוע חוסר (ידני)
        </button>
      </div>
    </div>
  );
}

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}