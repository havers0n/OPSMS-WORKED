import { useState } from 'react';
import { Package, Loader2, AlertCircle, Info, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@/shared/ui/empty-state';
import { productControlQueryOptions } from '@/entities/manual-shift/api/queries';
import { ShortageTable } from '@/entities/product-control/shortage-table';
import { ProductControlDetailPanel } from '@/entities/product-control/product-control-detail-panel';
import { BondedRequestsList } from '@/entities/bonded-requests/components/bonded-requests-list';
import type { ProductControlRow } from '@/entities/product-control/product-control-types';

type ProductControlTabProps = {
  shiftId: string;
  planningDate?: string;
};

type SubTab = 'shortage' | 'requests';

const SNAPSHOT_BANNER_KEY_PREFIX = 'wos:pc:banner:';

function buildKey(...parts: string[]): string {
  return `${SNAPSHOT_BANNER_KEY_PREFIX}${parts.join(':')}`;
}

function isDismissedInStorage(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function dismissInStorage(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* storage unavailable */
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function ProductControlTab({ shiftId, planningDate: planningDateProp }: ProductControlTabProps) {
  const { data, isLoading, error } = useQuery(productControlQueryOptions(shiftId));
  const [selectedRow, setSelectedRow] = useState<ProductControlRow | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('shortage');
  const [dismissedLocal, setDismissedLocal] = useState<Set<string>>(() => new Set());

  const planningDate = planningDateProp ?? data?.bondedSnapshot?.planningDate ?? data?.warehouseStockSnapshot?.planningDate ?? '';
  const bondedSnapshotId = data?.bondedSnapshot?.id;
  const warehouseStockSnapshotId = data?.warehouseStockSnapshot?.id;

  const handleSelectRow = (row: ProductControlRow) => {
    setSelectedRow((prev) => (prev?.sku === row.sku ? null : row));
  };

  const handleCloseDetail = () => setSelectedRow(null);

  // ---- snapshot banner keys ----

  const warehouseActiveKey = data?.warehouseStockSnapshot
    ? buildKey('warehouse', data.warehouseStockSnapshot.fileName ?? '', data.warehouseStockSnapshot.importedAt, String(data.warehouseStockSnapshot.sourceRowCount))
    : null;

  const bondedActiveKey = data?.bondedSnapshot
    ? buildKey('bonded', data.bondedSnapshot.fileName ?? '', data.bondedSnapshot.importedAt, String(data.bondedSnapshot.rowCount))
    : null;

  const warehouseWarningKey = buildKey('warehouse', 'missing', planningDate || 'nodate');
  const bondedWarningKey = buildKey('bonded', 'missing', planningDate || 'nodate');

  function isBannerVisible(key: string | null): boolean {
    if (!key) return false;
    if (dismissedLocal.has(key)) return false;
    return !isDismissedInStorage(key);
  }

  function handleDismiss(key: string) {
    setDismissedLocal((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    dismissInStorage(key);
  }

  // ---- render ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">טוען נתוני בקרת מוצרים...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20" dir="rtl">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <AlertCircle size={32} className="text-red-400" />
          <span className="text-sm font-medium text-red-600">שגיאה בטעינת נתוני בקרת מוצרים</span>
          <span className="text-xs text-gray-500">אנא נסה שוב מאוחר יותר</span>
        </div>
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  if (rows.length === 0) {
    return (
      <EmptyState
        title="אין נתוני מוצרים"
        description="לא נמצאו נתוני בקרת מוצרים להצגה"
        icon={<Package size={24} className="text-gray-400" />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full" dir="rtl">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 pb-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSubTab('shortage')}
          className={`px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
            activeSubTab === 'shortage'
              ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          חוסרים + כיסוי בונדד
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('requests')}
          className={`px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
            activeSubTab === 'requests'
              ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          בקשות כיסוי
        </button>
      </div>

      {activeSubTab === 'shortage' && (
        <>
          {/* Header with inline KPI cards */}
          <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">חוסרים להיום + כיסוי בונדד</h1>
              <p className="text-sm text-gray-500 mt-1">סקירת מלאי זמין מול דרישות הזמנה יומיות</p>
            </div>
            <div className="flex gap-3">
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
                <span className="text-xs text-gray-400">סה״כ מק״טים</span>
                <span className="text-xl font-bold">{totals?.totalSkus ?? 0}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
                <span className="text-xs text-gray-400 text-red-500">בחוסר</span>
                <span className="text-xl font-bold text-red-600">{totals?.shortageSkus ?? 0}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
                <span className="text-xs text-gray-400 text-green-500">ניתן לכיסוי בבונדד</span>
                <span className="text-xl font-bold text-green-600">{totals?.coveredByBondedSkus ?? 0}</span>
              </div>
              {(totals?.dataIssueSkus ?? 0) > 0 && (
                <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-sm flex flex-col items-center min-w-[100px]">
                  <span className="text-xs text-amber-500">בעיות נתונים</span>
                  <span className="text-xl font-bold text-amber-600">{totals?.dataIssueSkus ?? 0}</span>
                </div>
              )}
            </div>
          </div>

          {/* Warehouse stock snapshot banner */}
          {warehouseActiveKey && isBannerVisible(warehouseActiveKey) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
              <Info size={16} className="text-green-600 shrink-0" />
              <div className="text-sm text-green-800 flex-1">
                <span className="font-bold">Snapshot מלאי מחסן פעיל לתאריך זה</span>
                <span className="mx-2 text-green-400">|</span>
                <span>
                  קובץ: {data!.warehouseStockSnapshot!.fileName ?? '—'}
                  <span className="mx-1.5 text-green-400">·</span>
                  מק״טים: {data!.warehouseStockSnapshot!.uniqueSkuCount}
                  <span className="mx-1.5 text-green-400">·</span>
                  שורות מקור: {data!.warehouseStockSnapshot!.sourceRowCount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(warehouseActiveKey)}
                data-testid="dismiss-warehouse-snapshot"
                className="shrink-0 text-green-500 hover:text-green-700 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {!data?.warehouseStockSnapshot && data?.warnings?.includes('no_warehouse_stock_snapshot_for_planning_date') && warehouseWarningKey && isBannerVisible(warehouseWarningKey) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span className="text-sm text-amber-800 flex-1">
                לא נמצא Snapshot מלאי מחסן לתאריך העבודה הנבחר. המערכת משתמשת במקור המלאי הישן.
              </span>
              <button
                type="button"
                onClick={() => handleDismiss(warehouseWarningKey)}
                data-testid="dismiss-warehouse-warning"
                className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Bonded snapshot banner */}
          {bondedActiveKey && isBannerVisible(bondedActiveKey) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
              <Info size={16} className="text-green-600 shrink-0" />
              <div className="text-sm text-green-800 flex-1">
                <span className="font-bold">Snapshot בונדד פעיל לתאריך זה</span>
                <span className="mx-2 text-green-400">|</span>
                <span>
                  קובץ: {data!.bondedSnapshot!.fileName ?? '—'}
                  <span className="mx-1.5 text-green-400">·</span>
                  שורות: {data!.bondedSnapshot!.rowCount}
                  <span className="mx-1.5 text-green-400">·</span>
                  הועלה: {formatDateTime(data!.bondedSnapshot!.importedAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(bondedActiveKey)}
                data-testid="dismiss-bonded-snapshot"
                className="shrink-0 text-green-500 hover:text-green-700 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {!data?.bondedSnapshot && data?.warnings?.includes('no_bonded_snapshot_for_planning_date') && bondedWarningKey && isBannerVisible(bondedWarningKey) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span className="text-sm text-amber-800 flex-1">
                לא נמצא Snapshot בונדד לתאריך העבודה הנבחר. כיסוי בונדד יוצג כ-0.
              </span>
              <button
                type="button"
                onClick={() => handleDismiss(bondedWarningKey)}
                data-testid="dismiss-bonded-warning"
                className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Shortage table */}
          <div className="flex-1 min-h-0">
            <ShortageTable
              rows={rows}
              selectedSku={selectedRow?.sku ?? null}
              onSelectRow={handleSelectRow}
            />
          </div>

          {/* Bottom drawer overlay */}
          {selectedRow && (
            <div className="fixed inset-0 z-50 flex items-start justify-center">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={handleCloseDetail}
              />
              <div
                className="relative z-10 bg-white shadow-2xl rounded-2xl border border-gray-200 overflow-hidden flex flex-col"
                style={{ width: 'min(1180px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 48px)' }}
              >
                <ProductControlDetailPanel
                  row={selectedRow}
                  onClose={handleCloseDetail}
                  shiftId={shiftId}
                  planningDate={planningDate}
                  bondedSnapshotId={bondedSnapshotId}
                  warehouseStockSnapshotId={warehouseStockSnapshotId}
                />
              </div>
            </div>
          )}
        </>
      )}

      {activeSubTab === 'requests' && (
        <BondedRequestsList shiftId={shiftId} />
      )}
    </div>
  );
}
