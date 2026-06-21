import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, Plus, Search, SplitSquareVertical, X } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { workHierarchyQueryOptions, orderItemsQueryOptions } from '@/entities/manual-shift/api/queries';
import type { LineSchemeData, LineSchemeOrder, LineSchemeItemRow, LineSchemeWorkLine } from './line-scheme-types';
import type { OrderWithStatus } from './line-scheme-mock-data';
import { useLineSchemeState } from './line-scheme-mock-data';
import { adaptWorkHierarchyToScheme, adaptOrderItemsToSchemeRows } from './line-scheme-adapter';
import { useLocalOverlayStore } from './line-scheme-local-overlay';

function Modal({
  isOpen, onClose, title, children, footer
}: {
  isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col mx-4 z-10">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:bg-gray-100 p-1 rounded-full">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function statusBadgeConfig(status: string): { tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger'; label: string } {
  switch (status) {
    case 'unassigned': return { tone: 'neutral', label: 'לא שובץ' };
    case 'assigned': return { tone: 'success', label: 'שובץ' };
    case 'partial': return { tone: 'warning', label: 'שובץ חלקית' };
    case 'split': return { tone: 'info', label: 'מפוצל' };
    default: return { tone: 'danger', label: 'דורש בדיקה' };
  }
}

function backendStatusBadgeConfig(status: string): { tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger'; label: string } {
  switch (status) {
    case 'queued': return { tone: 'neutral', label: 'בהמתנה' };
    case 'picking': return { tone: 'warning', label: 'באיסוף' };
    case 'waiting_check': return { tone: 'info', label: 'ממתין לבדיקה' };
    case 'returned': return { tone: 'danger', label: 'הוחזר' };
    case 'done': return { tone: 'success', label: 'הושלם' };
    default: return { tone: 'neutral', label: status };
  }
}

function OrderCard({
  order,
  onOpenItems,
  onAssignAll,
  onUnassign,
}: {
  order: LineSchemeOrder;
  onOpenItems: () => void;
  onAssignAll: () => void;
  onUnassign: () => void;
}) {
  const badge = statusBadgeConfig(order.assignmentStatus);
  const backendLabel = backendStatusBadgeConfig(order.backendStatus).label;

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm hover:border-blue-400 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-sm text-gray-600 font-bold">{order.orderNumber}</span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <div className="font-semibold text-gray-900 mb-2 truncate text-sm" title={order.customerName ?? ''}>
        {order.customerName}
      </div>
      <div className="text-xs text-gray-500 flex justify-between mb-1">
        <span>כמות {order.totalQuantity}</span>
        <span>סטטוס ביצוע: {backendLabel}</span>
      </div>
      <div className="text-xs text-gray-500 mb-3 border-b border-gray-100 pb-3">
        <span>{order.lineCount} שורות</span>
        {order.hasAshlama && <span className="mr-2 text-amber-700 font-bold">אשלמה</span>}
        {order.hasCheckUnits && <span className="mr-2 text-amber-700 font-bold">יחידות בדיקה</span>}
      </div>
      {order.assignmentStatus === 'split' && (
        <div className="text-xs text-blue-700 bg-blue-50 p-2 mb-3 rounded border border-blue-100">
          שיוכים שונים
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onOpenItems}
          className="flex-1 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          פתח פריטים
        </button>
        {order.assignmentStatus === 'unassigned' ? (
          <button
            type="button"
            onClick={onAssignAll}
            className="flex-1 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            שייך
          </button>
        ) : (
          <button
            type="button"
            onClick={onUnassign}
            className="flex-1 py-1.5 text-xs font-medium rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-50 transition-colors"
          >
            בטל שיוך
          </button>
        )}
      </div>
    </div>
  );
}

function ItemsDrawer({
  order,
  items,
  onClose,
}: {
  order: LineSchemeOrder;
  items: LineSchemeItemRow[];
  onClose: () => void;
}) {
  return (
    <Modal isOpen onClose={onClose} title="פריטי הזמנה" footer={
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">סגור</button>
    }>
      <div className="flex flex-col gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm text-gray-700">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div><span className="text-gray-500">הזמנה:</span> <span className="font-semibold text-gray-900">{order.orderNumber}</span></div>
            <div><span className="text-gray-500">לקוח:</span> <span className="font-semibold text-gray-900">{order.customerName}</span></div>
            <div><span className="text-gray-500">שורות:</span> {order.lineCount}</div>
            <div><span className="text-gray-500">כמות:</span> {order.totalQuantity}</div>
          </div>
          {order.hasAshlama && (
            <div className="mt-2 text-amber-700 bg-amber-50 px-3 py-1 rounded text-xs font-bold">
              יש אשלמה פתוחה
            </div>
          )}
          {order.hasCheckUnits && (
            <div className="mt-1 text-amber-700 bg-amber-50 px-3 py-1 rounded text-xs font-bold">
              יש יחידות בדיקה
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="p-2 font-medium text-gray-700">מק"ט</th>
                <th className="p-2 font-medium text-gray-700">תיאור</th>
                <th className="p-2 font-medium text-gray-700">קטגוריה</th>
                <th className="p-2 font-medium text-gray-700 text-center">כמות</th>
                <th className="p-2 font-medium text-gray-700">הערות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{item.sku}</td>
                  <td className="p-2 max-w-[200px] truncate text-xs" title={item.description ?? ''}>{item.description}</td>
                  <td className="p-2">
                    <Badge tone="neutral">{item.category}</Badge>
                  </td>
                  <td className="p-2 font-semibold text-center text-xs">{item.quantity}</td>
                  <td className="p-2 text-xs text-gray-500">
                    {item.notes && <div>{item.notes}</div>}
                    {item.sourceRows && item.sourceRows.length > 0 && (
                      <div className="text-gray-400">שורות: {item.sourceRows.join(', ')}</div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">טוען פריטים...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function AssignModal({
  isOpen,
  onClose,
  workLines,
  buckets,
  onAssign,
  orderLabel,
  isReadOnlyMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  workLines: { id: string; name: string }[];
  buckets: { id: string; workLineId: string; name: string }[];
  onAssign: (workLineId: string, bucketId: string) => void;
  orderLabel: string;
  isReadOnlyMode: boolean;
}) {
  const [targetLine, setTargetLine] = useState('');
  const [targetBucket, setTargetBucket] = useState('');
  const lineBuckets = buckets.filter(b => b.workLineId === targetLine);

  const handleAssign = () => {
    if (!targetLine || !targetBucket) return;
    onAssign(targetLine, targetBucket);
    setTargetLine('');
    setTargetBucket('');
    onClose();
  };

  const handleClose = () => {
    setTargetLine('');
    setTargetBucket('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="שייך לקו עבודה ונקודה" footer={
      <>
        <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">ביטול</button>
        <button type="button" onClick={handleAssign} disabled={!targetLine || !targetBucket} className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">שייך</button>
      </>
    }>
      <div className="mb-6">
        <div className="text-lg font-semibold text-gray-900 mb-1">שיוך מקומי בלבד</div>
        <div className="text-gray-600 text-sm">{orderLabel}</div>
        {isReadOnlyMode && (
          <div className="mt-2 text-amber-700 bg-amber-50 px-3 py-1 rounded text-xs font-bold">
            שמירה תגיע בשלב הבא
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">בחר קו עבודה</label>
          <div className="grid grid-cols-2 gap-2">
            {workLines.map(line => (
              <div
                key={line.id}
                onClick={() => { setTargetLine(line.id); setTargetBucket(''); }}
                className={`border rounded p-3 cursor-pointer transition-colors text-sm ${
                  targetLine === line.id
                    ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-sm'
                    : 'hover:border-blue-300'
                }`}
              >
                {line.name}
              </div>
            ))}
            {workLines.length === 0 && (
              <span className="text-gray-500 text-sm col-span-2">אין קווי עבודה</span>
            )}
          </div>
        </div>

        {targetLine && (
          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              בחר נקודה / קבוצה בקו {workLines.find(l => l.id === targetLine)?.name}
            </label>
            <div className="flex flex-wrap gap-2">
              {lineBuckets.map(bucket => (
                <span
                  key={bucket.id}
                  onClick={() => setTargetBucket(bucket.id)}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                    targetBucket === bucket.id
                      ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-500'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {bucket.name}
                </span>
              ))}
              {lineBuckets.length === 0 && (
                <span className="text-sm text-gray-500">אין נקודות בקו זה</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function LineSchemeBuilderInner({
  scheme,
  allLines,
  allBuckets,
  allOrders,
  isReadOnlyMode,
}: {
  scheme: LineSchemeData;
  allLines: { id: string; name: string }[];
  allBuckets: { id: string; workLineId: string; name: string }[];
  allOrders: LineSchemeOrder[];
  isReadOnlyMode: boolean;
}) {
  const overlayStore = useLocalOverlayStore();

  const [searchQuery, setSearchQuery] = useState('');

  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [assignOrderId, setAssignOrderId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const { data: rawItems } = useQuery({
    ...orderItemsQueryOptions(drawerOrderId ?? ''),
    enabled: !!drawerOrderId
  });

  const drawerOrder = drawerOrderId ? allOrders.find(o => o.orderId === drawerOrderId) ?? null : null;
  const assignOrder = assignOrderId ? allOrders.find(o => o.orderId === assignOrderId) ?? null : null;
  const drawerItems: LineSchemeItemRow[] = useMemo(() => {
    if (!rawItems) return [];
    return adaptOrderItemsToSchemeRows(rawItems);
  }, [rawItems]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return allOrders;
    const q = searchQuery.trim().toLowerCase();
    return allOrders.filter(o =>
      (o.orderNumber ?? '').toLowerCase().includes(q) ||
      (o.customerName ?? '').includes(q)
    );
  }, [searchQuery, allOrders]);

  const openItemsDrawer = useCallback((orderId: string) => {
    setDrawerOrderId(orderId);
  }, []);

  const openAssign = useCallback((orderId: string) => {
    setAssignOrderId(orderId);
    setShowAssignModal(true);
  }, []);

  const executeAssign = useCallback((workLineId: string, bucketId: string) => {
    if (!assignOrderId) return;
    const line = allLines.find(l => l.id === workLineId);
    const bucket = allBuckets.find(b => b.id === bucketId);
    if (!line || !bucket) return;
    overlayStore.assignOrder(assignOrderId, workLineId, bucket.name);
    setShowAssignModal(false);
    setAssignOrderId(null);
  }, [assignOrderId, allLines, allBuckets, overlayStore]);

  const executeUnassign = useCallback((orderId: string) => {
    overlayStore.unassignOrder(orderId);
  }, [overlayStore]);

  const unassignedCount = useMemo(
    () => allOrders.filter(o => o.assignmentStatus === 'unassigned').length,
    [allOrders]
  );

  const flatBuckets = useMemo(() =>
    allBuckets.map(b => ({ ...b })),
    [allBuckets]
  );

  if (allOrders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 text-sm" dir="rtl">
        אין הזמנות להצגה
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 shadow-sm sticky top-0 z-20">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-xl font-bold text-gray-900">תכנון קווי עבודה</h1>
          {isReadOnlyMode && (
            <span className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded font-medium border border-amber-200">
              שמירה תגיע בשלב הבא
            </span>
          )}
        </div>

        {unassignedCount > 0 ? (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 px-4 py-2 rounded font-medium border border-red-100 text-sm">
            <AlertCircle size={18} />
            נותרו {unassignedCount} הזמנות שלא שובצו
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded font-medium border border-green-100 text-sm">
            <CheckCircle2 size={18} />
            כל ההזמנות שובצו — התכנית מוכנה
          </div>
        )}
      </header>

      <main className="flex-1 p-6 flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex-1 flex flex-col h-[calc(100vh-200px)] sticky top-36">
            <div className="p-4 border-b border-gray-200 bg-gray-50/50 rounded-t-lg">
              <h2 className="text-lg font-bold text-gray-900 mb-1">הזמנות</h2>
              <p className="text-sm text-gray-500 mb-4">{filteredOrders.length} הזמנות</p>
              <div className="relative">
                <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="חיפוש לקוח / הזמנה..."
                  className="w-full text-sm border border-gray-300 rounded pl-3 pr-9 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredOrders.map(order => (
                <OrderCard
                  key={order.orderId}
                  order={order}
                  onOpenItems={() => openItemsDrawer(order.orderId)}
                  onAssignAll={() => openAssign(order.orderId)}
                  onUnassign={() => executeUnassign(order.orderId)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">קווי עבודה ונקודות</h2>

          {allLines.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-300 border-dashed p-12 text-center">
              <SplitSquareVertical size={64} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">אין קווי עבודה</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm">
                המערכת מצאה {allOrders.length} הזמנות.
                יש להגדיר קווי עבודה דרך הייבוא החודשי.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {scheme.areas.map(area => (
                <div key={area.areaName ?? '__null_area__'} className="mb-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 px-1">{area.displayName}</h3>
                  <div className="space-y-4">
                    {area.lines.map(line => (
                      <LineSection
                        key={line.lineId}
                        line={line}
                        allOrders={allOrders}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {drawerOrder && (
        <ItemsDrawer
          order={drawerOrder}
          items={drawerItems}
          onClose={() => { setDrawerOrderId(null); }}
        />
      )}

      {showAssignModal && assignOrder && (
        <AssignModal
          isOpen={showAssignModal}
          onClose={() => { setShowAssignModal(false); setAssignOrderId(null); }}
          workLines={allLines}
          buckets={flatBuckets}
          onAssign={executeAssign}
          orderLabel={`הזמנה: ${assignOrder.orderNumber} | ${assignOrder.customerName}`}
          isReadOnlyMode={isReadOnlyMode}
        />
      )}
    </div>
  );
}

function LineSection({
  line,
  allOrders,
}: {
  line: LineSchemeWorkLine;
  allOrders: LineSchemeOrder[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 block shrink-0" />
            {line.lineGroupName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {line.totalOrders} הזמנות &middot; כמות {line.totalQuantity}
          </p>
          {line.distributionArea && (
            <p className="text-xs text-gray-500 mt-0.5">איזור הפצה: {line.distributionArea}</p>
          )}
        </div>
      </div>

      <div className="p-4 bg-white flex flex-wrap gap-3 items-start">
        {line.buckets.map(bucket => {
          const bucketOrders = allOrders.filter(o => o.localAssignment?.assignedBucketKey === bucket.bucketKey);
          const bucketQty = bucketOrders.reduce((s, o) => s + o.totalQuantity, 0);
          return (
            <div
              key={bucket.bucketKey}
              className="border border-gray-200 rounded-lg p-3 w-56 shadow-sm hover:border-blue-300 transition-colors"
            >
              <div className="font-semibold text-gray-900 text-sm">{bucket.displayName}</div>
              <div className="text-xs text-gray-500 mt-1">
                {bucket.totalOrders} הזמנות &middot; כמות {bucket.totalQuantity}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {bucketOrders.length} משויכות &middot; כמות {bucketQty}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {bucketOrders.slice(0, 4).map(o => (
                  <span key={o.orderId} className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 truncate max-w-[120px]">
                    {o.orderNumber}
                  </span>
                ))}
                {bucketOrders.length > 4 && (
                  <span className="text-xs text-gray-500">+{bucketOrders.length - 4}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]" dir="rtl">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-[40vh]" dir="rtl">
      <div className="text-center">
        <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
        <p className="text-red-600 font-medium">שגיאה בטעינת נתונים</p>
        <p className="text-gray-500 text-sm mt-1">{message}</p>
      </div>
    </div>
  );
}

export function LineSchemeBuilder({ shiftId }: { shiftId?: string }) {
  const isRealData = !!shiftId;

  if (!isRealData) {
    return <MockLineSchemeBuilder />;
  }

  return <RealDataLineSchemeBuilder shiftId={shiftId!} />;
}

function RealDataLineSchemeBuilder({ shiftId }: { shiftId: string }) {
  const { data: hierarchy, isLoading, error } = useQuery(workHierarchyQueryOptions(shiftId));
  const overlayStore = useLocalOverlayStore();
  const assignments = overlayStore.assignments;

  const scheme = useMemo(() => {
    if (!hierarchy) return null;
    return adaptWorkHierarchyToScheme(hierarchy, assignments);
  }, [hierarchy, assignments]);

  const allLines = useMemo(() => {
    if (!scheme) return [];
    const result: { id: string; name: string }[] = [];
    for (const area of scheme.areas) {
      for (const line of area.lines) {
        result.push({ id: line.lineId, name: line.lineGroupName });
      }
    }
    return result;
  }, [scheme]);

  const allBuckets = useMemo(() => {
    if (!scheme) return [];
    const result: { id: string; workLineId: string; name: string }[] = [];
    for (const area of scheme.areas) {
      for (const line of area.lines) {
        for (const bucket of line.buckets) {
          result.push({ id: bucket.bucketKey, workLineId: line.lineId, name: bucket.displayName });
        }
      }
    }
    return result;
  }, [scheme]);

  const allOrders = useMemo(() => {
    if (!scheme) return [];
    const result: LineSchemeOrder[] = [];
    for (const area of scheme.areas) {
      for (const line of area.lines) {
        for (const bucket of line.buckets) {
          for (const order of bucket.orders) {
            result.push(order);
          }
        }
      }
    }
    return result;
  }, [scheme]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} />;
  if (!scheme) return <ErrorState message="לא התקבלו נתונים" />;

  return (
    <LineSchemeBuilderInner
      scheme={scheme}
      allLines={allLines}
      allBuckets={allBuckets}
      allOrders={allOrders}
      isReadOnlyMode={true}
    />
  );
}

function MockLineSchemeBuilder() {
  const state = useLineSchemeState();

  const [searchQuery, setSearchQuery] = useState('');

  const [showLineModal, setShowLineModal] = useState(false);
  const [newLineName, setNewLineName] = useState('');

  const [showBucketModal, setShowBucketModal] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [targetLineId, setTargetLineId] = useState<string | null>(null);

  const [drawerOrder, setDrawerOrder] = useState<OrderWithStatus | null>(null);

  const [assignOrder, setAssignOrder] = useState<OrderWithStatus | null>(null);
  const [assignItemIds, setAssignItemIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return state.ordersWithStatus;
    const q = searchQuery.trim().toLowerCase();
    return state.ordersWithStatus.filter(o =>
      o.orderNumber.toLowerCase().includes(q) || o.customerName.includes(q)
    );
  }, [searchQuery, state.ordersWithStatus]);

  const handleCreateLine = () => {
    if (!newLineName.trim()) return;
    state.createWorkLine(newLineName.trim());
    setShowLineModal(false);
    setNewLineName('');
  };

  const handleCreateBucket = () => {
    if (!targetLineId || !newBucketName.trim()) return;
    state.createBucket(targetLineId, newBucketName.trim());
    setShowBucketModal(false);
    setNewBucketName('');
  };

  const openItemsDrawer = (order: typeof state.ordersWithStatus[number]) => {
    setDrawerOrder(order);
  };

  const openAssignWholeOrder = (order: typeof state.ordersWithStatus[number]) => {
    const ids = state.items.filter(i => i.orderId === order.id && !i.assignment).map(i => i.id);
    setAssignOrder(order);
    setAssignItemIds(ids);
    setShowAssignModal(true);
  };

  const executeAssign = (workLineId: string, bucketId: string) => {
    state.assignItems(assignItemIds, workLineId, bucketId);
    setShowAssignModal(false);
  };

  if (state.ordersWithStatus.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 text-sm" dir="rtl">
        אין הזמנות להצגה
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 shadow-sm sticky top-0 z-20">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-xl font-bold text-gray-900">תכנון קווי עבודה</h1>
          <button
            type="button"
            onClick={() => setShowLineModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            קו עבודה חדש
          </button>
        </div>

        {state.unassignedCount > 0 ? (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 px-4 py-2 rounded font-medium border border-red-100 text-sm">
            <AlertCircle size={18} />
            נותרו {state.unassignedCount} שורות שלא שובצו
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded font-medium border border-green-100 text-sm">
            <CheckCircle2 size={18} />
            כל השורות שובצו — התכנית מוכנה
          </div>
        )}
      </header>

      <main className="flex-1 p-6 flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex-1 flex flex-col h-[calc(100vh-200px)] sticky top-36">
            <div className="p-4 border-b border-gray-200 bg-gray-50/50 rounded-t-lg">
              <h2 className="text-lg font-bold text-gray-900 mb-1">הזמנות</h2>
              <p className="text-sm text-gray-500 mb-4">{filteredOrders.length} הזמנות</p>
              <div className="relative">
                <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="חיפוש לקוח / הזמנה..."
                  className="w-full text-sm border border-gray-300 rounded pl-3 pr-9 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={{
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    customerName: order.customerName,
                    pointName: null,
                    sourceZone: null,
                    backendStatus: 'queued',
                    lineCount: order.items.length,
                    totalQuantity: order.totalQty,
                    hasAshlama: false,
                    hasCheckUnits: false,
                    assignmentStatus: order.status,
                    localAssignment: null,
                  }}
                  onOpenItems={() => openItemsDrawer(order)}
                  onAssignAll={() => openAssignWholeOrder(order)}
                  onUnassign={() => {}}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">קווי עבודה ונקודות</h2>

          {state.workLines.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-300 border-dashed p-12 text-center">
              <SplitSquareVertical size={64} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">אין קווי עבודה</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm">
                המערכת מצאה {state.ordersWithStatus.length} הזמנות ו-{state.items.length} שורות.
                יש ליצור קווי עבודה ולשייך אליהם הזמנות.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLineModal(true)}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  צור קו עבודה
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {state.workLines.map(line => {
                const lineBuckets = state.buckets.filter(b => b.workLineId === line.id);
                const lineItems = state.items.filter(i => i.assignment?.workLineId === line.id);
                const lineOrderIds = new Set(lineItems.map(i => i.orderId));
                const lineQty = lineItems.reduce((acc, i) => acc + i.quantity, 0);

                return (
                  <div key={line.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-blue-500 block shrink-0" />
                          {line.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {lineOrderIds.size} הזמנות &middot; {lineItems.length} שורות &middot; כמות {lineQty}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-white flex flex-wrap gap-3 items-start">
                      {lineBuckets.map(bucket => {
                        const bItems = state.items.filter(i => i.assignment?.bucketId === bucket.id);
                        return (
                          <div
                            key={bucket.id}
                            className="border border-gray-200 rounded-lg p-3 w-56 shadow-sm hover:border-blue-300 transition-colors"
                          >
                            <div className="font-semibold text-gray-900 text-sm">{bucket.name}</div>
                            <div className="text-xs text-gray-500 mt-1">{bItems.length} שורות</div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => { setTargetLineId(line.id); setShowBucketModal(true); }}
                        className="border border-dashed border-gray-300 rounded-lg p-3 w-56 text-gray-500 flex items-center justify-center hover:bg-gray-50 hover:text-gray-800 transition-colors text-sm"
                      >
                        <Plus size={16} className="ml-1" />
                        נקודה / קבוצה
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setShowLineModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-dashed border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={16} />
                  קו עבודה חדש
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Modal isOpen={showLineModal} onClose={() => setShowLineModal(false)} title="יצירת קו עבודה" footer={
        <>
          <button type="button" onClick={() => setShowLineModal(false)} className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">ביטול</button>
          <button type="button" onClick={handleCreateLine} disabled={!newLineName.trim()} className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">צור קו עבודה</button>
        </>
      }>
        <label className="block text-sm font-medium text-gray-700 mb-2">שם קו עבודה</label>
        <input
          autoFocus
          className="w-full border border-gray-300 rounded-md p-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={newLineName}
          onChange={e => setNewLineName(e.target.value)}
          dir="rtl"
        />
        <div className="text-sm text-gray-500 mb-2">הצעות מהירות:</div>
        <div className="flex flex-wrap gap-2">
          {['דרומי 1', 'דרומי 2', 'צפוני 1', 'חריגים', 'דחוף'].map(s => (
            <span
              key={s}
              onClick={() => setNewLineName(s)}
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200 transition-colors"
            >
              {s}
            </span>
          ))}
        </div>
      </Modal>

      <Modal isOpen={showBucketModal} onClose={() => setShowBucketModal(false)} title="יצירת נקודה / קבוצה" footer={
        <>
          <button type="button" onClick={() => setShowBucketModal(false)} className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">ביטול</button>
          <button type="button" onClick={handleCreateBucket} disabled={!newBucketName.trim()} className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">צור</button>
        </>
      }>
        <label className="block text-sm font-medium text-gray-700 mb-2">שם נקודה / קבוצה</label>
        <input
          autoFocus
          className="w-full border border-gray-300 rounded-md p-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={newBucketName}
          onChange={e => setNewBucketName(e.target.value)}
          dir="rtl"
        />
        <div className="text-sm text-gray-500 mb-2">הצעות מהירות:</div>
        <div className="flex flex-wrap gap-2">
          {['כללי', 'באר שבע', 'סלולר', 'רכב', 'קמפינג', 'סופר שוק', 'לבדיקה', 'חריגים'].map(s => (
            <span
              key={s}
              onClick={() => setNewBucketName(s)}
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200 transition-colors"
            >
              {s}
            </span>
          ))}
        </div>
      </Modal>

      {drawerOrder && (
        <ItemsDrawer
          order={{
            orderId: drawerOrder.id,
            orderNumber: drawerOrder.orderNumber,
            customerName: drawerOrder.customerName,
            pointName: null,
            sourceZone: null,
            backendStatus: 'queued',
            lineCount: drawerOrder.items.length,
            totalQuantity: drawerOrder.totalQty,
            hasAshlama: false,
            hasCheckUnits: false,
            assignmentStatus: drawerOrder.status,
            localAssignment: null,
          }}
          items={drawerOrder.items.map(i => ({
            id: i.id,
            orderId: i.orderId,
            sku: i.sku,
            description: i.description,
            category: i.category,
            quantity: i.quantity,
            notes: null,
            zone: null,
            sourceRows: null,
            sourceFile: null,
          }))}
          onClose={() => { setDrawerOrder(null); }}
        />
      )}

      {showAssignModal && assignOrder && (
        <AssignModal
          isOpen={showAssignModal}
          onClose={() => { setShowAssignModal(false); setAssignOrder(null); setAssignItemIds([]); }}
          workLines={state.workLines}
          buckets={state.buckets.map(b => ({ id: b.id, workLineId: b.workLineId, name: b.name }))}
          onAssign={executeAssign}
          orderLabel={`הזמנה: ${assignOrder.orderNumber} | ${assignOrder.customerName}`}
          isReadOnlyMode={false}
        />
      )}
    </div>
  );
}
