import { describe, expect, it } from 'vitest';
import type { PickTaskCandidate, PickingStrategy } from './picking-planning';
import { getDefaultPickingStrategy } from './picking-strategies';
import { planPickingWork } from './picking-planning-pipeline';
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

describe('planPickingWork', () => {
  it('default strategy is used when no strategy is provided', () => {
    const result = planPickingWork({ tasks: [makeTask(1)] });

    expect(result.strategy.id).toBe(getDefaultPickingStrategy().id);
  });

  it('strategyMethod selects correct default strategy', () => {
    const result = planPickingWork({ tasks: [makeTask(1)], strategyMethod: 'cluster' });

    expect(result.strategy.id).toBe(getDefaultPickingStrategy('cluster').id);
    expect(result.strategy.method).toBe('cluster');
  });

  it('explicit strategy overrides strategyMethod', () => {
    const explicit: PickingStrategy = {
      ...getDefaultPickingStrategy('batch'),
      id: 'explicit-id'
    };

    const result = planPickingWork({
      tasks: [makeTask(1)],
      strategy: explicit,
      strategyMethod: 'cluster'
    });

    expect(result.strategy.id).toBe('explicit-id');
    expect(result.rootPackage.strategyId).toBe('explicit-id');
  });

  it('root package is created by planWorkPackage()', () => {
    const input = { tasks: [makeTask(1)], strategyMethod: 'batch' as const };

    const expected = planWorkPackage(input);
    const result = planPickingWork(input);

    expect(result.rootPackage).toEqual(expected);
  });

  it('splitWorkPackage() is applied', () => {
    const strategy = {
      ...getDefaultPickingStrategy('zone'),
      splitPolicy: { maxZones: 1 }
    };

    const input = {
      tasks: [makeTask(1), makeTask(2)],
      strategy,
      locationsById: {
        'loc-1': { id: 'loc-1', zoneId: 'zone-a' },
        'loc-2': { id: 'loc-2', zoneId: 'zone-b' }
      }
    };

    const root = planWorkPackage(input);
    const expectedSplit = splitWorkPackage({ package: root, locationsById: input.locationsById });
    const result = planPickingWork(input);

    expect(result.split).toEqual(expectedSplit);
  });

  it('when package is under thresholds, result has one planned package', () => {
    const result = planPickingWork({
      tasks: [makeTask(1)],
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        splitPolicy: { maxPickLines: 10, maxZones: 5, maxWeightKg: 100, maxVolumeLiters: 100, maxUniqueLocations: 10 }
      }
    });

    expect(result.split.wasSplit).toBe(false);
    expect(result.packages).toHaveLength(1);
  });

  it('when package exceeds zone threshold, result has multiple planned packages', () => {
    const result = planPickingWork({
      tasks: [makeTask(1), makeTask(2), makeTask(3)],
      strategy: {
        ...getDefaultPickingStrategy('zone'),
        splitPolicy: { maxZones: 1 }
      },
      locationsById: {
        'loc-1': { id: 'loc-1', zoneId: 'zone-a' },
        'loc-2': { id: 'loc-2', zoneId: 'zone-b' },
        'loc-3': { id: 'loc-3', zoneId: 'zone-c' }
      }
    });

    expect(result.split.wasSplit).toBe(true);
    expect(result.packages.length).toBeGreaterThan(1);
  });

  it('route is produced for every returned split package', () => {
    const result = planPickingWork({
      tasks: [makeTask(1), makeTask(2)],
      strategy: {
        ...getDefaultPickingStrategy('zone'),
        splitPolicy: { maxZones: 1 }
      },
      locationsById: {
        'loc-1': { id: 'loc-1', zoneId: 'zone-a' },
        'loc-2': { id: 'loc-2', zoneId: 'zone-b' }
      }
    });

    expect(result.packages).toHaveLength(result.split.packages.length);
    expect(result.packages.every((plannedPackage) => plannedPackage.route.steps.length === plannedPackage.package.tasks.length)).toBe(
      true
    );
  });

  it('explicit routeMode overrides strategy routePriorityMode', () => {
    const result = planPickingWork({
      tasks: [makeTask(1)],
      strategy: {
        ...getDefaultPickingStrategy('batch'),
        routePriorityMode: 'handling'
      },
      routeMode: 'address_sequence',
      locationsById: {
        'loc-1': { id: 'loc-1', addressLabel: 'A-01-01' }
      }
    });

    expect(result.packages[0]?.route.metadata.mode).toBe('address_sequence');
  });

  it('warnings from package/split/routes are aggregated and deduplicated', () => {
    const result = planPickingWork({
      tasks: [makeTask(1), makeTask(2)],
      strategy: {
        ...getDefaultPickingStrategy('cluster'),
        splitPolicy: { maxPickLines: 1 }
      },
      routeMode: 'distance'
    });

    const duplicateWarnings = result.warnings.filter(
      (warning) => warning === 'Cluster strategy requires cart slots but no cart slot allocations exist yet.'
    );

    expect(result.warnings).toContain('Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.');
    expect(duplicateWarnings).toHaveLength(1);
    expect(result.warningDetails).toContainEqual(
      expect.objectContaining({ code: 'DISTANCE_MODE_FALLBACK', severity: 'info', source: 'route' })
    );
    expect(result.warningDetails.filter((warning) => warning.code === 'CART_REQUIRED_FOR_CLUSTER')).toHaveLength(2);
  });

  it('metadata contains packageCount, routeStepCount, taskCount, wasSplit, splitReason', () => {
    const result = planPickingWork({ tasks: [makeTask(1), makeTask(2)] });

    expect(result.metadata).toEqual({
      packageCount: result.packages.length,
      routeStepCount: result.packages.reduce((sum, plannedPackage) => sum + plannedPackage.route.steps.length, 0),
      taskCount: 2,
      wasSplit: result.split.wasSplit,
      splitReason: result.split.reason
    });
  });

  it('input tasks are not mutated', () => {
    const tasks = [makeTask(1), makeTask(2)];
    const beforeTasks = structuredClone(tasks);

    void planPickingWork({ tasks });

    expect(tasks).toEqual(beforeTasks);
  });

  it('input strategy is not mutated', () => {
    const strategy = getDefaultPickingStrategy('batch');
    const beforeStrategy = structuredClone(strategy);

    void planPickingWork({ tasks: [makeTask(1)], strategy });

    expect(strategy).toEqual(beforeStrategy);
  });

  it('empty task input returns one empty package route result with warnings', () => {
    const result = planPickingWork({ tasks: [] });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.route.steps).toEqual([]);
    expect(result.warnings).toContain('WorkPackage has no tasks.');
    expect(result.warnings).toContain('Work package is empty and was not split.');
  });

  it('distance route mode fallback warning is propagated', () => {
    const result = planPickingWork({
      tasks: [makeTask(1)],
      routeMode: 'distance'
    });

    expect(result.warnings).toContain(
      'Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.'
    );
  });

  it('cluster missing cart warning is propagated', () => {
    const result = planPickingWork({
      tasks: [makeTask(1)],
      strategyMethod: 'cluster'
    });

    expect(result.warnings).toContain('Strategy requires cart slots but no assigned cart is provided.');
    expect(result.warnings).toContain('Cluster strategy requires cart slots but no cart slot allocations exist yet.');
  });
});
