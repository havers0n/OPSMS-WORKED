import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../errors.js';
import { createPickerService } from './service.js';
import type { PickerRepo } from './repo.js';
import type { ManualShiftsRepo } from '../manual-shifts/repo.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  worker: '22222222-2222-4222-8222-222222222222',
  workerOther: '33333333-3333-4333-8333-333333333333',
  task: '44444444-4444-4444-8444-444444444444',
  stepA: '55555555-5555-4555-8555-555555555555',
  stepB: '66666666-6666-4666-8666-666666666666',
  order: '77777777-7777-4777-8777-777777777777',
  line: '88888888-8888-4888-8888-888888888888',
  shift: '99999999-9999-4999-8999-999999999999'
};

function buildDetail(status: 'assigned' | 'in_progress' | 'completed' = 'assigned') {
  return {
    id: ids.task,
    taskNumber: 'PT-1',
    tenantId: ids.tenant,
    sourceType: 'manual_shift_order' as const,
    sourceId: ids.order,
    status,
    assignedTo: null,
    assignedWorkerId: ids.worker,
    startedAt: null,
    completedAt: status === 'completed' ? '2026-05-28T10:00:00.000Z' : null,
    createdAt: '2026-05-28T09:00:00.000Z',
    totalSteps: 2,
    completedSteps: status === 'completed' ? 2 : status === 'in_progress' ? 1 : 0,
    steps: []
  };
}

function createPickerRepoMock(): PickerRepo {
  return {
    listActiveTasksByWorker: vi.fn(async () => []),
    findAssignedTaskDetail: vi.fn(async (_tenantId, _taskId, workerId) => (workerId === ids.worker ? buildDetail('assigned') : null)),
    findStepForTask: vi.fn(async () => ({
      id: ids.stepA,
      task_id: ids.task,
      tenant_id: ids.tenant,
      qty_required: 5,
      qty_picked: 0,
      status: 'pending'
    })),
    markStepPicked: vi.fn(async () => undefined),
    listTaskSteps: vi.fn(async () => [
      { id: ids.stepA, status: 'picked' },
      { id: ids.stepB, status: 'pending' }
    ]),
    updateTaskStatus: vi.fn(async () => undefined)
  };
}

function createManualRepoMock(): ManualShiftsRepo {
  return {
    listShiftWorkers: vi.fn(),
    findWorkerById: vi.fn(async () => ({
      id: ids.worker,
      tenantId: ids.tenant,
      shiftId: ids.shift,
      name: 'Worker',
      role: 'picker' as const,
      active: true,
      sortOrder: 1,
      authUserId: null,
      createdAt: '2026-05-28T09:00:00.000Z',
      updatedAt: '2026-05-28T09:00:00.000Z'
    })),
    findWorkerByAuthUserId: vi.fn(async () => null),
    setWorkerAuthUser: vi.fn(async () => undefined),
    listBindableUsers: vi.fn(async () => []),
    createWorker: vi.fn(),
    updateWorker: vi.fn(),
    findActiveShiftByDate: vi.fn(),
    findShiftByDate: vi.fn(),
    findShiftById: vi.fn(),
    createShift: vi.fn(),
    closeShift: vi.fn(),
    listShiftLines: vi.fn(),
    listShiftLineSummaries: vi.fn(),
    findLineById: vi.fn(),
    createLine: vi.fn(),
    updateLine: vi.fn(),
    listShiftOrders: vi.fn(),
    listLineOrders: vi.fn(),
    listShiftOrderItems: vi.fn(),
    listPickerSheetItems: vi.fn(async () => []),
    listPickerSheetLineItems: vi.fn(async () => ({ orders: [], items: [] })),
    listOrderCheckUnits: vi.fn(async () => []),
    listOrderAshlamot: vi.fn(async () => []),
    listOpenShiftAshlamot: vi.fn(async () => []),
    countMonthlyImportShiftRows: vi.fn(async ({ shiftId }) => ({
      shiftId,
      activeLinesCount: 0,
      activeOrdersCount: 0,
      softDeletedLinesCount: 0,
      softDeletedOrdersCount: 0
    })),
    findOrderCheckUnitById: vi.fn(async () => null),
    findOrderAshlamaById: vi.fn(async () => null),
    createOrderCheckUnit: vi.fn(),
    updateOrderCheckUnit: vi.fn(async () => null),
    createOrderAshlama: vi.fn(),
    updateOrderAshlama: vi.fn(async () => null),
    findOrderById: vi.fn(async () => ({
      id: ids.order,
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderNumber: null,
      customerName: null,
      pointName: null,
      palletCount: 1,
      pickerName: null,
      pickerWorkerId: ids.worker,
      checkerName: null,
      lineCount: null,
      size: 'unknown' as const,
      status: 'picking' as const,
      startedAt: null,
      checkStartedAt: null,
      waitingCheckAt: null,
      checkedAt: null,
      finishedAt: null,
      comment: null,
      createdAt: '2026-05-28T09:00:00.000Z',
      updatedAt: '2026-05-28T09:00:00.000Z',
      deletedAt: null,
      deletedByProfileId: null,
      deletedByName: null,
      deleteReason: null
    })),
    createOrder: vi.fn(),
    applyDailyImport: vi.fn(async () => ({ shiftId: ids.shift, linesCreated: 0, ordersCreated: 0 })),
    createDemandImportBatch: vi.fn(),
    insertRawDemandRows: vi.fn(async () => undefined),
    getDemandImportBatch: vi.fn(),
    listRawDemandRowsByBatch: vi.fn(async () => []),
    listDemandBatchDistributionAreaSummary: vi.fn(async () => []),
    updateOrder: vi.fn(async () => null),
    createOrderEvent: vi.fn(),
    createLineEvent: vi.fn(),
    createOrderError: vi.fn(),
    listShiftErrors: vi.fn(),
    insertMonthlyImportExcludedRows: vi.fn(async () => {}),
    applyMonthlyImport: vi.fn(async () => ({
      shiftId: ids.shift,
      selectedDate: '2026-05-28',
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
    listOrderEvents: vi.fn(async () => []),
    listOrderItems: vi.fn(async (_tenantId: string, _orderId: string) => []),
    listOrdersItemRollups: vi.fn(async (_orderIds: string[]) => new Map()),
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
  };
}

describe('picker service', () => {
  it('rejects inactive worker', async () => {
    const pickerRepo = createPickerRepoMock();
    const manualRepo = createManualRepoMock();
    (manualRepo.findWorkerById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: ids.worker,
      tenantId: ids.tenant,
      shiftId: ids.shift,
      name: 'Worker',
      role: 'picker' as const,
      active: false,
      sortOrder: 1,
      authUserId: null,
      createdAt: '2026-05-28T09:00:00.000Z',
      updatedAt: '2026-05-28T09:00:00.000Z'
    });
    const service = createPickerService(pickerRepo, manualRepo);

    await expect(
      service.confirmStep({
        tenantId: ids.tenant,
        workerId: ids.worker,
        taskId: ids.task,
        stepId: ids.stepA,
        qtyPicked: 1
      })
    ).rejects.toMatchObject({ code: 'PICKER_WORKER_INACTIVE' });
  });

  it('rejects wrong-tenant worker', async () => {
    const pickerRepo = createPickerRepoMock();
    const manualRepo = createManualRepoMock();
    (manualRepo.findWorkerById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: ids.worker,
      tenantId: ids.workerOther,
      shiftId: ids.shift,
      name: 'Worker',
      role: 'picker' as const,
      active: true,
      sortOrder: 1,
      authUserId: null,
      createdAt: '2026-05-28T09:00:00.000Z',
      updatedAt: '2026-05-28T09:00:00.000Z'
    });
    const service = createPickerService(pickerRepo, manualRepo);

    await expect(
      service.confirmStep({
        tenantId: ids.tenant,
        workerId: ids.worker,
        taskId: ids.task,
        stepId: ids.stepA,
        qtyPicked: 1
      })
    ).rejects.toMatchObject({ code: 'PICKER_WORKER_FORBIDDEN' });
  });

  it('confirm step rejects wrong worker', async () => {
    const pickerRepo = createPickerRepoMock();
    const manualRepo = createManualRepoMock();
    const service = createPickerService(pickerRepo, manualRepo);

    await expect(service.confirmStep({
      tenantId: ids.tenant,
      workerId: ids.workerOther,
      taskId: ids.task,
      stepId: ids.stepA,
      qtyPicked: 1
    })).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects overpick when qtyPicked exceeds qtyRequired', async () => {
    const pickerRepo = createPickerRepoMock();
    const manualRepo = createManualRepoMock();
    (pickerRepo.findStepForTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: ids.stepA,
      task_id: ids.task,
      tenant_id: ids.tenant,
      qty_required: 3,
      qty_picked: 0,
      status: 'pending'
    });

    const service = createPickerService(pickerRepo, manualRepo);

    await expect(
      service.confirmStep({
        tenantId: ids.tenant,
        workerId: ids.worker,
        taskId: ids.task,
        stepId: ids.stepA,
        qtyPicked: 4
      })
    ).rejects.toMatchObject({ code: 'PICK_STEP_QTY_EXCEEDS_REQUIRED' });

    expect(pickerRepo.markStepPicked).not.toHaveBeenCalled();
  });

  it('confirm step updates qtyPicked and marks step picked', async () => {
    const pickerRepo = createPickerRepoMock();
    const manualRepo = createManualRepoMock();
    const findAssignedTaskDetail = pickerRepo.findAssignedTaskDetail as ReturnType<typeof vi.fn>;
    findAssignedTaskDetail
      .mockResolvedValueOnce(buildDetail('assigned'))
      .mockResolvedValueOnce(buildDetail('in_progress'));

    const service = createPickerService(pickerRepo, manualRepo, {
      getNowIso: () => '2026-05-28T10:00:00.000Z'
    });

    await service.confirmStep({
      tenantId: ids.tenant,
      workerId: ids.worker,
      taskId: ids.task,
      stepId: ids.stepA,
      qtyPicked: 3
    });

    expect(pickerRepo.markStepPicked).toHaveBeenCalledWith(ids.stepA, 3, '2026-05-28T10:00:00.000Z');
  });

  it('confirming final step marks task completed and manual-shift order waiting_check', async () => {
    const pickerRepo = createPickerRepoMock();
    const manualRepo = createManualRepoMock();
    (pickerRepo.listTaskSteps as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: ids.stepA, status: 'picked' },
      { id: ids.stepB, status: 'picked' }
    ]);
    const findAssignedTaskDetail = pickerRepo.findAssignedTaskDetail as ReturnType<typeof vi.fn>;
    findAssignedTaskDetail
      .mockResolvedValueOnce(buildDetail('in_progress'))
      .mockResolvedValueOnce(buildDetail('completed'));

    const service = createPickerService(pickerRepo, manualRepo, {
      getNowIso: () => '2026-05-28T10:10:00.000Z'
    });

    await service.confirmStep({
      tenantId: ids.tenant,
      workerId: ids.worker,
      taskId: ids.task,
      stepId: ids.stepB,
      qtyPicked: 1
    });

    expect(pickerRepo.updateTaskStatus).toHaveBeenCalledWith(ids.task, 'completed', '2026-05-28T10:10:00.000Z');
    expect(manualRepo.updateOrder).toHaveBeenCalledWith(ids.order, {
      status: 'waiting_check',
      waitingCheckAt: '2026-05-28T10:10:00.000Z'
    });
  });

  it('confirming one of multiple steps does not complete task/order yet', async () => {
    const pickerRepo = createPickerRepoMock();
    const manualRepo = createManualRepoMock();
    (pickerRepo.listTaskSteps as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: ids.stepA, status: 'picked' },
      { id: ids.stepB, status: 'pending' }
    ]);

    const findAssignedTaskDetail = pickerRepo.findAssignedTaskDetail as ReturnType<typeof vi.fn>;
    findAssignedTaskDetail
      .mockResolvedValueOnce(buildDetail('assigned'))
      .mockResolvedValueOnce(buildDetail('in_progress'));

    const service = createPickerService(pickerRepo, manualRepo, {
      getNowIso: () => '2026-05-28T10:12:00.000Z'
    });

    await service.confirmStep({
      tenantId: ids.tenant,
      workerId: ids.worker,
      taskId: ids.task,
      stepId: ids.stepA,
      qtyPicked: 1
    });

    expect(pickerRepo.updateTaskStatus).toHaveBeenCalledWith(ids.task, 'in_progress', '2026-05-28T10:12:00.000Z');
    expect(manualRepo.updateOrder).not.toHaveBeenCalled();
  });

  it('already-picked step with same qty is idempotent', async () => {
    const pickerRepo = createPickerRepoMock();
    const manualRepo = createManualRepoMock();
    (pickerRepo.findStepForTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: ids.stepA,
      task_id: ids.task,
      tenant_id: ids.tenant,
      qty_required: 5,
      qty_picked: 2,
      status: 'picked'
    });
    (pickerRepo.listTaskSteps as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: ids.stepA, status: 'picked' },
      { id: ids.stepB, status: 'pending' }
    ]);
    const findAssignedTaskDetail = pickerRepo.findAssignedTaskDetail as ReturnType<typeof vi.fn>;
    findAssignedTaskDetail
      .mockResolvedValueOnce(buildDetail('in_progress'))
      .mockResolvedValueOnce(buildDetail('in_progress'));

    const service = createPickerService(pickerRepo, manualRepo);
    await service.confirmStep({
      tenantId: ids.tenant,
      workerId: ids.worker,
      taskId: ids.task,
      stepId: ids.stepA,
      qtyPicked: 2
    });

    expect(pickerRepo.markStepPicked).not.toHaveBeenCalled();
  });

  it('already-picked step with different qty is rejected', async () => {
    const pickerRepo = createPickerRepoMock();
    const manualRepo = createManualRepoMock();
    (pickerRepo.findStepForTask as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: ids.stepA,
      task_id: ids.task,
      tenant_id: ids.tenant,
      qty_required: 5,
      qty_picked: 2,
      status: 'picked'
    });

    const service = createPickerService(pickerRepo, manualRepo);
    await expect(
      service.confirmStep({
        tenantId: ids.tenant,
        workerId: ids.worker,
        taskId: ids.task,
        stepId: ids.stepA,
        qtyPicked: 3
      })
    ).rejects.toMatchObject({ code: 'PICK_STEP_ALREADY_CONFIRMED' });
  });

  it('task with skipped step does not complete', async () => {
    const pickerRepo = createPickerRepoMock();
    const manualRepo = createManualRepoMock();
    (pickerRepo.listTaskSteps as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: ids.stepA, status: 'picked' },
      { id: ids.stepB, status: 'skipped' }
    ]);
    const findAssignedTaskDetail = pickerRepo.findAssignedTaskDetail as ReturnType<typeof vi.fn>;
    findAssignedTaskDetail
      .mockResolvedValueOnce(buildDetail('assigned'))
      .mockResolvedValueOnce(buildDetail('in_progress'));

    const service = createPickerService(pickerRepo, manualRepo, {
      getNowIso: () => '2026-05-28T10:20:00.000Z'
    });
    await service.confirmStep({
      tenantId: ids.tenant,
      workerId: ids.worker,
      taskId: ids.task,
      stepId: ids.stepA,
      qtyPicked: 1
    });

    expect(pickerRepo.updateTaskStatus).toHaveBeenCalledWith(ids.task, 'in_progress', '2026-05-28T10:20:00.000Z');
    expect(pickerRepo.updateTaskStatus).not.toHaveBeenCalledWith(ids.task, 'completed', expect.any(String));
    expect(manualRepo.updateOrder).not.toHaveBeenCalled();
  });

  describe('resolveWorker', () => {
    it('resolves worker when auth_user_id matches an active worker', async () => {
      const pickerRepo = createPickerRepoMock();
      const manualRepo = createManualRepoMock();
      (manualRepo.findWorkerByAuthUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ids.worker,
        tenantId: ids.tenant,
        shiftId: ids.shift,
        name: 'Worker',
        role: 'picker' as const,
        active: true,
        sortOrder: 1,
        authUserId: 'auth-user-1',
        createdAt: '2026-05-28T09:00:00.000Z',
        updatedAt: '2026-05-28T09:00:00.000Z'
      });
      const service = createPickerService(pickerRepo, manualRepo);

      const result = await service.resolveWorker(ids.tenant, 'auth-user-1');
      expect(result).toEqual({ workerId: ids.worker });
    });

    it('throws PICKER_WORKER_NOT_BOUND when no worker matches auth user', async () => {
      const pickerRepo = createPickerRepoMock();
      const manualRepo = createManualRepoMock();
      (manualRepo.findWorkerByAuthUserId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const service = createPickerService(pickerRepo, manualRepo);

      await expect(
        service.resolveWorker(ids.tenant, 'unknown-user')
      ).rejects.toMatchObject({ code: 'PICKER_WORKER_NOT_BOUND' });
    });

    it('throws PICKER_WORKER_INACTIVE when worker is inactive', async () => {
      const pickerRepo = createPickerRepoMock();
      const manualRepo = createManualRepoMock();
      (manualRepo.findWorkerByAuthUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: ids.worker,
        tenantId: ids.tenant,
        shiftId: ids.shift,
        name: 'Inactive',
        role: 'picker' as const,
        active: false,
        sortOrder: 1,
        authUserId: 'some-user',
        createdAt: '2026-05-28T09:00:00.000Z',
        updatedAt: '2026-05-28T09:00:00.000Z'
      });
      const service = createPickerService(pickerRepo, manualRepo);

      await expect(
        service.resolveWorker(ids.tenant, 'some-user')
      ).rejects.toMatchObject({ code: 'PICKER_WORKER_INACTIVE' });
    });
  });
});
