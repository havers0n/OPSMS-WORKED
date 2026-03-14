import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from './mutations';
import { bffRequest } from '@/shared/api/bff/client';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn()
}));

describe('createContainer', () => {
  beforeEach(() => {
    vi.mocked(bffRequest).mockReset();
  });

  it('posts the create-container payload to the BFF', async () => {
    vi.mocked(bffRequest).mockResolvedValue({
      id: '7d6cce5e-9a79-4710-a38b-e39adfa3eb7c'
    } as never);

    await createContainer({
      externalCode: 'PLT-23902',
      containerTypeId: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe'
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/containers', {
      method: 'POST',
      body: JSON.stringify({
        externalCode: 'PLT-23902',
        containerTypeId: '5fcaf68c-8f59-4130-a132-1fd8ab6d3cfe'
      })
    });
  });
});
