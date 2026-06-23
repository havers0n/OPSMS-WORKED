import { useState } from 'react';
import { X, PackageOpen, AlertTriangle, Info } from 'lucide-react';
import { CoverageStatusBadge } from './coverage-status-badge';
import { BondedRequestCreateCard } from '@/entities/bonded-requests/components/bonded-request-create-card';
import type { ProductControlRow } from './product-control-types';

type DetailPanelProps = {
  row: ProductControlRow;
  onClose: () => void;
  shiftId: string;
  planningDate: string;
  bondedSnapshotId?: string | null;
  warehouseStockSnapshotId?: string | null;
};

type DetailTab = 'candidates' | 'impact' | 'tracking';

const TAB_LABELS: Record<DetailTab, string> = {
  candidates: 'מועמדי בונדד',
  impact: 'השפעה על הפצה',
  tracking: 'מעקב משיכות משטח',
};

function MetricChip({ label, value, critical }: { label: string; value: number; critical?: boolean }) {
  const isZero = value === 0;
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border min-w-[72px] ${
      critical && !isZero
        ? 'bg-red-50 border-red-200'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <span className={`font-mono text-sm font-bold leading-tight tabular-nums ${
        critical && !isZero ? 'text-red-600' : isZero ? 'text-gray-400' : 'text-gray-900'
      }`}>
        {value}
      </span>
      <span className="text-[11px] text-gray-500 whitespace-nowrap mt-0.5">{label}</span>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

export function ProductControlDetailPanel({
  row,
  onClose,
  shiftId,
  planningDate,
  bondedSnapshotId,
  warehouseStockSnapshotId,
}: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('candidates');
  const candidates = row.bondedCandidates ?? [];
  const workLines = row.workLines ?? [];
  const isDataIssue = row.status === 'data_issue';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Sticky compact header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <span className="bg-blue-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0">
              פריט נבחר
            </span>
            <h2 className="text-sm font-bold text-slate-900 truncate">{row.description}</h2>
            <span className="text-xs text-slate-400 shrink-0 hidden sm:inline">
              מק"ט <span className="font-mono text-slate-700">{row.sku}</span>
            </span>
            <span className="text-xs text-slate-400 shrink-0 hidden lg:inline">
              <span className="font-mono text-slate-700">{row.category}</span>
            </span>
            <span className="shrink-0">
              <CoverageStatusBadge status={row.status} />
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="detail-panel-close"
            className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>

        {/* Compact metric strip */}
        <div className="flex gap-2 px-4 pb-2.5 flex-wrap">
          <MetricChip label="במחסן" value={row.warehouseQty} />
          <MetricChip label="חסר היום" value={row.shortageQty} critical={row.shortageQty > 0} />
          <MetricChip label="בונדד" value={row.bondedAvailableQty} />
          <MetricChip label="כיסוי" value={row.bondedCoverQty} />
          <MetricChip label="נותר חסר" value={row.finalMissingQty} critical={row.finalMissingQty > 0} />
        </div>
      </div>

      {/* Scrollable body — RTL two columns */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4" dir="rtl">
          {/* Right column (RTL): Bonded request form — order-1 = first in RTL = right */}
          <div className="lg:col-span-4 lg:order-1 space-y-4">
            {row.bondedCoverQty > 0 &&
              (row.status === 'covered_by_bonded' || row.status === 'partial_bonded') && (
                <BondedRequestCreateCard
                  shiftId={shiftId}
                  row={row}
                  planningDate={planningDate}
                  bondedSnapshotId={bondedSnapshotId}
                  warehouseStockSnapshotId={warehouseStockSnapshotId}
                />
              )}

            {/* Data issues section when not showing bonded candidates */}
            {isDataIssue && row.dataIssues && row.dataIssues.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/30 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-600 shrink-0" />
                  <span className="text-xs font-semibold text-red-700">בעיות נתונים</span>
                </div>
                {row.dataIssues.map((issue, i) => (
                  <p key={i} className="text-xs text-red-600 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
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
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                    <Info size={12} className="inline ml-1" />
                    קיימת בעיית נתונים אך נמצא כיסוי בונדד.
                  </p>
                )}
              </div>
            )}

            {row.notes && !(isDataIssue && row.dataIssues && row.dataIssues.length > 0) && (
              <div className="text-xs text-amber-700 font-bold bg-amber-50 inline-block px-2 py-1 rounded">
                <Info className="inline h-3 w-3 ml-1" />
                {row.notes}
              </div>
            )}
          </div>

          {/* Left column (RTL): tabs — order-2 = second in RTL = left */}
          <div className="lg:col-span-8 lg:order-2 space-y-3">
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-gray-200 pb-2">
              {(Object.keys(TAB_LABELS) as DetailTab[]).map((tab) => (
                <TabButton
                  key={tab}
                  active={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  label={TAB_LABELS[tab]}
                />
              ))}
            </div>

            {/* Tab: Bonded candidates */}
            {activeTab === 'candidates' && (
              <div>
                {candidates.length > 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
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
                            className={[
                              'border-b border-slate-100 last:border-b-0',
                              c.releasedBalanceQty < 0 && c.availableQty === 0 ? 'bg-red-50/40' : '',
                            ].filter(Boolean).join(' ')}
                          >
                            <td className="p-2 font-mono font-medium text-slate-900 whitespace-nowrap">{c.block || '—'}</td>
                            <td className="p-2 text-slate-600 whitespace-nowrap">{c.sourceLabel || '—'}</td>
                            <td className={[
                              'p-2 text-center font-mono',
                              c.availableQty === 0 ? 'text-red-500' : 'text-slate-900',
                            ].filter(Boolean).join(' ')}>
                              {c.availableQty}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-900">{c.releasedQty}</td>
                            <td className="p-2 text-center font-mono text-slate-900">{c.totalPulledQty}</td>
                            <td className="p-2 text-center">
                              <span className={[
                                'font-mono',
                                c.releasedBalanceQty < 0 ? 'text-red-600 font-bold' : 'text-slate-900',
                              ].filter(Boolean).join(' ')}>
                                {c.releasedBalanceQty}
                              </span>
                              {c.releasedBalanceQty < 0 && c.availableQty === 0 && (
                                <span className="block text-[10px] text-red-700 font-bold mt-0.5">יתרה שלילית</span>
                              )}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-600">{c.packFactor ?? '—'}</td>
                            <td className="p-2 text-center font-mono text-slate-600">{c.cartonsPerPallet ?? '—'}</td>
                            <td className="p-2 text-center font-mono text-slate-600">{c.unitsPerPallet ?? '—'}</td>
                            <td className="p-2 text-xs text-slate-500 max-w-[120px] truncate" title={c.notes ?? ''}>
                              {c.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-white border-2 border-dashed border-slate-300 rounded-xl text-slate-400 flex flex-col items-center">
                    <PackageOpen className="h-8 w-8 text-slate-300 mb-2" />
                    <span className="text-sm font-medium">לא נמצאו מועמדי בונדד למק"ט זה</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Distribution impact */}
            {activeTab === 'impact' && (
              <div className="space-y-3">
                {workLines.length > 0 ? (
                  workLines.map((wl, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-blue-300 transition-colors"
                    >
                      <div className="font-bold text-sm mb-2 border-b border-slate-100 pb-1.5">{wl.name}</div>
                      <div className="flex gap-4">
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded flex-1">
                          <span className="text-xs text-slate-600 font-medium">יח' בחוסר:</span>
                          <span className="font-mono text-sm font-bold text-red-600">{wl.units}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded flex-1">
                          <span className="text-xs text-slate-600 font-medium">הזמנות חסומות:</span>
                          <span className="font-mono text-sm font-bold text-slate-800">{wl.blockedOrders}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-white border border-dashed border-slate-300 rounded-xl text-slate-400 font-medium text-sm">
                    אין שורות מושפעות
                  </div>
                )}
              </div>
            )}

            {/* Tab: Pallet pull tracking */}
            {activeTab === 'tracking' && (
              <div className="text-center py-10 bg-white border border-dashed border-slate-300 rounded-xl text-slate-400 font-medium">
                <p className="text-sm">אין משיכות פעילות</p>
                <p className="text-xs mt-1 text-slate-300">משיכות יופיעו כאן לאחר הוספה</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
