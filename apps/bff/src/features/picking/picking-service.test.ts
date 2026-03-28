import { describe, expect, it, vi } from 'vitest';
import { createPickingServiceFromRepo } from './service.js';
import type { PickingRepo } from './repo.js';

const ids = {
  task: '11111111-1111-4111-8111-111111111111'
};

describe('picking service — allocatePickSteps', () => {
  it('delegates to repo and returns result unchanged', async () => {
    const mockResult = { taskId: ids.task, allocated: 3, needsReplenishment: 0 };
    const repo: PickingRepo = {
      allocatePickSteps: vi.fn().mockResolvedValue(mockResult)
    };
    const service = createPickingServiceFromRepo(repo);

    const result = await service.allocatePickSteps({ taskId: ids.task });

    expect(repo.allocatePickSteps).toHaveBeenCalledWith(ids.task);
    expect(result).toEqual(mockResult);
  });

  it('propagates repo errors unchanged', async () => {
    const err = new Error('db-boom');
    const repo: PickingRepo = {
      allocatePickSteps: vi.fn().mockRejectedValue(err)
    };
    const service = createPickingServiceFromRepo(repo);

    await expect(service.allocatePickSteps({ taskId: ids.task })).rejects.toThrow('db-boom');
  });
});
