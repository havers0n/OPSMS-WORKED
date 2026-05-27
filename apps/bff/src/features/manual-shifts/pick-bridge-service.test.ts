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
    ...overrides
  };
}

function buildTaskDetail(taskId: string, orderId: string, assignedTo: string): PickTaskDetail {
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
    findWorkerById: vi.fn(async () => null),
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
    createOrder: vi.fn(async () => { throw new Error('not used'); }),
    createOrderError: vi.fn(async () => { throw new Error('not used'); }),
    createLineEvent: vi.fn(async () => { throw new Error('not used'); }),
    listShiftErrors: vi.fn(async () => [])
  };
}

function createPickBridgeRepoMock(): PickBridgeRepo & {
  _tasks: Array<{ id: string; sourceType: string; sourceId: string; assignedTo: string }>;
} {
  const tasks: Array<{ id: string; sourceType: string; sourceId: string; assignedTo: string }> = [];
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
        assignedTo: input.assignedTo
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

  it('rejects order without pickerWorkerId', async () => {
    const order = createOrder({ pickerWorkerId: null });
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

  it('assignedTo equals order.pickerWorkerId', async () => {
    const order = createOrder({ pickerWorkerId: ids.worker });
    const shiftsRepo = createManualShiftsRepoMock(order);
    const bridgeRepo = createPickBridgeRepoMock();
    const service = createPickBridgeService(shiftsRepo, bridgeRepo, { getNowIso: () => nowIso });

    const result = await service.startPicking({ tenantId: ids.tenant, orderId: ids.order, actor });

    expect(result.assignedTo).toBe(ids.worker);
    expect(bridgeRepo.createPickTask).toHaveBeenCalledWith(
      expect.objectContaining({ assignedTo: ids.worker })
    );
  });
});
