import { describe, expect, it, vi } from 'vitest';
import { createPickingRepo } from './repo.js';
import {
  InvalidPickQuantityError,
  PickStepNotExecutableError,
  PickStepNotFoundError,
  PickTaskNotFoundError
} from './errors.js';

const ids = {
  task:      '11111111-1111-4111-8111-111111111111',
  step:      '22222222-2222-4222-8222-222222222222',
  container: '33333333-3333-4333-8333-333333333333',
  actor:     '44444444-4444-4444-8444-444444444444',
  movement:  '55555555-5555-4555-8555-555555555555'
};

describe('picking repo — allocatePickSteps', () => {
  it('calls allocate_pick_steps RPC with task_uuid and returns parsed result', async () => {
    const rpc = vi.fn(async () => ({
      data: { taskId: ids.task, allocated: 2, needsReplenishment: 1 },
      error: null
    }));
    const repo = createPickingRepo({ rpc } as never);

    const result = await repo.allocatePickSteps(ids.task);

    expect(rpc).toHaveBeenCalledWith('allocate_pick_steps', { task_uuid: ids.task });
    expect(result).toEqual({ taskId: ids.task, allocated: 2, needsReplenishment: 1 });
  });

  it('returns zero counts when task has no eligible steps', async () => {
    const rpc = vi.fn(async () => ({
      data: { taskId: ids.task, allocated: 0, needsReplenishment: 0 },
      error: null
    }));
    const repo = createPickingRepo({ rpc } as never);

    const result = await repo.allocatePickSteps(ids.task);

    expect(result.allocated).toBe(0);
    expect(result.needsReplenishment).toBe(0);
  });

  it('throws PickTaskNotFoundError when RPC returns PICK_TASK_NOT_FOUND', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0001', message: 'PICK_TASK_NOT_FOUND' }
    }));
    const repo = createPickingRepo({ rpc } as never);

    await expect(repo.allocatePickSteps(ids.task)).rejects.toBeInstanceOf(PickTaskNotFoundError);
  });

  it('re-throws unrecognised RPC errors unchanged', async () => {
    const raw = { code: 'PGRST116', message: 'Not Found' };
    const rpc = vi.fn(async () => ({ data: null, error: raw }));
    const repo = createPickingRepo({ rpc } as never);

    await expect(repo.allocatePickSteps(ids.task)).rejects.toMatchObject({ code: 'PGRST116' });
  });

  it('does not include role or filter parameters in the RPC call — policy is enforced in the DB', async () => {
    // Verifies that the BFF does not override the allocation policy.
    // The reserve-exclusion and primary_pick-only logic lives entirely inside
    // allocate_pick_steps().  The BFF just passes task_uuid.
    const rpc = vi.fn(async () => ({
      data: { taskId: ids.task, allocated: 1, needsReplenishment: 0 },
      error: null
    }));
    const repo = createPickingRepo({ rpc } as never);

    await repo.allocatePickSteps(ids.task);

    const call = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    const [, params] = call;
    expect(Object.keys(params)).toEqual(['task_uuid']);
  });
});

// ── executePickStep ───────────────────────────────────────────────────────────

const makeExecuteResult = (overrides?: object) => ({
  stepId:      ids.step,
  status:      'picked' as const,
  qtyPicked:   3,
  taskId:      ids.task,
  taskStatus:  'completed' as const,
  orderStatus: 'picked',
  waveStatus:  null,
  movementId:  ids.movement,
  ...overrides
});

describe('picking repo — executePickStep', () => {
  it('calls execute_pick_step RPC with correct parameter names', async () => {
    const rpc = vi.fn(async () => ({
      data: makeExecuteResult(),
      error: null
    }));
    const repo = createPickingRepo({ rpc } as never);

    await repo.executePickStep(ids.step, 3, ids.container, ids.actor);

    expect(rpc).toHaveBeenCalledWith('execute_pick_step', {
      step_uuid:           ids.step,
      qty_actual:          3,
      pick_container_uuid: ids.container,
      actor_uuid:          ids.actor
    });
  });

  it('passes null actor_uuid when actorId is null', async () => {
    const rpc = vi.fn(async () => ({
      data: makeExecuteResult(),
      error: null
    }));
    const repo = createPickingRepo({ rpc } as never);

    await repo.executePickStep(ids.step, 3, ids.container, null);

    const call = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    const [, params] = call;
    expect(params['actor_uuid']).toBeNull();
  });

  it('returns parsed result on success', async () => {
    const rpc = vi.fn(async () => ({
      data: makeExecuteResult({ status: 'partial', qtyPicked: 1, taskStatus: 'in_progress' }),
      error: null
    }));
    const repo = createPickingRepo({ rpc } as never);

    const result = await repo.executePickStep(ids.step, 1, ids.container, null);

    expect(result.status).toBe('partial');
    expect(result.qtyPicked).toBe(1);
    expect(result.taskStatus).toBe('in_progress');
  });

  it('throws PickStepNotFoundError when RPC returns PICK_STEP_NOT_FOUND', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0001', message: 'PICK_STEP_NOT_FOUND' }
    }));
    const repo = createPickingRepo({ rpc } as never);

    await expect(
      repo.executePickStep(ids.step, 3, ids.container, null)
    ).rejects.toBeInstanceOf(PickStepNotFoundError);
  });

  it('throws PickTaskNotFoundError when RPC returns PICK_TASK_NOT_FOUND', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0001', message: 'PICK_TASK_NOT_FOUND' }
    }));
    const repo = createPickingRepo({ rpc } as never);

    await expect(
      repo.executePickStep(ids.step, 3, ids.container, null)
    ).rejects.toBeInstanceOf(PickTaskNotFoundError);
  });

  it('throws PickStepNotExecutableError for PICK_STEP_NOT_EXECUTABLE', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0001', message: 'PICK_STEP_NOT_EXECUTABLE' }
    }));
    const repo = createPickingRepo({ rpc } as never);

    await expect(
      repo.executePickStep(ids.step, 3, ids.container, null)
    ).rejects.toBeInstanceOf(PickStepNotExecutableError);
  });

  it('throws PickStepNotExecutableError for PICK_STEP_NOT_ALLOCATED', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0001', message: 'PICK_STEP_NOT_ALLOCATED' }
    }));
    const repo = createPickingRepo({ rpc } as never);

    await expect(
      repo.executePickStep(ids.step, 3, ids.container, null)
    ).rejects.toBeInstanceOf(PickStepNotExecutableError);
  });

  it('throws InvalidPickQuantityError for INVALID_PICK_QUANTITY', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0001', message: 'INVALID_PICK_QUANTITY' }
    }));
    const repo = createPickingRepo({ rpc } as never);

    await expect(
      repo.executePickStep(ids.step, 0, ids.container, null)
    ).rejects.toBeInstanceOf(InvalidPickQuantityError);
  });

  it('throws InvalidPickQuantityError for PICK_QUANTITY_EXCEEDS_AVAILABLE', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0001', message: 'PICK_QUANTITY_EXCEEDS_AVAILABLE' }
    }));
    const repo = createPickingRepo({ rpc } as never);

    await expect(
      repo.executePickStep(ids.step, 999, ids.container, null)
    ).rejects.toBeInstanceOf(InvalidPickQuantityError);
  });

  it('re-throws unrecognised RPC errors unchanged', async () => {
    const raw = { code: 'PGRST116', message: 'Not Found' };
    const rpc = vi.fn(async () => ({ data: null, error: raw }));
    const repo = createPickingRepo({ rpc } as never);

    await expect(
      repo.executePickStep(ids.step, 3, ids.container, null)
    ).rejects.toMatchObject({ code: 'PGRST116' });
  });

  it('RPC params contain exactly the expected keys', async () => {
    const rpc = vi.fn(async () => ({ data: makeExecuteResult(), error: null }));
    const repo = createPickingRepo({ rpc } as never);

    await repo.executePickStep(ids.step, 3, ids.container, ids.actor);

    const call = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    const [, params] = call;
    expect(Object.keys(params).sort()).toEqual(
      ['step_uuid', 'qty_actual', 'pick_container_uuid', 'actor_uuid'].sort()
    );
  });
});
