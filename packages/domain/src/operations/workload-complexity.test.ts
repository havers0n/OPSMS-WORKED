import { describe, expect, it } from 'vitest';
import type { PickTaskCandidate, PickingStrategy } from './picking-planning';
import { getDefaultPickingStrategy } from './picking-strategies';
import { estimateWorkloadComplexity } from './workload-complexity';

function makeTask(overrides: Partial<PickTaskCandidate> = {}): PickTaskCandidate {
  return {
    id: 'task-1',
    skuId: 'sku-1',
    fromLocationId: 'loc-1',
    qty: 1,
    orderRefs: [{ orderId: 'order-1', orderLineId: 'line-1', qty: 1 }],
    ...overrides
  };
}

describe('estimateWorkloadComplexity', () => {
  it('returns low complexity with zero counts for empty workload', () => {
    const score = estimateWorkloadComplexity({ tasks: [] });

    expect(score.level).toBe('low');
    expect(score.score).toBe(0);
    expect(score.pickLines).toBe(0);
    expect(score.uniqueSkuCount).toBe(0);
    expect(score.uniqueLocationCount).toBe(0);
    expect(score.uniqueZoneCount).toBe(0);
    expect(score.uniqueAisleCount).toBe(0);
    expect(score.warnings).toEqual([]);
  });

  it('calculates expected counts for a simple workload', () => {
    const task = makeTask({ weightKg: 10, volumeLiters: 20 });

    const score = estimateWorkloadComplexity({
      tasks: [task],
      locationsById: {
        'loc-1': { id: 'loc-1', zoneId: 'zone-a', accessAisleId: 'aisle-a' }
      }
    });

    expect(score.pickLines).toBe(1);
    expect(score.uniqueSkuCount).toBe(1);
    expect(score.uniqueLocationCount).toBe(1);
    expect(score.uniqueZoneCount).toBe(1);
    expect(score.uniqueAisleCount).toBe(1);
    expect(score.totalWeightKg).toBe(10);
    expect(score.totalVolumeLiters).toBe(20);
    expect(score.score).toBe(21);
    expect(score.level).toBe('low');
  });

  it('counts repeated SKU only once as unique', () => {
    const score = estimateWorkloadComplexity({
      tasks: [
        makeTask({ id: 't1', skuId: 'sku-1' }),
        makeTask({ id: 't2', skuId: 'sku-1', fromLocationId: 'loc-2' })
      ],
      locationsById: {
        'loc-1': { id: 'loc-1' },
        'loc-2': { id: 'loc-2' }
      }
    });

    expect(score.uniqueSkuCount).toBe(1);
  });

  it('counts repeated location only once as unique', () => {
    const score = estimateWorkloadComplexity({
      tasks: [makeTask({ id: 't1' }), makeTask({ id: 't2', skuId: 'sku-2' })],
      locationsById: { 'loc-1': { id: 'loc-1' } }
    });

    expect(score.uniqueLocationCount).toBe(1);
  });

  it('uses zone precedence from location metadata', () => {
    const score = estimateWorkloadComplexity({
      tasks: [makeTask()],
      locationsById: {
        'loc-1': {
          id: 'loc-1',
          zoneId: 'zone-plain',
          pickZoneId: 'zone-pick',
          taskZoneId: 'zone-task',
          allocationZoneId: 'zone-allocation'
        }
      }
    });

    expect(score.uniqueZoneCount).toBe(1);
  });

  it('counts unique aisles from location metadata', () => {
    const score = estimateWorkloadComplexity({
      tasks: [makeTask({ id: 't1' }), makeTask({ id: 't2', fromLocationId: 'loc-2' })],
      locationsById: {
        'loc-1': { id: 'loc-1', accessAisleId: 'a1' },
        'loc-2': { id: 'loc-2', accessAisleId: 'a2' }
      }
    });

    expect(score.uniqueAisleCount).toBe(2);
  });

  it('sums total weight and volume for known dimensions', () => {
    const score = estimateWorkloadComplexity({
      tasks: [
        makeTask({ id: 't1', weightKg: 10, volumeLiters: 100 }),
        makeTask({ id: 't2', weightKg: 3.5, volumeLiters: 30, fromLocationId: 'loc-2' })
      ],
      locationsById: {
        'loc-1': { id: 'loc-1' },
        'loc-2': { id: 'loc-2' }
      }
    });

    expect(score.totalWeightKg).toBe(13.5);
    expect(score.totalVolumeLiters).toBe(130);
  });

  it('counts missing weight and volume dimensions', () => {
    const score = estimateWorkloadComplexity({
      tasks: [makeTask(), makeTask({ id: 't2', fromLocationId: 'loc-2' })],
      locationsById: {
        'loc-1': { id: 'loc-1' },
        'loc-2': { id: 'loc-2' }
      }
    });

    expect(score.unknownWeightCount).toBe(2);
    expect(score.unknownVolumeCount).toBe(2);
    expect(score.warnings).toContain('Some tasks are missing weight.');
    expect(score.warnings).toContain('Some tasks are missing volume.');
  });

  it('counts unknown source location when location metadata is missing', () => {
    const score = estimateWorkloadComplexity({
      tasks: [makeTask()]
    });

    expect(score.unknownLocationCount).toBe(1);
    expect(score.warnings).toContain('Some tasks have unknown source locations.');
  });

  it('counts handling classes including frozen as cold-like', () => {
    const score = estimateWorkloadComplexity({
      tasks: [
        makeTask({ id: 'heavy', handlingClass: 'heavy' }),
        makeTask({ id: 'bulky', handlingClass: 'bulky', fromLocationId: 'loc-2' }),
        makeTask({ id: 'fragile', handlingClass: 'fragile', fromLocationId: 'loc-3' }),
        makeTask({ id: 'cold', handlingClass: 'cold', fromLocationId: 'loc-4' }),
        makeTask({ id: 'frozen', handlingClass: 'frozen', fromLocationId: 'loc-5' }),
        makeTask({ id: 'hazmat', handlingClass: 'hazmat', fromLocationId: 'loc-6' })
      ],
      locationsById: {
        'loc-1': { id: 'loc-1' },
        'loc-2': { id: 'loc-2' },
        'loc-3': { id: 'loc-3' },
        'loc-4': { id: 'loc-4' },
        'loc-5': { id: 'loc-5' },
        'loc-6': { id: 'loc-6' }
      }
    });

    expect(score.heavyTaskCount).toBe(1);
    expect(score.bulkyTaskCount).toBe(1);
    expect(score.fragileTaskCount).toBe(1);
    expect(score.coldTaskCount).toBe(2);
    expect(score.hazmatTaskCount).toBe(1);
  });

  it('sets split policy exceed flags and warnings', () => {
    const strategy: PickingStrategy = {
      ...getDefaultPickingStrategy('single_order'),
      splitPolicy: {
        maxPickLines: 1,
        maxWeightKg: 1,
        maxVolumeLiters: 1,
        maxUniqueLocations: 1,
        maxZones: 1
      }
    };

    const score = estimateWorkloadComplexity({
      strategy,
      tasks: [
        makeTask({ id: 't1', weightKg: 2, volumeLiters: 2 }),
        makeTask({ id: 't2', fromLocationId: 'loc-2', weightKg: 2, volumeLiters: 2 })
      ],
      locationsById: {
        'loc-1': { id: 'loc-1', zoneId: 'z1' },
        'loc-2': { id: 'loc-2', zoneId: 'z2' }
      }
    });

    expect(score.exceeds).toEqual({
      maxPickLines: true,
      maxWeightKg: true,
      maxVolumeLiters: true,
      maxUniqueLocations: true,
      maxZones: true
    });

    expect(score.warnings).toContain('Workload exceeds max pick lines.');
    expect(score.warnings).toContain('Workload exceeds max weight.');
    expect(score.warnings).toContain('Workload exceeds max volume.');
    expect(score.warnings).toContain('Workload touches too many unique locations.');
    expect(score.warnings).toContain('Workload touches too many zones.');
  });

  it('uses default strategy when none is provided', () => {
    const score = estimateWorkloadComplexity({
      tasks: Array.from({ length: 26 }, (_, index) =>
        makeTask({
          id: `t-${index}`,
          skuId: `sku-${index}`,
          fromLocationId: `loc-${index}`,
          weightKg: 0,
          volumeLiters: 0
        })
      ),
      locationsById: Object.fromEntries(
        Array.from({ length: 26 }, (_, index) => [
          `loc-${index}`,
          { id: `loc-${index}`, zoneId: index < 13 ? 'z1' : 'z2' }
        ])
      )
    });

    expect(score.exceeds.maxPickLines).toBe(true);
  });

  it('escalates level for large workload', () => {
    const tasks = Array.from({ length: 60 }, (_, index) =>
      makeTask({
        id: `task-${index}`,
        skuId: `sku-${index}`,
        fromLocationId: `loc-${index}`,
        weightKg: 5,
        volumeLiters: 25,
        handlingClass: index % 2 === 0 ? 'hazmat' : 'bulky'
      })
    );

    const locationsById = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [
        `loc-${index}`,
        {
          id: `loc-${index}`,
          taskZoneId: `zone-${index % 8}`,
          accessAisleId: `aisle-${index % 10}`
        }
      ])
    );

    const score = estimateWorkloadComplexity({ tasks, locationsById });

    expect(score.level).toBe('critical');
    expect(score.score).toBeGreaterThanOrEqual(130);
  });
});
