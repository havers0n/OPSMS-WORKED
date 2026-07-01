import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { demandExplorerQueryOptions } from '@/entities/demand/api/queries';
import { DemandExplorerOrderCard } from './demand-explorer-order-card';
import type { DemandExplorerOrderStatus } from '@wos/domain';

const STATUS_FILTERS: Array<{ value: DemandExplorerOrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'הכל' },
  { value: 'unassigned', label: 'לא שויך' },
  { value: 'partial', label: 'שויך חלקית' },
  { value: 'assigned', label: 'שויך' },
  { value: 'over_allocated', label: 'חריגה' },
];

export function DemandExplorerView({
  draftId,
  distributionArea,
}: {
  draftId: string;
  distributionArea: string | null | undefined;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DemandExplorerOrderStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [distributionArea, statusFilter, debouncedSearch]);

  const filters = useMemo(() => ({
    distributionArea: distributionArea ?? undefined,
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit: 20,
  }), [distributionArea, debouncedSearch, statusFilter, page]);

  const { data, isLoading, isError, refetch } = useQuery({
    ...demandExplorerQueryOptions(draftId, filters),
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const summary = data?.summary;

  const handlePrevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (pagination && page < pagination.totalPages) {
      setPage((p) => p + 1);
    }
  }, [page, pagination]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" dir="rtl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-red-600" dir="rtl">
        <AlertCircle size={24} className="mb-2" />
        <p className="text-sm font-medium mb-2">שגיאה בטעינת נתוני הביקוש</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs px-3 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
        >
          נסה שנית
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4" dir="rtl">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-gray-800">הזמנות זמינות באזור</h2>
        {summary && (
          <p className="text-[11px] text-gray-500 mt-0.5">
            {summary.totalOrders} הזמנות | {summary.totalSkuCount} SKU | סה"כ {summary.totalQuantity} כמות | שויך {summary.totalAssignedQuantity} | נותר {summary.totalRemainingQuantity}
          </p>
        )}
      </div>

      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש הזמנה / לקוח / מק״ט"
            className="w-full pr-7 pl-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white placeholder-gray-400"
            dir="rtl"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`text-[11px] rounded-full px-2.5 py-1 font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mb-3 text-xs text-gray-600">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={page <= 1}
            className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
            הקודם
          </button>
          <span>עמ&apos; {page} מתוך {pagination.totalPages}</span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={!pagination || page >= pagination.totalPages}
            className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            הבא
            <ChevronLeft size={14} />
          </button>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <p className="text-sm font-medium">
            {debouncedSearch || statusFilter !== 'all'
              ? 'לא נמצאו תוצאות לחיפוש'
              : 'לא נמצאו הזמנות זמינות באזור זה'}
          </p>
          {(debouncedSearch || statusFilter !== 'all') && (
            <p className="text-xs mt-1">נסה לחפש מונח אחר או לשנות את המסנן</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <DemandExplorerOrderCard
              key={order.orderId}
              order={order}
              draftId={draftId}
            />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={page <= 1}
            className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
            הקודם
          </button>
          <span>עמ&apos; {page} מתוך {pagination.totalPages}</span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={!pagination || page >= pagination.totalPages}
            className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            הבא
            <ChevronLeft size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
