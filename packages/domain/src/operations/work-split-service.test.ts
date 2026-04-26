import { describe, expect, it } from 'vitest';
import type { PickTaskCandidate } from './picking-planning';
import { getDefaultPickingStrategy } from './picking-strategies';
import { planWorkPackage } from './work-package-planner';
import { splitWorkPackage } from './work-split-service';

function makeTask(index: number, overrides: Partial<PickTaskCandidate> = {}): PickTaskCandidate {
  return {
    id: `task-${index}`,
    skuId: `sku-${index}`,
    fromLocationId: `loc-${index}`,
    qty: 1,
    orderRefs: [{ orderId: `order-${index}`, orderLineId: `line-${index}`, qty: 1 }],
    ...overrides
  };
}

function collectTaskIds(packages: ReturnType<typeof splitWorkPackage>['packages']): string[] {
  return packages.flatMap((pkg) => pkg.tasks.map((task) => task.id));
}

describe('splitWorkPackage', () => {
  it('does not split package under thresholds', () => {
    const draft = planWorkPackage({
      tasks: [makeTask(1)],
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        splitPolicy: { maxPickLines: 10, maxWeightKg: 50, maxVolumeLiters: 50, maxUniqueLocations: 10, maxZones: 10 }
      }
    });

    const result = splitWorkPackage({ package: draft, locationsById: { 'loc-1': { id: 'loc-1', zoneId: 'z1' } } });

    expect(result.wasSplit).toBe(false);
    expect(result.reason).toBe('none');
    expect(result.packages).toEqual([draft]);
  });

  it('does not split empty package and preserves it', () => {
    const draft = planWorkPackage({ tasks: [] });

    const result = splitWorkPackage({ package: draft });

    expect(result.wasSplit).toBe(false);
    expect(result.packages[0]).toBe(draft);
    expect(result.warnings).toContain('Work package is empty and was not split.');
  });

  it('splits by zone when maxZones exceeded and uses zone precedence', () => {
    const tasks = [makeTask(1), makeTask(2), makeTask(3), makeTask(4)];
    const draft = planWorkPackage({
      tasks,
      strategy: {
        ...getDefaultPickingStrategy('zone'),
        splitPolicy: { maxZones: 1 }
      }
    });

    const result = splitWorkPackage({
      package: draft,
      locationsById: {
        'loc-1': { id: 'loc-1', taskZoneId: 'task-zone' },
        'loc-2': { id: 'loc-2', pickZoneId: 'pick-zone' },
        'loc-3': { id: 'loc-3', zoneId: 'zone-id' },
        'loc-4': { id: 'loc-4', allocationZoneId: 'allocation-zone' }
      }
    });

    expect(result.reason).toBe('max_zones');
    expect(result.packages).toHaveLength(4);
    expect(result.packages.map((pkg) => pkg.assignedZoneId)).toEqual([
      'task-zone',
      'pick-zone',
      'zone-id',
      'allocation-zone'
    ]);
  });

  it('keeps unknown locations in unknown group when splitting by zone', () => {
    const tasks = [makeTask(1), makeTask(2, { fromLocationId: 'missing-loc' })];
    const draft = planWorkPackage({
      tasks,
      strategy: {
        ...getDefaultPickingStrategy('zone'),
        splitPolicy: { maxZones: 0 }
      }
    });

    const result = splitWorkPackage({ package: draft, locationsById: { 'loc-1': { id: 'loc-1', zoneId: 'zone-a' } } });

    expect(result.wasSplit).toBe(true);
    expect(collectTaskIds(result.packages).sort()).toEqual(['task-1', 'task-2']);
    expect(result.warningDetails).toContainEqual(
      expect.objectContaining({ code: 'WORK_PACKAGE_SPLIT_BY_ZONE', severity: 'warning', source: 'split' })
    );
  });

  it('splits by aisle for maxUniqueLocations when accessAisleId exists', () => {
    const draft = planWorkPackage({
      tasks: [makeTask(1), makeTask(2)],
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        splitPolicy: { maxUniqueLocations: 1 }
      }
    });

    const result = splitWorkPackage({
      package: draft,
      locationsById: {
        'loc-1': { id: 'loc-1', accessAisleId: 'aisle-a' },
        'loc-2': { id: 'loc-2', accessAisleId: 'aisle-b' }
      }
    });

    expect(result.reason).toBe('max_unique_locations');
    expect(result.packages).toHaveLength(2);
  });

  it('falls back to location grouping when aisle is missing', () => {
    const draft = planWorkPackage({
      tasks: [makeTask(1), makeTask(2)],
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        splitPolicy: { maxUniqueLocations: 1 }
      }
    });

    const result = splitWorkPackage({
      package: draft,
      locationsById: {
        'loc-1': { id: 'loc-1' },
        'loc-2': { id: 'loc-2' }
      }
    });

    expect(result.reason).toBe('max_unique_locations');
    expect(result.packages).toHaveLength(2);
  });

  it('splits by weight and keeps unknown weight tasks', () => {
    const draft = planWorkPackage({
      tasks: [makeTask(1, { weightKg: 6 }), makeTask(2), makeTask(3, { weightKg: 6 })],
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        splitPolicy: { maxWeightKg: 10 }
      }
    });

    const result = splitWorkPackage({ package: draft });

    expect(result.reason).toBe('max_weight');
    expect(result.packages).toHaveLength(2);
    expect(collectTaskIds(result.packages).sort()).toEqual(['task-1', 'task-2', 'task-3']);
  });

  it('splits by volume chunks', () => {
    const draft = planWorkPackage({
      tasks: [makeTask(1, { volumeLiters: 8 }), makeTask(2, { volumeLiters: 8 })],
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        splitPolicy: { maxVolumeLiters: 10 }
      }
    });

    const result = splitWorkPackage({ package: draft });

    expect(result.reason).toBe('max_volume');
    expect(result.packages).toHaveLength(2);
  });

  it('splits by pick line chunks preserving task order', () => {
    const draft = planWorkPackage({
      tasks: [makeTask(1), makeTask(2), makeTask(3)],
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        splitPolicy: { maxPickLines: 2 }
      }
    });

    const result = splitWorkPackage({ package: draft });

    expect(result.reason).toBe('max_pick_lines');
    expect(result.packages).toHaveLength(2);
    expect(result.packages[0].tasks.map((task) => task.id)).toEqual(['task-1', 'task-2']);
    expect(result.packages[1].tasks.map((task) => task.id)).toEqual(['task-3']);
  });

  it('uses deterministic split priority: zones before weight/volume/lines', () => {
    const draft = planWorkPackage({
      tasks: [makeTask(1, { weightKg: 20 }), makeTask(2, { weightKg: 20 })],
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        splitPolicy: { maxZones: 1, maxWeightKg: 10, maxPickLines: 1 }
      }
    });

    const result = splitWorkPackage({
      package: draft,
      locationsById: {
        'loc-1': { id: 'loc-1', zoneId: 'zone-a' },
        'loc-2': { id: 'loc-2', zoneId: 'zone-b' }
      }
    });

    expect(result.reason).toBe('max_zones');
  });

  it('preserves all tasks exactly once and deterministic child ids/codes', () => {
    const draft = planWorkPackage({
      id: 'parent-id',
      code: 'PARENT',
      tasks: [makeTask(1), makeTask(2), makeTask(3)],
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        splitPolicy: { maxPickLines: 1 }
      }
    });

    const result = splitWorkPackage({ package: draft });

    expect(collectTaskIds(result.packages)).toEqual(['task-1', 'task-2', 'task-3']);
    expect(result.packages.map((pkg) => pkg.id)).toEqual(['parent-id-part-1', 'parent-id-part-2', 'parent-id-part-3']);
    expect(result.packages.map((pkg) => pkg.code)).toEqual(['PARENT-P1', 'PARENT-P2', 'PARENT-P3']);
    expect(result.packages.every((pkg) => pkg.metadata.source === 'domain_planner')).toBe(true);
  });

  it('does not mutate original package and original tasks', () => {
    const tasks = [makeTask(1), makeTask(2)];
    const draft = planWorkPackage({
      tasks,
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        splitPolicy: { maxPickLines: 1 }
      }
    });

    const beforeDraft = structuredClone(draft);
    const beforeTasks = structuredClone(tasks);

    void splitWorkPackage({ package: draft });

    expect(draft).toEqual(beforeDraft);
    expect(tasks).toEqual(beforeTasks);
  });
});
