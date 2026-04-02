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

  it('posts the create-container payload to the BFF (no operationalRole)', async () => {
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

  it('includes operationalRole in the payload when provided', async () => {
    vi.mocked(bffRequest).mockResolvedValue({
      id: 'a1b2c3d4-0000-0000-0000-000000000001',
      externalCode: 'TOTE-99',
      containerTypeId: 'b2c3d4e5-0000-0000-0000-000000000002',
      status: 'active',
      operationalRole: 'pick'
    } as never);

    await createContainer({
      externalCode: 'TOTE-99',
      containerTypeId: 'b2c3d4e5-0000-0000-0000-000000000002',
      operationalRole: 'pick'
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/containers', {
      method: 'POST',
      body: JSON.stringify({
        externalCode: 'TOTE-99',
        containerTypeId: 'b2c3d4e5-0000-0000-0000-000000000002',
        operationalRole: 'pick'
      })
    });
  });

  it('includes operationalRole storage when provided', async () => {
    vi.mocked(bffRequest).mockResolvedValue({} as never);

    await createContainer({
      externalCode: 'PLT-01',
      containerTypeId: 'c3d4e5f6-0000-0000-0000-000000000003',
      operationalRole: 'storage'
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/containers', {
      method: 'POST',
      body: JSON.stringify({
        externalCode: 'PLT-01',
        containerTypeId: 'c3d4e5f6-0000-0000-0000-000000000003',
        operationalRole: 'storage'
      })
    });
  });

  it('allows container creation without externalCode', async () => {
    vi.mocked(bffRequest).mockResolvedValue({} as never);

    await createContainer({
      containerTypeId: 'd4e5f6a7-0000-0000-0000-000000000004',
      operationalRole: 'pick'
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/containers', {
      method: 'POST',
      body: JSON.stringify({
        containerTypeId: 'd4e5f6a7-0000-0000-0000-000000000004',
        operationalRole: 'pick'
      })
    });
  });
});
