import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DemandImportAppendDiffOrder, DemandImportAppendClassification } from '@wos/domain';
import { AppendOrderCard } from './append-order-card';

const SECTION_CONFIG: Record<
  DemandImportAppendClassification,
  { label: string; bg: string; border: string; text: string }
> = {
  new: { label: 'תוספות חדשות', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  already_exists: { label: 'כבר קיים', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800' },
  quantity_changed: { label: 'כמות השתנתה', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  duplicate: { label: 'כפול', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  special_flow: { label: 'Special Flow', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
  requires_review: { label: 'דורש בדיקה', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' }
};

interface AppendBacklogSectionProps {
  title: string;
  classification: DemandImportAppendClassification;
  orders: DemandImportAppendDiffOrder[];
  defaultExpanded?: boolean;
}

export function AppendBacklogSection({
  title,
  classification,
  orders,
  defaultExpanded = false
}: AppendBacklogSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const config = SECTION_CONFIG[classification];

  if (orders.length === 0) return null;

  const totalRows = orders.reduce((sum, o) => sum + o.rows.length, 0);

  return (
    <div className={`rounded-xl border overflow-hidden ${config.border}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full p-3 flex items-center justify-between text-right text-sm font-medium ${config.bg} ${config.text}`}
      >
        <span>
          {title} ({orders.length} הזמנות, {totalRows} שורות)
        </span>
        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>

      {expanded && (
        <div className="p-2 space-y-2 bg-white">
          {orders.map((order) => (
            <AppendOrderCard key={order.orderKey} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
