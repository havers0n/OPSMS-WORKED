import type { Floor } from '@wos/domain';
import { describe, expect, it } from 'vitest';
import {
  getFloorDeepLinkAction,
  resolveFloorDeepLink,
  type FloorDeepLinkResolution
} from './floor-deep-link-resolution';

function floor(id: string, siteId: string): Floor {
  return {
    id,
    siteId,
    code: id.toUpperCase(),
    name: id,
    sortOrder: 0
  };
}

describe('resolveFloorDeepLink', () => {
  it('returns idle when there is no floor param', () => {
    expect(
      resolveFloorDeepLink({
        targetFloorId: null,
        sites: [{ id: 'site-a' }],
        floorListsBySiteId: new Map([['site-a', [floor('floor-a', 'site-a')]]]),
        isSitesLoading: false,
        pendingSiteFloorQueries: new Set()
      })
    ).toEqual({ status: 'idle' });
  });

  it('resolves a target floor under the current site', () => {
    expect(
      resolveFloorDeepLink({
        targetFloorId: 'floor-a',
        sites: [{ id: 'site-a' }],
        floorListsBySiteId: new Map([['site-a', [floor('floor-a', 'site-a')]]]),
        isSitesLoading: false,
        pendingSiteFloorQueries: new Set()
      })
    ).toEqual({ status: 'found', siteId: 'site-a', floorId: 'floor-a' });
  });

  it('resolves a target floor under another site', () => {
    expect(
      resolveFloorDeepLink({
        targetFloorId: 'floor-b',
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
        floorListsBySiteId: new Map([
          ['site-a', [floor('floor-a', 'site-a')]],
          ['site-b', [floor('floor-b', 'site-b')]]
        ]),
        isSitesLoading: false,
        pendingSiteFloorQueries: new Set()
      })
    ).toEqual({ status: 'found', siteId: 'site-b', floorId: 'floor-b' });
  });

  it('keeps resolving an invalid target while relevant floor queries are pending', () => {
    expect(
      resolveFloorDeepLink({
        targetFloorId: 'missing-floor',
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
        floorListsBySiteId: new Map([['site-a', [floor('floor-a', 'site-a')]]]),
        isSitesLoading: false,
        pendingSiteFloorQueries: new Set(['site-b'])
      })
    ).toEqual({ status: 'resolving' });
  });

  it('returns not-found for an invalid target after all floor queries settle', () => {
    expect(
      resolveFloorDeepLink({
        targetFloorId: 'missing-floor',
        sites: [{ id: 'site-a' }, { id: 'site-b' }],
        floorListsBySiteId: new Map([
          ['site-a', [floor('floor-a', 'site-a')]],
          ['site-b', [floor('floor-b', 'site-b')]]
        ]),
        isSitesLoading: false,
        pendingSiteFloorQueries: new Set()
      })
    ).toEqual({ status: 'not-found' });
  });

  it('does not return not-found while sites are loading', () => {
    expect(
      resolveFloorDeepLink({
        targetFloorId: 'floor-a',
        sites: [],
        floorListsBySiteId: new Map(),
        isSitesLoading: true,
        pendingSiteFloorQueries: new Set()
      })
    ).toEqual({ status: 'resolving' });
  });
});

describe('getFloorDeepLinkAction', () => {
  const found: FloorDeepLinkResolution = {
    status: 'found',
    siteId: 'site-b',
    floorId: 'floor-b'
  };

  it('selects only the floor when the active site already matches', () => {
    expect(
      getFloorDeepLinkAction({
        resolution: found,
        activeSiteId: 'site-b',
        activeFloorId: 'floor-a'
      })
    ).toEqual({ type: 'select-floor', floorId: 'floor-b' });
  });

  it('switches site before selecting a floor under another site', () => {
    expect(
      getFloorDeepLinkAction({
        resolution: found,
        activeSiteId: 'site-a',
        activeFloorId: 'floor-a'
      })
    ).toEqual({ type: 'select-site', siteId: 'site-b' });
  });

  it('selects the floor after the active site reflects the deep-link site', () => {
    expect(
      getFloorDeepLinkAction({
        resolution: found,
        activeSiteId: 'site-b',
        activeFloorId: null
      })
    ).toEqual({ type: 'select-floor', floorId: 'floor-b' });
  });

  it('is a no-op when the target floor is already selected', () => {
    expect(
      getFloorDeepLinkAction({
        resolution: found,
        activeSiteId: 'site-b',
        activeFloorId: 'floor-b'
      })
    ).toEqual({ type: 'none' });
  });

  it('is a no-op for idle resolution', () => {
    expect(
      getFloorDeepLinkAction({
        resolution: { status: 'idle' },
        activeSiteId: 'site-a',
        activeFloorId: 'floor-a'
      })
    ).toEqual({ type: 'none' });
  });
});
