import { describe, expect, it } from 'vitest';
import { rackKeys, rackInspectorQueryOptions } from '../queries';

describe('rackKeys', () => {
  it('inspector key changes when rackId changes', () => {
    expect(rackKeys.inspector('rack-a')).not.toEqual(rackKeys.inspector('rack-b'));
  });

  it('uses "none" sentinel when rackId is null', () => {
    expect(rackKeys.inspector(null)).toEqual(['rack', 'inspector', 'none']);
  });

  it('inspector key includes rackId', () => {
    expect(rackKeys.inspector('rack-x')).toEqual(['rack', 'inspector', 'rack-x']);
  });
});

describe('rackInspectorQueryOptions', () => {
  it('is disabled when rackId is null', () => {
    const opts = rackInspectorQueryOptions(null);
    expect(opts.enabled).toBe(false);
  });

  it('is enabled when rackId is provided', () => {
    const opts = rackInspectorQueryOptions('00000000-0000-4000-8000-000000000001');
    expect(opts.enabled).toBe(true);
  });

  it('has staleTime of 30 seconds', () => {
    const opts = rackInspectorQueryOptions('00000000-0000-4000-8000-000000000001');
    expect(opts.staleTime).toBe(30_000);
  });

  it('queryKey matches rackKeys.inspector', () => {
    const rackId = '00000000-0000-4000-8000-000000000001';
    const opts = rackInspectorQueryOptions(rackId);
    expect(opts.queryKey).toEqual(rackKeys.inspector(rackId));
  });
});
