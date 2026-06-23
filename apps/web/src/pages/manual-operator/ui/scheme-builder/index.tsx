import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { workHierarchyQueryOptions, orderItemsQueryOptions } from '@/entities/manual-shift/api/queries';
import { useSchemeBuilderStore } from './scheme-store';
import { adaptWorkHierarchyToSource, adaptOrderItemsToSource } from './source-data-adapter';
import type { SourceOrderItem, OrderBadgeStatus } from './scheme-types';
import { AreaOverview } from './area-overview';
import { WorkGroupWorkspace } from './work-group-workspace';
import { ItemsDrawerV2 } from './items-drawer-v2';
import { AssignModalV2 } from './assign-modal-v2';
import { QuantityAllocationModal } from './quantity-allocation-modal';
import { ProblemQueue } from './problem-queue';
import { PublishSummary } from './publish-summary';
import { filterOrdersBySearch, filterOrdersByStatus } from './order-list-utils';
import { OrderCard } from './order-card';

export function SchemeBuilder({ shiftId }: { shiftId: string }) {
  const { data: hierarchy, isLoading, error } = useQuery(workHierarchyQueryOptions(shiftId));

  const selectedAreaName = useSchemeBuilderStore((s) => s.selectedAreaName);
  const setSelectedArea = useSchemeBuilderStore((s) => s.setSelectedArea);
  const itemAllocations = useSchemeBuilderStore((s) => s.itemAllocations);
  const allocateItemQty = useSchemeBuilderStore((s) => s.allocateItemQty);
  const allocateItemRows = useSchemeBuilderStore((s) => s.allocateItemRows);
  const targetWorkGroupId = useSchemeBuilderStore((s) => s.targetWorkGroupId);
  const setTargetWorkGroup = useSchemeBuilderStore((s) => s.setTargetWorkGroup);
  const getWorkGroup = useSchemeBuilderStore((s) => s.getWorkGroup);
  const getAssignedQty = useSchemeBuilderStore((s) => s.getAssignedQty);

  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [assignItemIds, setAssignItemIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [quantityModalState, setQuantityModalState] = useState<{
    itemRowIds: string[];
    workGroupId: string;
  } | null>(null);

  const [isWholeOrderAssign, setIsWholeOrderAssign] = useState(false);

  const [showOrders, setShowOrders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderBadgeStatus>('all');

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

  const searchFilteredOrders = useMemo(() => {
    return filterOrdersBySearch(areaOrders, searchQuery, orderItemMap);
  }, [areaOrders, searchQuery, orderItemMap]);

  const statusFilteredOrders = useMemo(() => {
    return filterOrdersByStatus(searchFilteredOrders, statusFilter, orderItemMap, itemAllocations);
  }, [searchFilteredOrders, statusFilter, orderItemMap, itemAllocations]);

  const targetWg = useMemo(() => {
    return targetWorkGroupId ? getWorkGroup(targetWorkGroupId) : undefined;
  }, [targetWorkGroupId, getWorkGroup]);

  const handleOpenItemsDrawer = useCallback((orderId: string) => {
    setDrawerOrderId(orderId);
  }, []);

  const handleCloseItemsDrawer = useCallback(() => {
    setDrawerOrderId(null);
    setAssignItemIds([]);
    setIsWholeOrderAssign(false);
  }, []);

  const handleOpenQuantityModal = useCallback((itemRowIds: string[], workGroupId: string) => {
    setQuantityModalState({ itemRowIds, workGroupId });
  }, []);

  const handleConfirmAllocations = useCallback(
    (allocations: { itemRowId: string; qty: number }[], workGroupId: string) => {
      for (const alloc of allocations) {
        const item = drawerItems.find((i) => i.id === alloc.itemRowId);
        if (!item) continue;
        allocateItemQty({
          itemRowId: alloc.itemRowId,
          workGroupId,
          qty: alloc.qty,
          totalQty: item.quantity,
        });
      }
      setQuantityModalState(null);
      setAssignItemIds([]);
    },
    [allocateItemQty, drawerItems],
  );

  const handleAssignSelected = useCallback((itemRowIds: string[]) => {
    if (targetWorkGroupId) {
      handleOpenQuantityModal(itemRowIds, targetWorkGroupId);
      return;
    }
    setAssignItemIds(itemRowIds);
    setIsWholeOrderAssign(false);
    setShowAssignModal(true);
  }, [targetWorkGroupId, handleOpenQuantityModal]);

  const handleAssignAllUnassigned = useCallback((itemRowIds: string[]) => {
    if (targetWorkGroupId) {
      allocateItemRows(itemRowIds, targetWorkGroupId, orderItemMap);
      return;
    }
    setAssignItemIds(itemRowIds);
    setIsWholeOrderAssign(true);
    setShowAssignModal(true);
  }, [targetWorkGroupId, allocateItemRows, orderItemMap]);

  const handleConfirmAssign = useCallback(
    (workGroupId: string) => {
      if (isWholeOrderAssign) {
        allocateItemRows(assignItemIds, workGroupId, orderItemMap);
        setAssignItemIds([]);
        setIsWholeOrderAssign(false);
      } else {
        handleOpenQuantityModal(assignItemIds, workGroupId);
        setIsWholeOrderAssign(false);
      }
    },
    [assignItemIds, isWholeOrderAssign, allocateItemRows, handleOpenQuantityModal, orderItemMap],
  );

  const handleStartAssign = useCallback((workGroupId: string) => {
    setTargetWorkGroup(workGroupId);
  }, [setTargetWorkGroup]);

  const handleCancelTarget = useCallback(() => {
    setTargetWorkGroup(null);
  }, [setTargetWorkGroup]);

  const quantityModalRows = useMemo(() => {
    if (!quantityModalState) return [];
    return quantityModalState.itemRowIds.map((id) => {
      const item = drawerItems.find((i) => i.id === id);
      const assignedQty = getAssignedQty(id);
      return {
        item: item!,
        remainingQty: Math.max(0, (item?.quantity ?? 0) - assignedQty),
        assignedQty,
      };
    }).filter((r) => r.item);
  }, [quantityModalState, drawerItems, getAssignedQty]);

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
    <div className="flex-1 flex flex-col bg-gray-50" dir="rtl">

      {/* Compact toolbar — area selector pills */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-1.5">
        <AreaOverview
          areas={source.areas}
          selectedAreaName={selectedAreaName}
          onSelectArea={setSelectedArea}
        />
      </div>

      {/* Main board area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left rail (appears on the right in RTL) */}
        <aside className="w-64 shrink-0 border-e border-gray-200 bg-gray-50 p-2 flex flex-col gap-2 overflow-y-auto">
          <PublishSummary
            orders={source.orders}
            orderItemMap={orderItemMap}
          />

          <ProblemQueue
            orders={areaOrders.length > 0 ? areaOrders : source.orders}
            orderItemMap={orderItemMap}
          />
        </aside>

        {/* Center board */}
        <div className="flex-1 flex flex-col min-h-0">
          {targetWg && (
            <div className="shrink-0 flex items-center gap-2 bg-blue-50 border-b border-blue-200 px-3 py-1.5 text-sm">
              <span className="font-bold text-blue-800">קבוצת יעד: {targetWg.name}</span>
              <span className="text-blue-600">— בחר הזמנה ושורות לשיוך</span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleCancelTarget}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
              >
                <X size={14} />
                בטל קבוצת יעד
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            {selectedAreaName ? (
              <WorkGroupWorkspace
                selectedAreaName={selectedAreaName}
                orderItemMap={orderItemMap}
                onStartAssign={handleStartAssign}
              />
            ) : (
              <div className="bg-white border border-dashed border-gray-300 rounded-lg p-6 text-center">
                <h2 className="text-sm font-bold text-gray-800 mb-1">בחר איזור הפצה</h2>
                <p className="text-xs text-gray-500">
                  בחר איזור הפצה מהרשימה כדי להתחיל בתכנון קבוצות עבודה
                </p>
              </div>
            )}
          </div>

          {/* Collapsible orders ribbon */}
          {selectedAreaName && (
            <div className="shrink-0 border-t border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setShowOrders((v) => !v)}
                className="flex items-center gap-2 w-full px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {showOrders ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                הזמנות באיזור ({areaOrders.length})
              </button>

              {showOrders && (
                <div>
                  <div className="px-3 pb-1.5">
                    <div className="relative">
                      <Search size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="חיפוש הזמנה / לקוח / מק״ט"
                        className="w-full pr-7 pl-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-gray-50 placeholder-gray-400"
                        dir="rtl"
                      />
                    </div>
                  </div>

                  <div className="px-3 pb-1.5 flex flex-wrap gap-1">
                    {(['all', 'not_loaded', 'unassigned', 'partial', 'split', 'assigned'] as const).map((f) => {
                      const labels: Record<string, string> = {
                        all: 'הכל', not_loaded: 'לא נטען', unassigned: 'לא שויך',
                        partial: 'חלקי', split: 'מפוצל', assigned: 'שויך',
                      };
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setStatusFilter(f)}
                          className={`text-[11px] rounded-full px-2 py-0.5 font-medium transition-colors ${
                            statusFilter === f
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {labels[f]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="h-40 flex overflow-x-auto gap-2 px-3 pb-2">
                    {statusFilteredOrders.length === 0 ? (
                      <div className="flex items-center justify-center w-full text-xs text-gray-400">
                        לא נמצאו הזמנות
                      </div>
                    ) : (
                      statusFilteredOrders.map((order) => (
                        <OrderCard
                          key={order.orderId}
                          order={order}
                          orderItemMap={orderItemMap}
                          itemAllocations={itemAllocations}
                          onClick={() => handleOpenItemsDrawer(order.orderId)}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
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
          targetWorkGroupName={targetWg?.name ?? null}
        />
      )}

      <AssignModalV2
        isOpen={showAssignModal}
        onClose={() => { setShowAssignModal(false); setAssignItemIds([]); setIsWholeOrderAssign(false); }}
        targetAreaName={selectedAreaName}
        itemCount={assignItemIds.length}
        onAssign={handleConfirmAssign}
      />

      {quantityModalState && (
        <QuantityAllocationModal
          isOpen={true}
          onClose={() => { setQuantityModalState(null); setAssignItemIds([]); }}
          itemRows={quantityModalRows}
          workGroupName={getWorkGroup(quantityModalState.workGroupId)?.name ?? ''}
          onConfirm={(allocs) => handleConfirmAllocations(allocs, quantityModalState.workGroupId)}
        />
      )}
    </div>
  );
}
