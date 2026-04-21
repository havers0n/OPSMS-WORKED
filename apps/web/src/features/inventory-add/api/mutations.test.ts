import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addInventoryItem } from './mutations';
import { bffRequest } from '@/shared/api/bff/client';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn()
}));

describe('addInventoryItem', () => {
  beforeEach(() => {
    vi.mocked(bffRequest).mockReset();
  });

  it('posts the catalog-backed inventory payload to the BFF', async () => {
    vi.mocked(bffRequest).mockResolvedValue({
      id: 'cbb1e2b2-c41a-42ec-9a17-4555cfe2cb85'
    } as never);

    await addInventoryItem({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      productId: '9f4d6839-c1a9-4820-b057-f0da8e92c222',
      quantity: 3,
      uom: 'pcs'
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/inventory', {
      method: 'POST',
      body: JSON.stringify({
        productId: '9f4d6839-c1a9-4820-b057-f0da8e92c222',
        quantity: 3,
        uom: 'pcs'
      })
    });
  });

  it('serializes optional packaging fields additively', async () => {
    vi.mocked(bffRequest).mockResolvedValue({ id: 'x' } as never);

    await addInventoryItem({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      productId: '9f4d6839-c1a9-4820-b057-f0da8e92c222',
      quantity: 12,
      uom: 'pcs',
      packagingState: 'opened',
      productPackagingLevelId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      packCount: 1
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/inventory', {
      method: 'POST',
      body: JSON.stringify({
        productId: '9f4d6839-c1a9-4820-b057-f0da8e92c222',
        quantity: 12,
        uom: 'pcs',
        packagingState: 'opened',
        productPackagingLevelId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        packCount: 1
      })
    });
  });
});
