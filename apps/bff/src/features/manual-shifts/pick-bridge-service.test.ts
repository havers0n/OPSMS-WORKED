import { describe, expect, it, vi } from 'vitest';
import type { ManualShiftOrder, ManualShiftSession, PickTaskDetail } from '@wos/domain';
import { createPickBridgeService } from './pick-bridge-service.js';
import type { ManualShiftsRepo } from './repo.js';
import type { PickBridgeRepo } from './pick-bridge-repo.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  otherTenant: '22222222-2222-4222-8222-222222222222',
  shift: '33333333-3333-4333-8333-333333333333',
  line: '44444444-4444-4444-8444-444444444444',
  order: '66666666-6666-4666-8666-666666666666',
  worker: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  task: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  actor: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
};

const nowIso = '2026-05-27T08:00:00.000Z';

const actor = { actorProfileId: ids.actor, actorName: 'Dispatcher' };

function createOrder(overrides: Partial<ManualShiftOrder> = {}): ManualShiftOrder {
  return {
    id: ids.order,
    tenantId: ids.tenant,
    shiftId: ids.shift,
    lineId: ids.line,
    pointName: 'ירושלים',
    orderNumber: '502481',
    customerName: null,
    pickerName: 'יהודה',
    pickerWorkerId: ids.worker,
    checkerName: null,
    lineCount: 12,
    palletCount: 3,
    size: 'L',
    status: 'queued',
    startedAt: null,
    waitingCheckAt: null,
    checkedAt: null,
    finishedAt: null,
    comment: null,
    createdAt: '2026-05-27T06:00:00.000Z',
    updatedAt: '2026-05-27T06:00:00.000Z',
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null,
    ...overrides,
    checkStartedAt: overrides.checkStartedAt ?? null
  };
}

function buildTaskDetail(taskId: string, orderId: string, assignedTo: string | null): PickTaskDetail {
  return {
    id: taskId,
    taskNumber: 'TSK-000001',
    tenantId: ids.tenant,
    sourceType: 'manual_shift_order',
    sourceId: orderId,
    status: 'assigned',
    assignedTo,
    startedAt: null,
    completedAt: null,
    createdAt: nowIso,
    totalSteps: 1,
    completedSteps: 0,
    steps: [
      {
        id: 'step-0001',
        taskId,
        tenantId: ids.tenant,
        orderId: null,
        orderLineId: null,
        sequenceNo: 1,
        sku: '502481',
        itemName: 'ירושלים',
        qtyRequired: 3,
        qtyPicked: 0,
        status: 'pending',
        sourceCellId: null,
        sourceContainerId: null,
        inventoryUnitId: null,
        pickContainerId: null,
        executedAt: null,
        executedBy: null,
        sourceLocationCode: null,
        sourceCellAddress: null,
        sourceContainerCode: null,
        sourceFloorId: null,
        imageUrl: null
      }
    ]
  };
}

function createManualShiftsRepoMock(order: ManualShiftOrder | null): ManualShiftsRepo {
  const orders = order ? [order] : [];

  return {
    findOrderById: vi.fn(async (orderId) => orders.find((o) => o.id === orderId) ?? null),
    updateOrder: vi.fn(async (orderId, patch) => {
      const o = orders.find((x) => x.id === orderId);
      if (!o) return null;
      Object.assign(o, patch);
      return o;
    }),
    createOrderEvent: vi.fn(async () => ({
      id: 'ev-0001',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      eventType: 'status_changed' as const,
      actorProfileId: ids.actor,
      actorName: 'Dispatcher',
      fromStatus: 'queued' as const,
      toStatus: 'picking' as const,
      payload: null,
      createdAt: nowIso
    })),
    // Stubs for unused repo methods
    listShiftWorkers: vi.fn(async () => []),
    findWorkerById: vi.fn(async (workerId) => {
      if (!order?.pickerWorkerId || workerId !== order.pickerWorkerId) return null;
      return {
        id: workerId,
        tenantId: order.tenantId,
        shiftId: order.shiftId,
        name: order.pickerName ?? 'Worker',
        role: 'picker' as const,
        active: true,
        sortOrder: 0,
        authUserId: null,
        createdAt: nowIso,
        updatedAt: nowIso
      };
    }),
    createWorker: vi.fn(async () => { throw new Error('not used'); }),
    updateWorker: vi.fn(async () => null),
    findActiveShiftByDate: vi.fn(async () => null),
    findShiftByDate: vi.fn(async () => null),
    findShiftById: vi.fn(async () => null),
    createShift: vi.fn(async () => { throw new Error('not used'); }),
    closeShift: vi.fn(async () => null),
    listShiftLines: vi.fn(async () => []),
    listShiftLineSummaries: vi.fn(async () => []),
    findLineById: vi.fn(async () => null),
    createLine: vi.fn(async () => { throw new Error('not used'); }),
    updateLine: vi.fn(async () => null),
    listShiftOrders: vi.fn(async () => []),
    listLineOrders: vi.fn(async () => []),
    listOrderCheckUnits: vi.fn(async () => []),
    listOrderAshlamot: vi.fn(async () => []),
    listOpenShiftAshlamot: vi.fn(async () => []),
    listShiftOrderItems: vi.fn(async () => []),
    listPickerSheetItems: vi.fn(async () => []),
    listPickerSheetLineItems: vi.fn(async () => ({ orders: [], items: [] })),
    countMonthlyImportShiftRows: vi.fn(async ({ shiftId }) => ({
      shiftId,
      activeLinesCount: 0,
      activeOrdersCount: 0,
      softDeletedLinesCount: 0,
      softDeletedOrdersCount: 0
    })),
    findOrderCheckUnitById: vi.fn(async () => null),
    findOrderAshlamaById: vi.fn(async () => null),
    createOrderCheckUnit: vi.fn(async () => { throw new Error('not used'); }),
    updateOrderCheckUnit: vi.fn(async () => null),
    createOrderAshlama: vi.fn(async () => { throw new Error('not used'); }),
    updateOrderAshlama: vi.fn(async () => null),
    createOrder: vi.fn(async () => { throw new Error('not used'); }),
    applyDailyImport: vi.fn(async () => ({ shiftId: ids.shift, linesCreated: 0, ordersCreated: 0 })),
    createDemandImportBatch: vi.fn(async () => { throw new Error('not used'); }),
    insertRawDemandRows: vi.fn(async () => undefined),
    getDemandImportBatch: vi.fn(async () => { throw new Error('not used'); }),
    listRawDemandRowsByBatch: vi.fn(async () => []),
    listDemandBatchDistributionAreaSummary: vi.fn(async () => []),
    insertMonthlyImportExcludedRows: vi.fn(async () => {}),
    applyMonthlyImport: vi.fn(async () => ({
      shiftId: ids.shift,
      selectedDate: '2026-05-27',
      linesCreated: 0,
      ordersCreated: 0,
      orderItemsCreated: 0,
      appliedGroups: 0,
      skippedGroups: 0,
      skippedNegativeQuantityRows: 0,
      skippedZeroQuantityRows: 0,
      appliedTotalQuantity: 0,
      appliedItemLines: 0,
      excludedRowsCount: 0,
      warningSummary: {
        info: 0,
        warning: 0,
        blocking: 0
      },
      warnings: [],
      previewTotals: {
        lines: 0,
        rawDistributionValues: 0,
        derivedPoints: 0,
        uniqueOrderNumbers: 0,
        orderGroups: 0,
        skuRows: 0,
        aggregatedSkuGroups: 0,
        uniqueSkus: 0,
        totalQuantity: 0,
        rawTotalQuantity: 0,
        positiveTotalQuantity: 0,
        negativeTotalQuantity: 0,
        zeroQuantityRowsCount: 0,
        negativeQuantityRowsCount: 0,
        positiveQuantityRowsCount: 0
      },
      previewAnomalies: {
        negativeQuantityRows: 0,
        nonSoOrderRows: 0,
        rowsWithoutDistributionSlash: 0,
        pointFallbackRows: 0,
        pickupNoteRows: 0,
        ashlamaNoteRows: 0,
        specialFlowRowCount: 0,
        invalidDistributionDateRows: [],
        missingRequiredFields: []
      }
    })),
    createOrderError: vi.fn(async () => { throw new Error('not used'); }),
    createLineEvent: vi.fn(async () => { throw new Error('not used'); }),
    listShiftErrors: vi.fn(async () => []),
    listOrderEvents: vi.fn(async () => []),
    listOrderItems: vi.fn(async (_tenantId: string, _orderId: string) => []),
    listOrdersItemRollups: vi.fn(async (_orderIds: string[]) => new Map()),
    findWorkerByAuthUserId: vi.fn(async () => null),
    setWorkerAuthUser: vi.fn(async () => {}),
    listBindableUsers: vi.fn(async () => []),
    listShiftCheckUnits: vi.fn(async () => []),
    listShiftAshlamot: vi.fn(async () => []),
    listShiftWorkHierarchy: vi.fn(async () => ({ shiftId: '', areas: [] })),
    listBucketProductRollup: vi.fn(async () => []),
    checkMonthlyReplaceSafety: vi.fn(async () => ({
      canReplace: true,
      activeLinesCount: 0,
      activeOrdersCount: 0,
      startedOrdersCount: 0,
      assignedPickersCount: 0,
      assignedCheckersCount: 0,
      checkUnitsCount: 0,
      nonImportEventsCount: 0,
      blockReasons: []
    })),
    listProductControlDemand: vi.fn(async () => []),
    listWarehouseStockBySku: vi.fn(
      async () =>
        new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>()
    ),
    findLineByShiftAndName: vi.fn(async () => null),
    createDemandPlanningDraft: vi.fn(async () => ({ id: '', tenantId: '', batchId: '', status: 'draft' as const, createdBy: null, createdAt: '', updatedAt: '' })),
    getDemandPlanningDraft: vi.fn(async () => ({ id: '', tenantId: '', batchId: '', status: 'draft' as const, createdBy: null, createdAt: '', updatedAt: '' })),
    updateDemandPlanningDraftStatus: vi.fn(async () => ({ id: '', tenantId: '', batchId: '', status: 'draft' as const, createdBy: null, createdAt: '', updatedAt: '' })),
    deleteDemandPlanningBucketsByDraft: vi.fn(async () => undefined),
    insertDemandPlanningBuckets: vi.fn(async () => []),
    listDemandPlanningBuckets: vi.fn(async () => []),
    deleteDemandPlanningAllocationsByDraft: vi.fn(async () => undefined),
    insertDemandPlanningAllocations: vi.fn(async () => []),
    listDemandPlanningAllocations: vi.fn(async () => []),
    listRawDemandRowsByIds: vi.fn(async () => []),

    // Backlog methods
    findBacklogItemByIdentityKey: vi.fn(async () => null),
    findBacklogSourceLinkByRawRowId: vi.fn(async () => null),
    createBacklogItem: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000000',
      tenantId: ids.tenant,
      identityKey: 'stub',
      status: 'open' as const,
      totalQuantity: 0,
      orderNumber: null,
      customerName: null,
      sku: null,
      description: null,
      category: null,
      distributionArea: null,
      productHandlingFlow: 'regular' as const,
      routeFlow: 'unknown' as const,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      lastQuantityChangedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    })),
    updateBacklogItem: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000000',
      tenantId: ids.tenant,
      identityKey: 'stub',
      status: 'open' as const,
      totalQuantity: 0,
      orderNumber: null,
      customerName: null,
      sku: null,
      description: null,
      category: null,
      distributionArea: null,
      productHandlingFlow: 'regular' as const,
      routeFlow: 'unknown' as const,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      lastQuantityChangedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    })),
    createBacklogSourceLink: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000000',
      tenantId: ids.tenant,
      backlogItemId: '00000000-0000-4000-8000-000000000000',
      rawDemandRowId: '00000000-0000-4000-8000-000000000000',
      batchId: '00000000-0000-4000-8000-000000000000',
      mergeAction: 'new' as const,
      previousQuantity: null,
      newQuantity: null,
      quantityDelta: null,
      createdAt: nowIso
    })),
    listBacklogItems: vi.fn(async () => ({ items: [], total: 0 })),
    listBacklogItemAllocationsSum: vi.fn(async () => []),
    listBacklogSourceBatches: vi.fn(async () => []),
    getBacklogSummary: vi.fn(async () => ({
      totalItems: 0,
      totalOpenQuantity: 0,
      totalAllocatedQuantity: 0,
      totalSourceBatches: 0,
      byStatus: [],
      byDistributionArea: [],
      oldestItemSeenAt: null,
      newestItemSeenAt: null
    })),
    countBacklogDistinctBatches: vi.fn(async () => 0),
  };
}

function createPickBridgeRepoMock(): PickBridgeRepo & {
  _tasks: Array<{ id: string; sourceType: string; sourceId: string; assignedTo: string | null; assignedWorkerId: string | null }>;
} {
  const tasks: Array<{ id: string; sourceType: string; sourceId: string; assignedTo: string | null; assignedWorkerId: string | null }> = [];
  let taskCounter = 0;

  return {
    _tasks: tasks,
    findPickTaskBySource: vi.fn(async (sourceType, sourceId) => {
      return tasks.find((t) => t.sourceType === sourceType && t.sourceId === sourceId) ?? null;
    }),
    createPickTask: vi.fn(async (input) => {
      taskCounter += 1;
      const task = {
        id: `task-${String(taskCounter).padStart(4, '0')}`,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        assignedTo: input.assignedTo,
        assignedWorkerId: input.assignedWorkerId
      };
      tasks.push(task);
      return task;
    }),
    createPickStep: vi.fn(async () => undefined),
    findPickTaskDetail: vi.fn(async (taskId) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return null;
      return buildTaskDetail(task.id, task.sourceId, task.assignedTo);
    })
  };
}

describe('PickBridgeService.startPicking', () => {
  it('creates task from an assigned order', async () => {
    const order = createOrder();
    const shiftsRepo = createManualShiftsRepoMock(order);
    const bridgeRepo = createPickBridgeRepoMock();
    const service = createPickBridgeService(shiftsRepo, bridgeRepo, { getNowIso: () => nowIso });

    const result = await service.startPicking({ tenantId: ids.tenant, orderId: ids.order, actor });

    expect(result.sourceType).toBe('manual_shift_order');
    expect(result.sourceId).toBe(ids.order);
    expect(bridgeRepo.createPickTask).toHaveBeenCalledOnce();
    expect(bridgeRepo.createPickStep).toHaveBeenCalledOnce();
    expect(result.steps).toHaveLength(1);
  });

  it('creates task for a free-text picker without pickerWorkerId', async () => {
    const order = createOrder({ pickerWorkerId: null, pickerName: 'Free Picker' });
    const shiftsRepo = createManualShiftsRepoMock(order);
    const bridgeRepo = createPickBridgeRepoMock();
    const service = createPickBridgeService(shiftsRepo, bridgeRepo, { getNowIso: () => nowIso });

    await service.startPicking({ tenantId: ids.tenant, orderId: ids.order, actor });

    expect(shiftsRepo.findWorkerById).not.toHaveBeenCalled();
    expect(bridgeRepo.createPickTask).toHaveBeenCalledWith(
      expect.objectContaining({ assignedTo: null, assignedWorkerId: null })
    );
    expect(shiftsRepo.updateOrder).toHaveBeenCalledWith(
      ids.order,
      expect.objectContaining({ status: 'picking', startedAt: nowIso })
    );
  });

  it('rejects order without any picker assignment', async () => {
    const order = createOrder({ pickerWorkerId: null, pickerName: null });
    const shiftsRepo = createManualShiftsRepoMock(order);
    const bridgeRepo = createPickBridgeRepoMock();
    const service = createPickBridgeService(shiftsRepo, bridgeRepo, { getNowIso: () => nowIso });

    await expect(
      service.startPicking({ tenantId: ids.tenant, orderId: ids.order, actor })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ORDER_NO_PICKER_WORKER' });
  });

  it('repeated call returns existing task without creating a duplicate', async () => {
    const order = createOrder();
    const shiftsRepo = createManualShiftsRepoMock(order);
    const bridgeRepo = createPickBridgeRepoMock();
    const service = createPickBridgeService(shiftsRepo, bridgeRepo, { getNowIso: () => nowIso });

    const first = await service.startPicking({ tenantId: ids.tenant, orderId: ids.order, actor });
    const second = await service.startPicking({ tenantId: ids.tenant, orderId: ids.order, actor });

    expect(first.id).toBe(second.id);
    expect(bridgeRepo.createPickTask).toHaveBeenCalledOnce();
    expect(bridgeRepo.createPickStep).toHaveBeenCalledOnce();
  });

  it('sets order status to picking', async () => {
    const order = createOrder({ status: 'queued' });
    const shiftsRepo = createManualShiftsRepoMock(order);
    const bridgeRepo = createPickBridgeRepoMock();
    const service = createPickBridgeService(shiftsRepo, bridgeRepo, { getNowIso: () => nowIso });

    await service.startPicking({ tenantId: ids.tenant, orderId: ids.order, actor });

    expect(shiftsRepo.updateOrder).toHaveBeenCalledWith(
      ids.order,
      expect.objectContaining({ status: 'picking', startedAt: nowIso })
    );
    expect(shiftsRepo.createOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ fromStatus: 'queued', toStatus: 'picking' })
    );
  });

  it('assignment uses worker identity and not pickerName', async () => {
    const order = createOrder({ pickerWorkerId: ids.worker });
    const shiftsRepo = createManualShiftsRepoMock(order);
    const bridgeRepo = createPickBridgeRepoMock();
    const service = createPickBridgeService(shiftsRepo, bridgeRepo, { getNowIso: () => nowIso });

    const result = await service.startPicking({ tenantId: ids.tenant, orderId: ids.order, actor });

    expect(result.assignedTo).toBeNull();
    expect(bridgeRepo.createPickTask).toHaveBeenCalledWith(
      expect.objectContaining({ assignedTo: null, assignedWorkerId: ids.worker })
    );
  });

  it('does not move order status when task creation fails', async () => {
    const order = createOrder({ status: 'queued' });
    const shiftsRepo = createManualShiftsRepoMock(order);
    const bridgeRepo = createPickBridgeRepoMock();
    bridgeRepo.createPickTask = vi.fn(async () => {
      throw new Error('insert failed');
    });
    const service = createPickBridgeService(shiftsRepo, bridgeRepo, { getNowIso: () => nowIso });

    await expect(
      service.startPicking({ tenantId: ids.tenant, orderId: ids.order, actor })
    ).rejects.toThrow('insert failed');
    expect(shiftsRepo.updateOrder).not.toHaveBeenCalled();
    expect(shiftsRepo.createOrderEvent).not.toHaveBeenCalled();
  });

  it('creates a single pick step from the current manual shift order model', async () => {
    const order = createOrder({ lineCount: 7, palletCount: null });
    const shiftsRepo = createManualShiftsRepoMock(order);
    const bridgeRepo = createPickBridgeRepoMock();
    const service = createPickBridgeService(shiftsRepo, bridgeRepo, { getNowIso: () => nowIso });

    await service.startPicking({ tenantId: ids.tenant, orderId: ids.order, actor });

    expect(bridgeRepo.createPickStep).toHaveBeenCalledTimes(1);
    expect(bridgeRepo.createPickStep).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-0001', sequenceNo: 1 })
    );
  });
});
