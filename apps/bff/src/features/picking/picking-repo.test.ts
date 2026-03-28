import { describe, expect, it, vi } from 'vitest';
import { createPickingRepo } from './repo.js';
import { PickTaskNotFoundError } from './errors.js';

const ids = {
  task: '11111111-1111-4111-8111-111111111111'
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
