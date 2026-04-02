import { beforeEach, describe, expect, it, vi } from 'vitest';
import { containerKeys, containerListQueryOptions } from './queries';
import { bffRequest } from '@/shared/api/bff/client';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn()
}));

describe('containerKeys', () => {
  it('uses a stable key for the unfiltered container list', () => {
    expect(containerKeys.list()).toEqual(['container', 'list']);
    expect(containerKeys.list(undefined)).toEqual(['container', 'list']);
  });

  it('includes operationalRole in the query key when provided', () => {
    expect(containerKeys.list({ operationalRole: 'pick' })).toEqual(['container', 'list', 'pick']);
    expect(containerKeys.list({ operationalRole: 'storage' })).toEqual(['container', 'list', 'storage']);
  });

  it('produces distinct keys for different roles', () => {
    expect(containerKeys.list({ operationalRole: 'pick' })).not.toEqual(
      containerKeys.list({ operationalRole: 'storage' })
    );
  });

  it('uses a stable key for container types', () => {
    expect(containerKeys.types()).toEqual(['container', 'types']);
  });

  it('rebinds container storage when the selected container changes', () => {
    expect(containerKeys.storage('container-a')).not.toEqual(containerKeys.storage('container-b'));
    expect(containerKeys.storage(null)).toEqual(['container', 'storage', 'none']);
  });

  it('uses a dedicated stable key for canonical current location', () => {
    expect(containerKeys.currentLocation('container-a')).toEqual(['container', 'current-location', 'container-a']);
    expect(containerKeys.currentLocation(null)).toEqual(['container', 'current-location', 'none']);
  });
});

describe('containerListQueryOptions', () => {
  beforeEach(() => {
    vi.mocked(bffRequest).mockReset();
  });

  it('fetches /api/containers with no query string when no filter is given', async () => {
    vi.mocked(bffRequest).mockResolvedValue([] as never);
    const opts = containerListQueryOptions();
    await opts.queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith('/api/containers');
  });

  it('appends operationalRole query param when filter is provided', async () => {
    vi.mocked(bffRequest).mockResolvedValue([] as never);
    const opts = containerListQueryOptions({ operationalRole: 'pick' });
    await opts.queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith('/api/containers?operationalRole=pick');
  });

  it('appends storage operationalRole correctly', async () => {
    vi.mocked(bffRequest).mockResolvedValue([] as never);
    const opts = containerListQueryOptions({ operationalRole: 'storage' });
    await opts.queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith('/api/containers?operationalRole=storage');
  });
});
