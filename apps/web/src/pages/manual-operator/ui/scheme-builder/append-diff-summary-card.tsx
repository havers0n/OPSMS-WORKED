import type { DemandImportAppendClassification } from '@wos/domain';

const CARD_STYLES: Record<
  DemandImportAppendClassification,
  { bg: string; text: string; border: string; label: string }
> = {
  new: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', label: 'חדש' },
  already_exists: { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200', label: 'כבר קיים' },
  quantity_changed: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', label: 'כמות השתנתה' },
  duplicate: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', label: 'כפול' },
  special_flow: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', label: 'Special Flow' },
  requires_review: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', label: 'דורש בדיקה' }
};

interface AppendDiffSummaryCardProps {
  classification: DemandImportAppendClassification;
  count: number;
  onClick?: () => void;
}

export function AppendDiffSummaryCard({ classification, count, onClick }: AppendDiffSummaryCardProps) {
  const style = CARD_STYLES[classification];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-center transition-colors hover:opacity-80 ${style.bg} ${style.border}`}
    >
      <div className={`text-2xl font-bold ${style.text}`}>{count}</div>
      <div className={`text-xs font-medium ${style.text}`}>{style.label}</div>
    </button>
  );
}
