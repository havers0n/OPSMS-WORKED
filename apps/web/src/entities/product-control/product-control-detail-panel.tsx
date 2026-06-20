import { X, AlertTriangle, Package, TrendingDown, Warehouse } from 'lucide-react';
import { Panel } from '@/shared/ui/panel';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { CoverageStatusBadge } from './coverage-status-badge';
import type { ProductControlRow } from './product-control-types';

function InfoRow({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${className ?? ''}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900 text-left" dir="ltr">{value}</span>
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: { label: string; value: string | number; highlight?: boolean }[];
  tone: 'green' | 'amber' | 'red' | 'blue';
}) {
  const toneBorder = {
    green: 'border-emerald-200 bg-emerald-50/30',
    amber: 'border-amber-200 bg-amber-50/30',
    red: 'border-red-200 bg-red-50/30',
    blue: 'border-blue-200 bg-blue-50/30',
  };
  const toneIcon = {
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };

  return (
    <div className={`rounded-lg border p-3 ${toneBorder[tone]}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`size-4 ${toneIcon[tone]}`}>{icon}</span>
        <span className="text-xs font-semibold text-gray-700">{title}</span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-gray-500">{item.label}</span>
            <span className={`text-xs font-medium text-left ${item.highlight ? 'text-gray-900' : 'text-gray-700'}`} dir="ltr">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type DetailPanelProps = {
  row: ProductControlRow;
  onClose: () => void;
};

export function ProductControlDetailPanel({ row, onClose }: DetailPanelProps) {
  const hasAffectedLines = (row.affectedLinesCount ?? 0) > 0;
  const hasBondedCandidate = (row.bondedAvailableQty ?? 0) > 0;
  const isDataIssue = row.status === 'data_issue';

  return (
    <aside className="flex w-80 shrink-0 flex-col border-slate-200 bg-white rounded-xl border shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-semibold text-gray-900">{row.sku}</span>
          <CoverageStatusBadge status={row.status} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="סגור פרטי מוצר"
        >
          <X size={16} />
        </button>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="flex flex-col gap-3">
          <section>
            <h4 className="mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">פרטי מוצר</h4>
            <div className="flex flex-col gap-1.5">
              <InfoRow label={'מק"ט'} value={row.sku} />
              <InfoRow label="תיאור" value={row.description} />
              <InfoRow label="קטגוריה" value={row.category} />
            </div>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h4 className="mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">כמויות</h4>
            <div className="flex flex-col gap-1.5">
              <InfoRow label="דרישה" value={row.demandQty} />
              <InfoRow label="מלאי" value={row.warehouseQty} />
              <InfoRow label="חוסר" value={row.shortageQty} className={row.shortageQty > 0 ? 'text-red-600' : ''} />
              <InfoRow label="זמין בבונדד" value={row.bondedAvailableQty} />
              <InfoRow label="כיסוי מבונדד" value={row.bondedCoverQty} />
              <InfoRow
                label="חוסר סופי"
                value={row.finalMissingQty}
                className={row.finalMissingQty > 0 ? 'text-red-700 font-medium' : ''}
              />
              {row.surplusQty > 0 && <InfoRow label="עודף" value={row.surplusQty} />}
            </div>
          </section>

          <hr className="border-slate-200" />

          <div className="flex flex-col gap-2">
            <SummaryCard
              icon={<Warehouse size={16} />}
              title="כיסוי מבונדד"
              tone={hasBondedCandidate ? 'green' : 'amber'}
              items={[
                { label: 'זמין לבונדד', value: row.bondedAvailableQty, highlight: true },
                { label: 'מכסה מבונדד', value: row.bondedCoverQty, highlight: true },
                { label: 'סטטוס', value: row.status === 'covered_by_bonded' ? 'מכוסה מלא' : row.status === 'partial_bonded' ? 'חלקי' : 'ללא כיסוי' },
              ]}
            />

            <SummaryCard
              icon={<TrendingDown size={16} />}
              title="השפעת חוסר"
              tone={row.finalMissingQty > 0 ? 'red' : 'green'}
              items={[
                { label: 'חוסר סופי', value: row.finalMissingQty, highlight: true },
                ...(hasAffectedLines ? [{ label: 'קווי עבודה מושפעים', value: row.affectedLinesCount ?? 0 }] : []),
                ...((row.affectedOrdersCount ?? 0) > 0 ? [{ label: 'הזמנות מושפעות', value: row.affectedOrdersCount ?? 0 }] : []),
              ]}
            />

            {row.bondedCandidateLabel && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Package size={14} className="text-blue-600" />
                  <span className="text-xs font-semibold text-gray-700">מועמד מבונדד</span>
                </div>
                <p className="text-xs text-gray-600">{row.bondedCandidateLabel}</p>
              </div>
            )}
          </div>

          {isDataIssue && (
            <>
              <hr className="border-slate-200" />
              <div className="rounded-lg border border-red-200 bg-red-50/30 p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-red-600" />
                  <span className="text-xs font-semibold text-red-700">אזהרת נתונים</span>
                </div>
                <p className="text-xs text-red-600">שורת נתונים זו מכילה ערכים חריגים וייתכן שאינה תקינה.</p>
              </div>
            </>
          )}

          {row.notes && (
            <>
              <hr className="border-slate-200" />
              <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-3">
                <span className="mb-1 block text-xs font-semibold text-gray-700">הערות (דמו)</span>
                <p className="text-xs text-gray-600">{row.notes}</p>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
