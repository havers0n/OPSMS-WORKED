import type { Floor } from '@wos/domain';

export type FloorDeepLinkResolution =
  | { status: 'idle' }
  | { status: 'resolving' }
  | { status: 'found'; siteId: string; floorId: string }
  | { status: 'not-found' };

export type FloorDeepLinkAction =
  | { type: 'none' }
  | { type: 'select-site'; siteId: string }
  | { type: 'select-floor'; floorId: string };

export function resolveFloorDeepLink(input: {
  targetFloorId: string | null;
  sites: Array<{ id: string }>;
  floorListsBySiteId: Map<string, Floor[]>;
  isSitesLoading: boolean;
  pendingSiteFloorQueries: Set<string>;
}): FloorDeepLinkResolution {
  if (!input.targetFloorId) {
    return { status: 'idle' };
  }

  if (input.isSitesLoading) {
    return { status: 'resolving' };
  }

  for (const site of input.sites) {
    const floor = input.floorListsBySiteId
      .get(site.id)
      ?.find((candidate) => candidate.id === input.targetFloorId);

    if (floor) {
      return {
        status: 'found',
        siteId: floor.siteId,
        floorId: floor.id
      };
    }
  }

  const hasPendingFloorQuery = input.sites.some((site) => input.pendingSiteFloorQueries.has(site.id));
  if (hasPendingFloorQuery) {
    return { status: 'resolving' };
  }

  return { status: 'not-found' };
}

export function getFloorDeepLinkAction(input: {
  resolution: FloorDeepLinkResolution;
  activeSiteId: string | null;
  activeFloorId: string | null;
}): FloorDeepLinkAction {
  if (input.resolution.status !== 'found') {
    return { type: 'none' };
  }

  if (input.activeSiteId !== input.resolution.siteId) {
    return { type: 'select-site', siteId: input.resolution.siteId };
  }

  if (input.activeFloorId !== input.resolution.floorId) {
    return { type: 'select-floor', floorId: input.resolution.floorId };
  }

  return { type: 'none' };
}
