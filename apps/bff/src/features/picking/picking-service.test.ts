import { describe, expect, it, vi } from 'vitest';
import { createPickingServiceFromRepo } from './service.js';
import type { PickingRepo, ExecutePickStepResult } from './repo.js';

const ids = {
  task:      '11111111-1111-4111-8111-111111111111',
  step:      '22222222-2222-4222-8222-222222222222',
  container: '33333333-3333-4333-8333-333333333333',
  actor:     '44444444-4444-4444-8444-444444444444',
  movement:  '55555555-5555-4555-8555-555555555555'
};

const makeRepo = (overrides?: Partial<PickingRepo>): PickingRepo => ({
  allocatePickSteps: vi.fn(),
  executePickStep:   vi.fn(),
  ...overrides
});

// ── allocatePickSteps ─────────────────────────────────────────────────────────

describe('picking service — allocatePickSteps', () => {
  it('delegates to repo and returns result unchanged', async () => {
    const mockResult = { taskId: ids.task, allocated: 3, needsReplenishment: 0 };
    const repo = makeRepo({ allocatePickSteps: vi.fn().mockResolvedValue(mockResult) });
    const service = createPickingServiceFromRepo(repo);

    const result = await service.allocatePickSteps({ taskId: ids.task });

    expect(repo.allocatePickSteps).toHaveBeenCalledWith(ids.task);
    expect(result).toEqual(mockResult);
  });

  it('propagates repo errors unchanged', async () => {
    const err = new Error('db-boom');
    const repo = makeRepo({ allocatePickSteps: vi.fn().mockRejectedValue(err) });
    const service = createPickingServiceFromRepo(repo);

    await expect(service.allocatePickSteps({ taskId: ids.task })).rejects.toThrow('db-boom');
  });
});

// ── executePickStep ───────────────────────────────────────────────────────────

describe('picking service — executePickStep', () => {
  const mockResult: ExecutePickStepResult = {
    stepId:      ids.step,
    status:      'picked',
    qtyPicked:   3,
    taskId:      ids.task,
    taskStatus:  'completed',
    orderStatus: 'picked',
    waveStatus:  null,
    movementId:  ids.movement
  };

  it('delegates to repo with correct arguments', async () => {
    const repo = makeRepo({ executePickStep: vi.fn().mockResolvedValue(mockResult) });
    const service = createPickingServiceFromRepo(repo);

    const result = await service.executePickStep({
      stepId:         ids.step,
      qtyActual:      3,
      pickContainerId: ids.container,
      actorId:        ids.actor
    });

    expect(repo.executePickStep).toHaveBeenCalledWith(
      ids.step, 3, ids.container, ids.actor
    );
    expect(result).toEqual(mockResult);
  });

  it('passes null actorId through to repo', async () => {
    const repo = makeRepo({ executePickStep: vi.fn().mockResolvedValue(mockResult) });
    const service = createPickingServiceFromRepo(repo);

    await service.executePickStep({
      stepId:         ids.step,
      qtyActual:      3,
      pickContainerId: ids.container,
      actorId:        null
    });

    expect(repo.executePickStep).toHaveBeenCalledWith(ids.step, 3, ids.container, null);
  });

  it('propagates repo errors unchanged', async () => {
    const err = new Error('inventory-gone');
    const repo = makeRepo({ executePickStep: vi.fn().mockRejectedValue(err) });
    const service = createPickingServiceFromRepo(repo);

    await expect(
      service.executePickStep({
        stepId: ids.step, qtyActual: 3, pickContainerId: ids.container, actorId: null
      })
    ).rejects.toThrow('inventory-gone');
  });
});
