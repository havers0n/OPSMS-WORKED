import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { DemandBacklogOrderQuery, DemandBacklogOrderStatus } from '@wos/domain';
import { demandBacklogOrdersQueryOptions } from '@/entities/demand/api/queries';

const statuses: Array<{ value: DemandBacklogOrderStatus; label: string }> = [
  { value: 'available', label: 'זמין' }, { value: 'partially_published', label: 'פורסם חלקית' },
  { value: 'fully_published', label: 'פורסם במלואו' }, { value: 'review_needed', label: 'נדרשת בדיקה' },
  { value: 'excluded', label: 'לא נכלל' }, { value: 'over_published', label: 'פורסם ביתר' }
];
const statusClasses: Record<DemandBacklogOrderStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800', partially_published: 'bg-amber-100 text-amber-800',
  fully_published: 'bg-blue-100 text-blue-800', review_needed: 'bg-orange-100 text-orange-800',
  excluded: 'bg-gray-200 text-gray-700', over_published: 'bg-red-100 text-red-800'
};
const textFilters = [
  ['q', 'חיפוש חופשי'], ['sku', 'מק״ט'], ['customer', 'לקוח'], ['distributionArea', 'אזור חלוקה'],
  ['distributionLine', 'קו חלוקה'], ['sourceBatchId', 'מזהה אצווה']
] as const;

export function DemandBacklogStatusBadge({ status }: { status: DemandBacklogOrderStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${statusClasses[status]}`}>{statuses.find(item => item.value === status)?.label}</span>;
}

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function DemandBacklogPanel() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status');
  const page = positiveInt(params.get('page'), 1);
  const limit = Math.min(positiveInt(params.get('limit'), 50), 200);
  const filters: DemandBacklogOrderQuery = {
    dateFrom: params.get('dateFrom') || undefined, dateTo: params.get('dateTo') || undefined,
    status: statuses.some(item => item.value === status) ? status as DemandBacklogOrderStatus : undefined,
    q: params.get('q') || undefined, sku: params.get('sku') || undefined,
    customer: params.get('customer') || undefined, distributionArea: params.get('distributionArea') || undefined,
    distributionLine: params.get('distributionLine') || undefined, sourceBatchId: params.get('sourceBatchId') || undefined,
    page, limit
  };
  const query = useQuery(demandBacklogOrdersQueryOptions(filters));
  const update = (name: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    if (resetPage) next.set('page', '1');
    setParams(next);
  };

  return <section className="min-w-0 flex-1 overflow-auto bg-gray-50 p-3 sm:p-6" dir="rtl" data-testid="demand-backlog-panel">
    <div className="mx-auto max-w-[1600px] space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">מאגר ביקוש</h1><p className="text-sm text-gray-600">תצוגה גלובלית לקריאה בלבד של הזמנות הביקוש</p></div>
        <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} />רענון</button>
      </header>
      <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">מתאריך<input aria-label="מתאריך" type="date" value={filters.dateFrom ?? ''} onChange={event => update('dateFrom', event.target.value)} className="mt-1 w-full rounded-md border px-2 py-2" /></label>
        <label className="text-sm">עד תאריך<input aria-label="עד תאריך" type="date" value={filters.dateTo ?? ''} onChange={event => update('dateTo', event.target.value)} className="mt-1 w-full rounded-md border px-2 py-2" /></label>
        <label className="text-sm">סטטוס<select aria-label="סטטוס" value={filters.status ?? ''} onChange={event => update('status', event.target.value)} className="mt-1 w-full rounded-md border px-2 py-2"><option value="">הכול</option>{statuses.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        {textFilters.map(([name, label]) => <label key={name} className="text-sm">{label}<input aria-label={label} value={filters[name] ?? ''} onChange={event => update(name, event.target.value)} className="mt-1 w-full rounded-md border px-2 py-2" /></label>)}
        <label className="text-sm">שורות בעמוד<select aria-label="שורות בעמוד" value={limit} onChange={event => update('limit', event.target.value)} className="mt-1 w-full rounded-md border px-2 py-2">{[25, 50, 100, 200].map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      {query.isLoading && <div className="rounded-xl border bg-white p-12 text-center text-gray-600" role="status">טוען הזמנות ביקוש…</div>}
      {query.isError && <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800" role="alert">לא ניתן לטעון את מאגר הביקוש. נסו לרענן.</div>}
      {query.data && query.data.items.length === 0 && <div className="rounded-xl border bg-white p-12 text-center text-gray-600">לא נמצאו הזמנות התואמות למסננים.</div>}
      {query.data && query.data.items.length > 0 && <>
        <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-[1500px] w-full text-sm text-right">
          <thead className="bg-gray-100 text-gray-700"><tr>{['SO / מספר הזמנה','לקוח','תאריך אספקה','אזור חלוקה','קו חלוקה','שורות','מק״טים','כמות כוללת','פורסם','זמין','סטטוס','אצווה אחרונה','נראה לאחרונה'].map(value => <th key={value} className="whitespace-nowrap px-3 py-3">{value}</th>)}</tr></thead>
          <tbody className="divide-y">{query.data.items.map((item, index) => <tr key={`${item.orderNumber ?? 'order'}-${index}`}>
            <td className="px-3 py-3 font-medium" dir="ltr">{item.orderNumber ?? '—'}</td><td className="px-3 py-3">{item.customerName ?? '—'}</td><td className="px-3 py-3">{item.plannedDeliveryDate ?? '—'}</td><td className="px-3 py-3">{item.distributionArea ?? '—'}</td><td className="px-3 py-3">{item.distributionLine ?? '—'}</td><td className="px-3 py-3">{item.rowCount}</td><td className="px-3 py-3">{item.skuCount}</td><td className="px-3 py-3">{item.totalQuantity}</td><td className="px-3 py-3">{item.publishedQuantity}</td><td className="px-3 py-3 font-semibold">{item.availableQuantity}</td><td className="px-3 py-3"><DemandBacklogStatusBadge status={item.status} /></td><td className="px-3 py-3">{item.latestBatchName}</td><td className="whitespace-nowrap px-3 py-3">{new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.lastSeenAt))}</td>
          </tr>)}</tbody>
        </table></div>
        <nav aria-label="דפדוף במאגר הביקוש" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 text-sm">
          <span>עמוד {query.data.pagination.page} מתוך {Math.max(query.data.pagination.totalPages, 1)} · {query.data.pagination.total} הזמנות</span>
          <div className="flex gap-2"><button aria-label="העמוד הקודם" disabled={page <= 1} onClick={() => update('page', String(page - 1), false)} className="rounded-md border p-2 disabled:opacity-40"><ChevronRight size={18} /></button><button aria-label="העמוד הבא" disabled={page >= query.data.pagination.totalPages} onClick={() => update('page', String(page + 1), false)} className="rounded-md border p-2 disabled:opacity-40"><ChevronLeft size={18} /></button></div>
        </nav>
      </>}
    </div>
  </section>;
}
