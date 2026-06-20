import { X, Truck, PackageOpen, AlertTriangle, Info } from 'lucide-react';
import { CoverageStatusBadge } from './coverage-status-badge';
import type { ProductControlRow } from './product-control-types';

type DetailPanelProps = {
  row: ProductControlRow;
  onClose: () => void;
};

export function ProductControlDetailPanel({ row, onClose }: DetailPanelProps) {
  const candidates = row.bondedAvailableQty > 0;
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

          {/* Middle column: Bonded blocks */}
          <div className="lg:col-span-6 space-y-4 flex flex-col">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <PackageOpen className="h-5 w-5 text-blue-600" />
              פעולות משיכה מבונדד
            </h3>
            {candidates ? (
              <div className="border-2 rounded-xl p-5 shadow-sm border-blue-200 bg-white">
                <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-lg text-slate-900">
                        גוש: {row.bondedCandidateBlock || '—'}
                      </h4>
                      <span className="px-3 py-1 text-xs rounded-full font-bold bg-blue-100 text-blue-800">
                        {row.bondedCandidateSource || 'בונדד'}
                      </span>
                    </div>
                    {row.notes && (
                      <div className="mt-2 text-xs text-amber-700 font-bold bg-amber-50 inline-block px-2 py-1 rounded">
                        <Info className="inline h-3 w-3 ml-1" />
                        {row.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500 font-medium">זמין למשיכה</div>
                    <div className="text-2xl font-mono font-bold text-green-600">
                      {row.bondedCandidateAvailableBalance ?? row.bondedAvailableQty}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="bg-slate-50 p-2 rounded text-center border border-slate-100">
                    <div className="text-[10px] text-slate-500 mb-1">כמות במשטח</div>
                    <div className="font-mono font-bold text-slate-800 text-base">
                      {row.bondedCandidateUnitsPerPallet ?? '—'}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded text-center border border-slate-100">
                    <div className="text-[10px] text-slate-500 mb-1">קרטונים/משטח</div>
                    <div className="font-mono font-bold text-slate-800 text-base">
                      {row.bondedCandidateCartonsPerPallet ?? '—'}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded text-center border border-slate-100">
                    <div className="text-[10px] text-slate-500 mb-1">שנמשך עכשיו</div>
                    <div className="font-mono font-bold text-blue-600 text-base">
                      {row.bondedCandidateAlreadyPulled ?? 0}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded text-center border border-slate-100">
                    <div className="text-[10px] text-slate-500 mb-1">גורם אירוז</div>
                    <div className="font-mono font-bold text-slate-800 text-base">
                      {row.bondedCandidatePackFactor ?? '—'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 items-end bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-blue-900 mb-2">כמות למשיכה לדו"ח</label>
                    <div className="w-full border border-blue-300 rounded-lg px-4 py-2.5 font-mono text-sm font-bold shadow-sm bg-white text-gray-300 opacity-60 cursor-not-allowed">
                      שדה משיכה (דמו)
                    </div>
                  </div>
                  <button
                    disabled
                    className="bg-blue-400 cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md shrink-0 opacity-60"
                  >
                    הוסף משיכה
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-14 bg-white border-2 border-dashed border-slate-300 rounded-xl text-slate-400 flex flex-col items-center">
                <PackageOpen className="h-10 w-10 text-slate-300 mb-3" />
                <span className="text-sm font-medium">לא נמצא בונדד משוחרר זמין לפריט זה</span>
              </div>
            )}

            {row.bondedCandidateLabel && !row.bondedCandidateBlock && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-sm text-slate-600">{row.bondedCandidateLabel}</p>
              </div>
            )}

            {isDataIssue && (
              <div className="rounded-lg border border-red-200 bg-red-50/30 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={16} className="text-red-600" />
                  <span className="text-sm font-semibold text-red-700">אזהרת נתונים</span>
                </div>
                <p className="text-sm text-red-600">שורת נתונים זו מכילה ערכים חריגים וייתכן שאינה תקינה.</p>
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
