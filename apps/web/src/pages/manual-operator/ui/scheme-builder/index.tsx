import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { workHierarchyQueryOptions, orderItemsQueryOptions } from '@/entities/manual-shift/api/queries';
import { useSchemeBuilderStore } from './scheme-store';
import { adaptWorkHierarchyToSource, adaptOrderItemsToSource } from './source-data-adapter';
import type { SourceOrderItem } from './scheme-types';
import { AreaOverview } from './area-overview';
import { WorkGroupWorkspace } from './work-group-workspace';
import { ItemsDrawerV2 } from './items-drawer-v2';
import { AssignModalV2 } from './assign-modal-v2';
import { ProblemQueue } from './problem-queue';
import { PublishSummary } from './publish-summary';

export function SchemeBuilder({ shiftId }: { shiftId: string }) {
  const { data: hierarchy, isLoading, error } = useQuery(workHierarchyQueryOptions(shiftId));

  const selectedAreaName = useSchemeBuilderStore((s) => s.selectedAreaName);
  const setSelectedArea = useSchemeBuilderStore((s) => s.setSelectedArea);
  const workGroups = useSchemeBuilderStore((s) => s.workGroups);
  const assignItemRows = useSchemeBuilderStore((s) => s.assignItemRows);
  const assignWholeOrder = useSchemeBuilderStore((s) => s.assignWholeOrder);
  const itemAssignments = useSchemeBuilderStore((s) => s.itemAssignments);

  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [assignItemIds, setAssignItemIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isWholeOrderAssign, setIsWholeOrderAssign] = useState(false);

  const source = useMemo(() => {
    if (!hierarchy) return null;
    return adaptWorkHierarchyToSource(hierarchy);
  }, [hierarchy]);

  const { data: rawItems, isLoading: itemsLoading, isError: itemsError } = useQuery({
    ...orderItemsQueryOptions(drawerOrderId ?? ''),
    enabled: !!drawerOrderId,
  });

  const drawerItems: SourceOrderItem[] = useMemo(() => {
    if (!rawItems) return [];
    return adaptOrderItemsToSource(rawItems);
  }, [rawItems]);

  const orderItemMap = useMemo(() => {
    const map: Record<string, SourceOrderItem[]> = {};
    if (drawerOrderId && drawerItems.length > 0) {
      map[drawerOrderId] = drawerItems;
    }
    return map;
  }, [drawerOrderId, drawerItems]);

  const drawerOrder = useMemo(() => {
    if (!source || !drawerOrderId) return null;
    return source.orders.find((o) => o.orderId === drawerOrderId) ?? null;
  }, [source, drawerOrderId]);

  const areaOrders = useMemo(() => {
    if (!source || !selectedAreaName) return [];
    return source.orders.filter((o) => o.areaName === selectedAreaName);
  }, [source, selectedAreaName]);

  const unassignedCount = useMemo(() => {
    if (!source) return 0;
    return Object.values(orderItemMap).reduce((acc, items) => {
      return acc + items.filter((i) => !(i.id in itemAssignments)).length;
    }, 0);
  }, [orderItemMap, itemAssignments]);

  const handleOpenItemsDrawer = useCallback((orderId: string) => {
    setDrawerOrderId(orderId);
  }, []);

  const handleCloseItemsDrawer = useCallback(() => {
    setDrawerOrderId(null);
    setAssignItemIds([]);
    setIsWholeOrderAssign(false);
  }, []);

  const handleAssignSelected = useCallback((itemRowIds: string[]) => {
    setAssignItemIds(itemRowIds);
    setIsWholeOrderAssign(false);
    setShowAssignModal(true);
  }, []);

  const handleAssignAllUnassigned = useCallback((itemRowIds: string[]) => {
    setAssignItemIds(itemRowIds);
    setIsWholeOrderAssign(true);
    setShowAssignModal(true);
  }, []);

  const handleConfirmAssign = useCallback(
    (workGroupId: string) => {
      if (isWholeOrderAssign) {
        assignWholeOrder(assignItemIds, workGroupId);
      } else {
        assignItemRows(assignItemIds, workGroupId);
      }
      setAssignItemIds([]);
      setIsWholeOrderAssign(false);
    },
    [assignItemIds, isWholeOrderAssign, assignItemRows, assignWholeOrder],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500" dir="rtl">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full ml-2" />
        טוען נתוני משמרת...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-red-600" dir="rtl">
        <AlertCircle size={24} className="ml-2" />
        שגיאה בטעינת נתונים: {error.message}
      </div>
    );
  }

  if (!source) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500" dir="rtl">
        לא התקבלו נתונים
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 shadow-sm sticky top-0 z-20">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-xl font-bold text-gray-900">תכנון קבוצות עבודה</h1>
          <span className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded font-medium border border-amber-200">
            טיוטה מקומית בלבד — שמירה תגיע בשלב הבא
          </span>
        </div>

        {workGroups.length === 0 ? (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-4 py-2 rounded font-medium border border-amber-100 text-sm">
            <AlertCircle size={18} />
            טרם נוצרו קבוצות עבודה
          </div>
        ) : unassignedCount > 0 ? (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 px-4 py-2 rounded font-medium border border-red-100 text-sm">
            <AlertCircle size={18} />
            נותרו {unassignedCount} שורות שלא שובצו
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded font-medium border border-green-100 text-sm">
            <CheckCircle2 size={18} />
            כל השורות שובצו — התכנית מוכנה
          </div>
        )}
      </header>

      <main className="flex-1 p-6 flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
          <AreaOverview
            areas={source.areas}
            selectedAreaName={selectedAreaName}
            onSelectArea={setSelectedArea}
          />

          <ProblemQueue
            orders={areaOrders.length > 0 ? areaOrders : source.orders}
            orderItemMap={orderItemMap}
          />

          <PublishSummary
            orders={source.orders}
            orderItemMap={orderItemMap}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {selectedAreaName ? (
            <WorkGroupWorkspace
              selectedAreaName={selectedAreaName}
              orderItemMap={orderItemMap}
              onOpenAssignModal={() => {/* user opens order drawer to select items */}}
            />
          ) : (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-2">בחר איזור הפצה</h2>
              <p className="text-sm text-gray-500">
                בחר איזור הפצה מהרשימה כדי להתחיל בתכנון קבוצות עבודה
              </p>
            </div>
          )}

          {selectedAreaName && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-700 mb-3">הזמנות באיזור ({areaOrders.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {areaOrders.map((order) => (
                  <div
                    key={order.orderId}
                    className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => handleOpenItemsDrawer(order.orderId)}
                  >
                    <div className="font-mono text-xs text-gray-500 font-bold">{order.orderNumber}</div>
                    <div className="font-semibold text-gray-900 text-sm truncate mt-0.5" title={order.customerName ?? ''}>
                      {order.customerName}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      כמות {order.totalQuantity} &middot; {order.itemLinesCount} שורות
                    </div>
                    {order.hasAshlama && <span className="text-xs text-amber-700 font-bold">אשלמה </span>}
                    {order.hasCheckUnits && <span className="text-xs text-amber-700 font-bold mr-1">יחידות בדיקה</span>}
                    <div className="text-xs text-gray-400 mt-1">
                      קו הפצה מקורי: {order.sourceDeliveryLine?.lineGroupName ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {drawerOrder && (
        <ItemsDrawerV2
          order={drawerOrder}
          items={drawerItems}
          isLoading={itemsLoading}
          isError={itemsError}
          onClose={handleCloseItemsDrawer}
          onAssignSelected={handleAssignSelected}
          onAssignAllUnassigned={handleAssignAllUnassigned}
        />
      )}

      <AssignModalV2
        isOpen={showAssignModal}
        onClose={() => { setShowAssignModal(false); setAssignItemIds([]); setIsWholeOrderAssign(false); }}
        workGroups={workGroups}
        targetAreaName={selectedAreaName}
        itemCount={assignItemIds.length}
        onAssign={handleConfirmAssign}
      />
    </div>
  );
}
