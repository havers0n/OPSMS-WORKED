import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronUp, Save, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { workHierarchyQueryOptions, orderItemsQueryOptions } from '@/entities/manual-shift/api/queries';
import { demandPlanningPreviewQueryOptions, demandPlanningDraftQueryOptions } from '@/entities/demand/api/queries';
import { usePutDemandPlanningPlan, usePublishDemandPlanningDraftToShift, useCreateDemandPlanningDraft, useRevertDemandPlanningPublication } from '@/entities/demand/api/mutations';
import { saveDemandLastContext } from '@/entities/demand/lib/last-context';
import { BffRequestError } from '@/shared/api/bff/client';
import { useSchemeBuilderStore } from './scheme-store';
import { adaptWorkHierarchyToSource, adaptOrderItemsToSource } from './source-data-adapter';
import { adaptDemandPlanningPreviewToSource } from './demand-source-adapter';
import { auditAndAdaptRollingDraft } from './rolling-source-adapter';
import { buildPlanPayload } from './plan-payload';
import type { DemandPlanningPublishToShiftResponse, RollingPublishConflict } from '@wos/domain';
import type { SourceOrderItem, OrderBadgeStatus, PlanningLine, WorkGroup, ItemAllocation, SchemeBuilderCapabilities, DemandPlanningDraftUiMode, DemandPlanningPublishUiMode } from './scheme-types';
import { AreaOverview } from './area-overview';
import { WorkGroupWorkspace } from './work-group-workspace';
import { ItemsDrawerV2 } from './items-drawer-v2';
import { AssignModalV2 } from './assign-modal-v2';
import { QuantityAllocationModal } from './quantity-allocation-modal';
import { ProblemQueue } from './problem-queue';
import { PublishSummary } from './publish-summary';
import { filterOrdersBySearch, filterOrdersByStatus } from './order-list-utils';
import { OrderCard } from './order-card';
import { DemandExplorerView } from './demand-explorer-view';

interface ShiftModeProps {
  mode?: 'shift';
  shiftId: string;
  batchId?: never;
  draftId?: never;
}

interface DemandModeProps {
  mode: 'demand';
  batchId?: string | null;
  draftId: string;
  targetDate?: string | null;
  targetShiftId?: string | null;
  intent?: 'plan-for-date' | 'append-current-shift';
  shiftId?: never;
}

export type SchemeBuilderProps = ShiftModeProps | DemandModeProps;

export function SchemeBuilder(props: SchemeBuilderProps) {
  const navigate = useNavigate();
  const isDemandMode = props.mode === 'demand';
  const shiftId = !isDemandMode ? (props as ShiftModeProps).shiftId : undefined;
  const batchId = isDemandMode ? (props as DemandModeProps).batchId : undefined;
  const draftId = isDemandMode ? (props as DemandModeProps).draftId : undefined;
  const targetDate = isDemandMode ? (props as DemandModeProps).targetDate : undefined;
  const targetShiftId = isDemandMode ? (props as DemandModeProps).targetShiftId : undefined;
  const lineIntent = isDemandMode ? (props as DemandModeProps).intent : undefined;


  const {
    data: hierarchy, isLoading: hierarchyLoading, error: hierarchyError
  } = useQuery({
    ...workHierarchyQueryOptions(shiftId ?? ''),
    enabled: !isDemandMode && !!shiftId,
  });

  const {
    data: draftWithAssignments, isLoading: draftLoading, error: draftError, refetch: refetchDraft
  } = useQuery({
    ...demandPlanningDraftQueryOptions(draftId ?? ''),
    enabled: isDemandMode && !!draftId,
  });

  const draftUiMode: DemandPlanningDraftUiMode = isDemandMode && draftWithAssignments?.draft?.status === 'applied'
    ? 'publishedDraft'
    : 'planningDraft';
  const publishUiMode: DemandPlanningPublishUiMode = targetShiftId ? 'readyToPublish' : 'noTargetShift';
  const isPublishedDraft = isDemandMode && draftUiMode === 'publishedDraft';
  const draftPublication = isPublishedDraft ? draftWithAssignments?.publication ?? null : null;
  const canRevert = draftPublication?.status === 'applied' && (draftWithAssignments?.canRevert ?? false);
  const revertBlockedReason = draftWithAssignments?.revertBlockedReason ?? null;
  const sourceScope = isPublishedDraft ? 'all' as const : (draftWithAssignments?.draft?.sourceScope ?? 'all') as 'all' | 'remaining';
  const isRollingDraft = isDemandMode && (draftWithAssignments?.draft?.sourceKind === 'rolling' || (!batchId && !!draftId));
  const {
    data: planningPreview, isLoading: previewLoading, error: previewError
  } = useQuery({
    ...demandPlanningPreviewQueryOptions(batchId ?? '', sourceScope),
    enabled: isDemandMode && !isRollingDraft && !!batchId && !!draftWithAssignments,
  });

  const { data: remainingPreview } = useQuery({
    ...demandPlanningPreviewQueryOptions(batchId ?? '', 'remaining'),
    enabled: isPublishedDraft && !!batchId,
  });
  const hasRemainingDemand = (remainingPreview?.summary.normalRowsCount ?? 0) > 0
    && (remainingPreview?.summary.totalQuantity ?? 0) > 0;

  const capabilities: SchemeBuilderCapabilities = useMemo(() => {
    if (isDemandMode) {
      const canEditDraft = !isPublishedDraft;
      return {
        canCreatePlanningLines: canEditDraft,
        canCreateWorkGroups: canEditDraft,
        canAssignOrders: canEditDraft,
        canMoveOrders: canEditDraft,
        canSaveDraft: canEditDraft,
        canPublishToShift: canEditDraft && publishUiMode === 'readyToPublish',
        canWriteManualShift: false,
        canPrint: false,
      };
    }

    return {
      canCreatePlanningLines: true,
      canCreateWorkGroups: true,
      canAssignOrders: true,
      canMoveOrders: true,
      canSaveDraft: false,
      canPublishToShift: true,
      canWriteManualShift: true,
      canPrint: true,
    };
  }, [isDemandMode, isPublishedDraft, publishUiMode]);

  const selectedAreaName = useSchemeBuilderStore((s) => s.selectedAreaName);
  const setSelectedArea = useSchemeBuilderStore((s) => s.setSelectedArea);
  const itemAllocations = useSchemeBuilderStore((s) => s.itemAllocations);
  const allocateItemQty = useSchemeBuilderStore((s) => s.allocateItemQty);
  const allocateItemRows = useSchemeBuilderStore((s) => s.allocateItemRows);
  const targetWorkGroupId = useSchemeBuilderStore((s) => s.targetWorkGroupId);
  const setTargetWorkGroup = useSchemeBuilderStore((s) => s.setTargetWorkGroup);
  const getWorkGroup = useSchemeBuilderStore((s) => s.getWorkGroup);
  const getAssignedQty = useSchemeBuilderStore((s) => s.getAssignedQty);
  const hydrateFromDraft = useSchemeBuilderStore((s) => s.hydrateFromDraft);
  const clearLocalDraft = useSchemeBuilderStore((s) => s.clearLocalDraft);
  const planningLines = useSchemeBuilderStore((s) => s.planningLines);
  const workGroups = useSchemeBuilderStore((s) => s.workGroups);

  const savePlan = usePutDemandPlanningPlan();
  const publishPlan = usePublishDemandPlanningDraftToShift();
  const createDraft = useCreateDemandPlanningDraft();
  const revertPublication = useRevertDemandPlanningPublication();
  const [publishResult, setPublishResult] = useState<DemandPlanningPublishToShiftResponse | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishConflicts, setPublishConflicts] = useState<RollingPublishConflict[] | null>(null);
  const [planBuildError, setPlanBuildError] = useState<string | null>(null);

  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [assignFlow, setAssignFlow] = useState<{
    itemRowIds: string[];
    mode: 'selected' | 'all-unassigned';
  } | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [quantityModalState, setQuantityModalState] = useState<{
    itemRowIds: string[];
    workGroupId: string;
  } | null>(null);

  const [viewMode, setViewMode] = useState<'work-lines' | 'available-orders'>('work-lines');
  const [showOrders, setShowOrders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderBadgeStatus>('all');

  /* ---------- Shift-mode data ---------- */
  const shiftSource = useMemo(() => {
    if (!hierarchy) return null;
    return adaptWorkHierarchyToSource(hierarchy);
  }, [hierarchy]);

  const { data: rawItems } = useQuery({
    ...orderItemsQueryOptions(drawerOrderId ?? ''),
    enabled: !isDemandMode && !!drawerOrderId,
  });

  const drawerItemsShift: SourceOrderItem[] = useMemo(() => {
    if (!rawItems) return [];
    return adaptOrderItemsToSource(rawItems);
  }, [rawItems]);

  /* ---------- Demand-mode data ---------- */
  const rollingDraftAuditResult = useMemo(() => {
    if (!isRollingDraft || !draftWithAssignments) return { data: null, error: null };
    try {
      return { data: auditAndAdaptRollingDraft(draftWithAssignments), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('טיוטת הביקוש אינה תקינה.') };
    }
  }, [isRollingDraft, draftWithAssignments]);
  const rollingDraftAudit = rollingDraftAuditResult.data;

  const demandSource = useMemo(() => {
    if (!isDemandMode) return null;
    if (isRollingDraft && rollingDraftAudit) return rollingDraftAudit.source;
    if (!planningPreview || !batchId) return null;
    return adaptDemandPlanningPreviewToSource(planningPreview, batchId);
  }, [isDemandMode, isRollingDraft, planningPreview, batchId, rollingDraftAudit]);

  /* Hydrate draft into store when data arrives */
  const lastDraftKey = useMemo(() => {
    if (!isDemandMode || !draftWithAssignments) return null;
    return `${draftWithAssignments.draft.id}:${draftWithAssignments.draft.status}:${draftWithAssignments.allocations.length}:${draftWithAssignments.buckets.length}`;
  }, [isDemandMode, draftWithAssignments]);

  const demandContextSavedRef = useRef(false);

  useEffect(() => {
    if (!isDemandMode || !draftWithAssignments) return;
    const { buckets, allocations } = draftWithAssignments;

    const planningLines: PlanningLine[] = buckets.map((b) => ({
      id: b.id,
      areaName: b.distributionArea ?? '__missing__',
      name: b.planningLineName,
      sortOrder: b.sortOrder,
      createdAt: new Date(b.createdAt).getTime(),
    }));

    const workGroups: WorkGroup[] = buckets.map((b) => ({
      id: b.id,
      planningLineId: b.id,
      areaName: b.distributionArea ?? '__missing__',
      name: b.bucketName,
      createdAt: new Date(b.createdAt).getTime(),
    }));

    if (rollingDraftAudit) {
      const bucketIds = new Set(workGroups.map((group) => group.id));
      for (const [areaName, unassignedId] of rollingDraftAudit.syntheticUnassignedByArea) {
        if (bucketIds.has(unassignedId)) continue;
        planningLines.push({ id: `${unassignedId}:line`, areaName, name: 'default', sortOrder: planningLines.length, createdAt: 0 });
        workGroups.push({ id: unassignedId, planningLineId: `${unassignedId}:line`, areaName, name: 'unassigned', createdAt: 0 });
      }
    }

    const itemAllocations: ItemAllocation[] = allocations.map((a) => ({
      id: a.id,
      itemRowId: a.rawDemandRowId,
      workGroupId: a.bucketId,
      qty: a.allocatedQuantity,
      createdAt: new Date(a.createdAt).getTime(),
    })).filter((allocation) => {
      if (!rollingDraftAudit) return true;
      const bucket = buckets.find((candidate) => candidate.id === allocation.workGroupId);
      return bucket?.bucketName !== 'unassigned';
    });

    hydrateFromDraft({ planningLines, workGroups, itemAllocations });

    if (draftId && batchId && !demandContextSavedRef.current) {
      demandContextSavedRef.current = true;
      const params = new URLSearchParams(window.location.search);
      saveDemandLastContext({
        mode: 'demand',
        batchId,
        draftId,
        url: window.location.pathname + window.location.search,
        savedAt: new Date().toISOString(),
        targetDate: targetDate ?? params.get('targetDate') ?? undefined,
        sourceFile: planningPreview?.batch.sourceFile,
        sourceSheet: planningPreview?.batch.sourceSheet,
      });
    }
  }, [isDemandMode, lastDraftKey, rollingDraftAudit]);

  /* Cleanup when leaving demand mode */
  useEffect(() => {
    return () => {
      clearLocalDraft();
    };
  }, [isDemandMode]);

  /* Share orderItemMap between shift and demand modes */
  const orderItemMap = useMemo(() => {
    if (isDemandMode && demandSource) {
      return demandSource.orderItemMap;
    }
    const map: Record<string, SourceOrderItem[]> = {};
    if (!isDemandMode && drawerOrderId && drawerItemsShift.length > 0) {
      map[drawerOrderId] = drawerItemsShift;
    }
    return map;
  }, [isDemandMode, demandSource, drawerOrderId, drawerItemsShift]);

  const drawerOrder = useMemo(() => {
    if (!isDemandMode && shiftSource && drawerOrderId) {
      return shiftSource.orders.find((o) => o.orderId === drawerOrderId) ?? null;
    }
    if (isDemandMode && demandSource && drawerOrderId) {
      return demandSource.orders.find((o) => o.orderId === drawerOrderId)
        ?? demandSource.specialFlowOrders.find((o) => o.orderId === drawerOrderId)
        ?? demandSource.errorOrders.find((o) => o.orderId === drawerOrderId)
        ?? null;
    }
    return null;
  }, [isDemandMode, shiftSource, demandSource, drawerOrderId]);

  const drawerItems: SourceOrderItem[] = useMemo(() => {
    if (isDemandMode && demandSource && drawerOrderId) {
      return demandSource.orderItemMap[drawerOrderId] ?? [];
    }
    return drawerItemsShift;
  }, [isDemandMode, demandSource, drawerOrderId, drawerItemsShift]);

  const allOrders = useMemo(() => {
    if (isDemandMode && demandSource) {
      return [...demandSource.orders, ...demandSource.specialFlowOrders, ...demandSource.errorOrders];
    }
    return shiftSource?.orders ?? [];
  }, [isDemandMode, demandSource, shiftSource]);

  const orderNumberMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const o of allOrders) {
      map[o.orderId] = o.orderNumber;
    }
    return map;
  }, [allOrders]);

  const areaOrders = useMemo(() => {
    if (!allOrders || !selectedAreaName) return [];
    return allOrders.filter((o) => o.areaName === selectedAreaName);
  }, [allOrders, selectedAreaName]);

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
    setAssignFlow(null);
    setShowAssignModal(false);
    setQuantityModalState(null);
  }, []);

  const handleOpenQuantityModal = useCallback((itemRowIds: string[], workGroupId: string) => {
    if (!capabilities.canAssignOrders) return;
    setQuantityModalState({ itemRowIds, workGroupId });
  }, [capabilities.canAssignOrders]);

  const handleConfirmAllocations = useCallback(
    (allocations: { itemRowId: string; qty: number }[], workGroupId: string) => {
      if (!capabilities.canAssignOrders) return;
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
      setAssignFlow(null);
    },
    [allocateItemQty, drawerItems, capabilities.canAssignOrders, isRollingDraft, rollingDraftAudit],
  );

  const handleAssignSelected = useCallback((itemRowIds: string[]) => {
    if (!capabilities.canAssignOrders) return;
    if (targetWorkGroupId) {
      handleOpenQuantityModal(itemRowIds, targetWorkGroupId);
      return;
    }
    setAssignFlow({ itemRowIds, mode: 'selected' });
    setShowAssignModal(true);
  }, [capabilities.canAssignOrders, targetWorkGroupId, handleOpenQuantityModal]);

  const handleAssignAllUnassigned = useCallback((itemRowIds: string[]) => {
    if (!capabilities.canAssignOrders) return;
    if (targetWorkGroupId) {
      allocateItemRows(itemRowIds, targetWorkGroupId, orderItemMap);
      return;
    }
    setAssignFlow({ itemRowIds, mode: 'all-unassigned' });
    setShowAssignModal(true);
  }, [capabilities.canAssignOrders, targetWorkGroupId, allocateItemRows, orderItemMap]);

  const handleConfirmAssign = useCallback(
    (workGroupId: string) => {
      if (!capabilities.canAssignOrders) return;
      if (assignFlow?.mode === 'all-unassigned') {
        allocateItemRows(assignFlow.itemRowIds, workGroupId, orderItemMap);
        setShowAssignModal(false);
        setAssignFlow(null);
      } else {
        setShowAssignModal(false);
        handleOpenQuantityModal(assignFlow?.itemRowIds ?? [], workGroupId);
      }
    },
    [capabilities.canAssignOrders, assignFlow, allocateItemRows, handleOpenQuantityModal, orderItemMap],
  );

  const handleStartAssign = useCallback((workGroupId: string) => {
    if (!capabilities.canAssignOrders) return;
    setTargetWorkGroup(workGroupId);
  }, [capabilities.canAssignOrders, setTargetWorkGroup]);

  const handleCancelTarget = useCallback(() => {
    setTargetWorkGroup(null);
  }, [setTargetWorkGroup]);

  const quantityModalRows = useMemo(() => {
    if (!quantityModalState || !capabilities.canAssignOrders) return [];
    return quantityModalState.itemRowIds.map((id) => {
      const item = drawerItems.find((i) => i.id === id);
      const assignedQty = getAssignedQty(id);
      return {
        item: item!,
        remainingQty: Math.max(0, (item?.quantity ?? 0) - assignedQty),
        assignedQty,
      };
    }).filter((r) => r.item);
  }, [quantityModalState, capabilities.canAssignOrders, drawerItems, getAssignedQty]);

  const BANNER_DISMISS_KEY = 'wos:demand-planning:banner-dismiss';
  const [userDismissed, setUserDismissed] = useState(false);

  const bannerDismissKey = useMemo(() => {
    if (!isDemandMode || !batchId || !planningPreview) return null;
    return `${BANNER_DISMISS_KEY}:${batchId}:${draftId ?? 'no-draft'}:${planningPreview.batch.status}`;
  }, [isDemandMode, batchId, draftId, planningPreview]);

  const isBannerPermanentDismiss = useMemo(() => {
    if (!bannerDismissKey) return true;
    try {
      return localStorage.getItem(bannerDismissKey) === 'true';
    } catch {
      return false;
    }
  }, [bannerDismissKey]);

  const isBannerDismissed = userDismissed || isBannerPermanentDismiss;

  const handleDismissBanner = useCallback(() => {
    if (bannerDismissKey) {
      try {
        localStorage.setItem(bannerDismissKey, 'true');
      } catch {
        // localStorage may be unavailable
      }
      setUserDismissed(true);
    }
  }, [bannerDismissKey]);

  const createPlanPayload = useCallback(() => buildPlanPayload({
    sourceKind: draftWithAssignments?.draft.sourceKind,
    planningLines,
    workGroups,
    itemAllocations,
    rollingDraftAudit,
    draftRows: draftWithAssignments?.rows,
  }), [draftWithAssignments, planningLines, workGroups, itemAllocations, rollingDraftAudit]);

  function isDraftNotMutableError(err: unknown): boolean {
    return err instanceof BffRequestError
      ? err.code === 'DEMAND_PLANNING_DRAFT_NOT_MUTABLE'
      : err instanceof Error && (err.message.includes('DEMAND_PLANNING_DRAFT_NOT_MUTABLE') || err.message.includes('NOT_MUTABLE'));
  }

  const handleSaveDraft = useCallback(() => {
    if (!draftId || !capabilities.canSaveDraft || isPublishedDraft) return;
    setPlanBuildError(null);
    try {
      savePlan.mutate({ draftId, body: createPlanPayload() });
    } catch (error) {
      setPlanBuildError(error instanceof Error ? error.message : 'לא ניתן לבנות את תוכנית השמירה.');
    }
  }, [draftId, capabilities.canSaveDraft, isPublishedDraft, createPlanPayload, savePlan]);

  const handlePublish = useCallback(() => {
    if (!draftId || !targetShiftId) return;
    setPublishResult(null);
    setPublishError(null);
    setPublishConflicts(null);
    if (isPublishedDraft) {
      setPublishError('הטיוטה כבר פורסמה למשמרת');
      return;
    }
    if (!capabilities.canPublishToShift) return;

    const publishToShift = () => {
      publishPlan.mutate(
        { draftId, body: { targetShiftId } },
        {
          onSuccess: (data) => {
            setPublishResult({
              shiftId: data.shiftId,
              draftId: data.draftId,
              publicationId: data.publicationId,
              createdLines: data.createdLines,
              reusedLines: data.reusedLines,
              createdOrders: data.createdOrders,
              updatedOrders: data.updatedOrders,
              createdItems: data.createdItems,
              skippedRows: data.skippedRows,
              warnings: data.warnings,
            });
          },
          onError: (err) => {
            setPublishConflicts(getPublishConflicts(err));
            setPublishError(getPublishErrorMessage(err));
          },
        },
      );
    };

    let body;
    try {
      body = createPlanPayload();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'לא ניתן לבנות את תוכנית הפרסום.');
      return;
    }
    savePlan.mutate(
      { draftId, body },
      {
        onSuccess: publishToShift,
        onError: (err) => {
          if (isDraftNotMutableError(err)) {
            setPublishError('הטיוטה כבר פורסמה למשמרת');
            void refetchDraft();
            return;
          }
          setPublishError('שמירת הטיוטה נכשלה. נסה שוב.');
        },
      },
    );
  }, [draftId, targetShiftId, isPublishedDraft, capabilities.canPublishToShift, savePlan, publishPlan, createPlanPayload, refetchDraft]);

  function getPublishErrorMessage(err: unknown): string {
    if (isDraftNotMutableError(err)) return 'הטיוטה כבר פורסמה למשמרת';
    if (err instanceof BffRequestError && err.code === 'ROLLING_DEMAND_STALE_OR_UNAVAILABLE') {
      return 'הביקוש השתנה מאז יצירת הטיוטה';
    }
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('NO_PUBLISHABLE_ROWS')) return 'אין שורות לפרסום למשמרת';
    if (msg.includes('already applied') || msg.includes('NOT_MUTABLE')) return 'הטיוטה כבר פורסמה למשמרת';
    if (msg.includes('DATE_MISMATCH') || msg.includes('does not match')) return 'תאריך הביקוש לא תואם לתאריך המשמרת';
    if (msg.includes('DATE_AMBIGUOUS') || msg.includes('multiple')) return 'נמצאו כמה תאריכי אספקה שונים בביקוש';
    if (msg.includes('not active') || msg.includes('SHIFT_NOT_ACTIVE')) return 'לא ניתן לפרסם למשמרת שאינה פעילה';
    if (msg.includes('FORBIDDEN') || msg.includes('403')) return 'אין הרשאה לפרסם למשמרת הזו';
    if (msg.includes('422') || msg.includes('NO_PUBLISHABLE')) return 'אין שורות לפרסום למשמרת';
    if (msg.includes('409')) return 'הטיוטה כבר פורסמה או שהמשמרת אינה פעילה';
    return 'הפרסום למשמרת נכשל';
  }

  function getPublishConflicts(err: unknown): RollingPublishConflict[] | null {
    if (!(err instanceof BffRequestError)) return null;
    if (err.code !== 'ROLLING_DEMAND_STALE_OR_UNAVAILABLE') return null;
    if (!err.details || typeof err.details !== 'object') return null;
    const details = err.details as Record<string, unknown>;
    if (!Array.isArray(details.conflicts)) return null;
    return details.conflicts as RollingPublishConflict[];
  }

  const handleNavigateToWork = useCallback(() => {
    if (!targetShiftId) return;
    navigate(`/operator/manual/work?shiftId=${targetShiftId}`);
  }, [navigate, targetShiftId]);


  const handlePlanRemaining = useCallback(() => {
    if (!batchId || !isPublishedDraft || !hasRemainingDemand) return;
    createDraft.mutate(
      { batchId, scope: 'remaining' },
      {
        onSuccess: (result) => {
          const params = new URLSearchParams();
          params.set('batchId', batchId);
          params.set('draftId', result.draft.id);
          params.set('mode', 'demand');
          if (lineIntent) {
            params.set('intent', lineIntent);
          }
          if (targetShiftId) {
            params.set('targetShiftId', targetShiftId);
          }
          if (targetDate) {
            params.set('targetDate', targetDate);
          }
          const url = `/operator/manual/lines?${params.toString()}`;
          saveDemandLastContext({
            mode: 'demand',
            batchId,
            draftId: result.draft.id,
            url,
            targetDate: targetDate ?? undefined,
            savedAt: new Date().toISOString(),
            sourceFile: remainingPreview?.batch.sourceFile,
            sourceSheet: remainingPreview?.batch.sourceSheet,
          });
          navigate(url);
        },
      }
    );
  }, [batchId, isPublishedDraft, hasRemainingDemand, createDraft, navigate, remainingPreview, lineIntent, targetShiftId, targetDate]);

  const handleRevertPublication = useCallback(() => {
    if (!draftPublication) return;
    revertPublication.mutate(draftPublication.id, {
      onSuccess: (_data) => {
        setPublishResult(null);
        setPublishError(null);
        void refetchDraft();
      },
      onError: () => {
        void refetchDraft();
      },
    });
  }, [draftPublication, revertPublication, refetchDraft]);
  const isLoading = isDemandMode ? (draftLoading || (!isRollingDraft && previewLoading)) : hierarchyLoading;
  const error = isDemandMode ? (draftError || (!isRollingDraft ? previewError : null) || rollingDraftAuditResult.error) : hierarchyError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500" dir="rtl">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full ml-2" />
        {isDemandMode ? 'טוען נתוני תכנון...' : 'טוען נתוני משמרת...'}
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

  if (isDemandMode && !demandSource) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500" dir="rtl">
        לא התקבלו נתוני תכנון
      </div>
    );
  }

  if (!isDemandMode && !shiftSource) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500" dir="rtl">
        לא התקבלו נתונים
      </div>
    );
  }

  const source = isDemandMode ? demandSource! : shiftSource!;

  return (
    <div className="flex-1 flex flex-col bg-gray-50" dir="rtl">

      {/* Demand mode banner */}
      {isDemandMode && !isBannerDismissed && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-900">{isRollingDraft ? 'תכנון מכל הביקוש הזמין' : 'תכנון ביקוש גולמי מ-DataSheet'}</p>
            <div className="text-xs text-amber-700 mt-0.5 space-y-0.5">
              {planningPreview && (
                <p>קובץ: {planningPreview.batch.sourceFile} | גיליון: {planningPreview.batch.sourceSheet} | סטטוס: {planningPreview.batch.status}</p>
              )}
              <p>{isPublishedDraft ? 'הטיוטה כבר פורסמה למשמרת ונשארת לקריאה בלבד' : isRollingDraft ? 'הטיוטה כוללת את הביקוש הזמין למשמרת ונמצאת בשלב תכנון בלבד' : 'לא שויך למשמרת — הנתונים מגיעים מ-DataSheet ונמצאים בשלב תכנון בלבד'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismissBanner}
            className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors p-0.5"
            aria-label="סגור"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Compact toolbar — area selector pills + view switch */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-1.5 flex items-center gap-2">
        <AreaOverview
          areas={source.areas}
          selectedAreaName={selectedAreaName}
          onSelectArea={setSelectedArea}
        />
        {isDemandMode && selectedAreaName && (
          <div className="flex items-center gap-1 mr-auto">
            <button
              type="button"
              onClick={() => setViewMode('available-orders')}
              className={`text-xs rounded-full px-3 py-1 font-medium transition-colors ${
                viewMode === 'available-orders'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              הזמנות זמינות
            </button>
            <button
              type="button"
              onClick={() => setViewMode('work-lines')}
              className={`text-xs rounded-full px-3 py-1 font-medium transition-colors ${
                viewMode === 'work-lines'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              קווי עבודה
            </button>
          </div>
        )}
        {isDemandMode && viewMode === 'work-lines' && (
          <div className="md:hidden ms-auto">
            <button
              type="button"
              onClick={() => setShowOrders((v) => !v)}
              className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600"
            >
              סיכום ({workGroups.length} קבו׳)
            </button>
          </div>
        )}
      </div>

      {/* Main board area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left rail (appears on the right in RTL) - responsive */}
        <aside className="hidden md:flex w-72 xl:w-80 shrink-0 border-e border-gray-200 bg-gray-50 p-2 flex-col gap-2 overflow-y-auto">
          {isDemandMode && (
            <PublishSummary
              orders={source.orders}
              orderItemMap={orderItemMap}
              draftUiMode={draftUiMode}
              publishUiMode={publishUiMode}
              canPublish={capabilities.canPublishToShift}
              isPublishing={savePlan.isPending || publishPlan.isPending}
              onPublish={handlePublish}
              publishResult={publishResult}
              publishError={publishError}
              publishConflicts={publishConflicts}
              onNavigateToWork={targetShiftId ? handleNavigateToWork : undefined}
              hasRemainingDemand={hasRemainingDemand}
              isCreatingRemainingDraft={createDraft.isPending}
              onPlanRemaining={handlePlanRemaining}
              canRevert={canRevert}
              revertBlockedReason={revertBlockedReason}
              isReverting={revertPublication.isPending}
              onRevert={canRevert ? handleRevertPublication : undefined}
              intent={lineIntent}
            />
          )}

          {isDemandMode ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm space-y-2">
              <p className="font-bold text-blue-800">{isPublishedDraft ? 'פורסם למשמרת' : 'תכנון ביקוש'}</p>
              <p className="text-xs text-blue-700">
                אזורים: {source.areas.length} | הזמנות: {source.orders.length} | סה"כ כמות:{' '}
                {source.orders.reduce((s, o) => s + o.totalQuantity, 0)}
              </p>
              {demandSource && demandSource.specialFlowItems.length > 0 && (
                <p className="text-xs text-amber-700">
                  Special Flow: {demandSource.specialFlowItems.length} שורות
                </p>
              )}
              {demandSource && demandSource.errorItems.length > 0 && (
                <p className="text-xs text-red-600">
                  שגיאות: {demandSource.errorItems.length} שורות
                </p>
              )}
              {isPublishedDraft && (
                <p className="text-xs font-semibold text-blue-800">
                  הבנאי במצב קריאה בלבד. ל-append/diff השתמש במסלול הנפרד.
                </p>
              )}
              {capabilities.canSaveDraft && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={savePlan.isPending}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Save size={14} />
                  {savePlan.isPending ? 'שומר...' : 'שמור טיוטה'}
                </button>
              )}
              {savePlan.isSuccess && (
                <p className="text-xs text-green-700 font-semibold">הטיוטה נשמרה</p>
              )}
              {savePlan.isError && (
                <div role="alert" className="rounded-md border-2 border-red-500 bg-red-50 p-3 text-sm font-semibold text-red-800">
                  <div>שמירת הטיוטה נכשלה</div>
                  {savePlan.error instanceof BffRequestError && savePlan.error.code && (
                    <div className="font-mono text-xs" dir="ltr">{savePlan.error.code}</div>
                  )}
                  <div>{savePlan.error?.message}</div>
                </div>
              )}
              {planBuildError && (
                <div role="alert" className="rounded-md border-2 border-red-500 bg-red-50 p-3 text-sm font-semibold text-red-800">
                  <div>שמירת הטיוטה נכשלה</div>
                  <div>{planBuildError}</div>
                </div>
              )}
            </div>
          ) : (
            <ProblemQueue
              orders={areaOrders.length > 0 ? areaOrders : source.orders}
              orderItemMap={orderItemMap}
            />
          )}
        </aside>

        {/* Center board */}
        <div className="flex-1 flex flex-col min-h-0">
          {isPublishedDraft && (
            <div className="shrink-0 border-b border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
              טיוטה זו כבר פורסמה למשמרת. העריכה והשמירה מושבתות, ו-append/diff נשארים בזרימה נפרדת.
            </div>
          )}

          {isDemandMode && viewMode === 'available-orders' && draftId ? (
            <DemandExplorerView
              draftId={draftId}
              distributionArea={selectedAreaName}
            />
          ) : (
            <>
              {capabilities.canAssignOrders && targetWg && (
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
                    capabilities={capabilities}
                    orderNumberMap={orderNumberMap}
                    sourceOrders={source.orders}
                    isShiftMode={!isDemandMode}
                    shiftId={!isDemandMode && shiftId ? shiftId : null}
                    onShowUnassignedOrders={isDemandMode ? () => {
                      setShowOrders(true);
                      setStatusFilter('unassigned');
                    } : undefined}
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
            </>
          )}
        </div>
      </main>

      {drawerOrder && (
        <ItemsDrawerV2
          order={drawerOrder}
          items={drawerItems}
          isLoading={false}
          isError={false}
          onClose={handleCloseItemsDrawer}
          onAssignSelected={handleAssignSelected}
          onAssignAllUnassigned={handleAssignAllUnassigned}
          targetWorkGroupName={targetWg?.name ?? null}
          capabilities={capabilities}
        />
      )}

      {capabilities.canAssignOrders && (
        <>
          <AssignModalV2
            isOpen={showAssignModal}
            onClose={() => { setShowAssignModal(false); setAssignFlow(null); }}
            targetAreaName={selectedAreaName}
            itemCount={assignFlow?.itemRowIds.length ?? 0}
            onAssign={handleConfirmAssign}
          />

          {quantityModalState && (
            <QuantityAllocationModal
              isOpen={true}
              onClose={() => { setQuantityModalState(null); setAssignFlow(null); }}
              itemRows={quantityModalRows}
              workGroupName={getWorkGroup(quantityModalState.workGroupId)?.name ?? ''}
              onConfirm={(allocs) => handleConfirmAllocations(allocs, quantityModalState.workGroupId)}
            />
          )}
        </>
      )}
    </div>
  );
}
