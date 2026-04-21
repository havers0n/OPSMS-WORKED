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
      id: 'cbb1e2b2-c41a-42ec-9a17-4555cfe2cb85',
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      itemRef: 'product:9f4d6839-c1a9-4820-b057-f0da8e92c222',
      quantity: 12,
      uom: 'ea'
    } as never);

    await addInventoryToContainer({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      productId: '9f4d6839-c1a9-4820-b057-f0da8e92c222',
      quantity: 12,
      uom: 'ea'
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/inventory', {
      method: 'POST',
      body: JSON.stringify({
        productId: '9f4d6839-c1a9-4820-b057-f0da8e92c222',
        quantity: 12,
        uom: 'ea'
      })
    });
  });

  it('includes optional packaging metadata when provided', async () => {
    vi.mocked(bffRequest).mockResolvedValue({ id: 'x' } as never);

    await addInventoryToContainer({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      productId: '9f4d6839-c1a9-4820-b057-f0da8e92c222',
      quantity: 24,
      uom: 'ea',
      packagingState: 'sealed',
      productPackagingLevelId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      packCount: 2
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/containers/188ed1eb-c44d-47f8-a8b1-94c7e20db85f/inventory', {
      method: 'POST',
      body: JSON.stringify({
        productId: '9f4d6839-c1a9-4820-b057-f0da8e92c222',
        quantity: 24,
        uom: 'ea',
        packagingState: 'sealed',
        productPackagingLevelId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        packCount: 2
      })
    });
  });
});
