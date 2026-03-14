import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addInventoryToContainer } from './mutations';
import { bffRequest } from '@/shared/api/bff/client';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn()
}));

describe('addInventoryToContainer', () => {
  beforeEach(() => {
    vi.mocked(bffRequest).mockReset();
  });

  it('posts the add-inventory payload to the container inventory endpoint', async () => {
    vi.mocked(bffRequest).mockResolvedValue({
      ok: true,
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      sku: 'CAMP-CHAIR-01',
      quantity: 12,
      uom: 'ea'
    } as never);

    await addInventoryToContainer({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      sku: 'CAMP-CHAIR-01',
      quantity: 12,
      uom: 'ea'
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/inventory', {
      method: 'POST',
      body: JSON.stringify({
        sku: 'CAMP-CHAIR-01',
        quantity: 12,
        uom: 'ea'
      })
    });
  });
});
