import { describe, expect, it } from 'vitest';
import type { PickTaskCandidate, PickingStrategy } from './picking-planning';
import { getDefaultPickingStrategy } from './picking-strategies';
import { sequenceWorkPackageRoute } from './route-sequencer';
import { planWorkPackage } from './work-package-planner';

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

function makeDraft(
  tasks: PickTaskCandidate[],
  strategy: PickingStrategy = getDefaultPickingStrategy('single_order')
) {
  return planWorkPackage({ tasks, strategy });
}

describe('sequenceWorkPackageRoute', () => {
  it('empty package returns no steps and warning', () => {
    const result = sequenceWorkPackageRoute({ package: makeDraft([]) });

    expect(result.steps).toEqual([]);
    expect(result.warnings).toContain('Work package has no tasks.');
  });

  it('default mode comes from package strategy mode', () => {
    const draft = makeDraft([makeTask(1)], { ...getDefaultPickingStrategy('batch'), routePriorityMode: 'handling' });

    const result = sequenceWorkPackageRoute({ package: draft });

    expect(result.metadata.mode).toBe('handling');
  });

  it('explicit input.mode overrides package strategy mode', () => {
    const draft = makeDraft([makeTask(1)], { ...getDefaultPickingStrategy('batch'), routePriorityMode: 'handling' });

    const result = sequenceWorkPackageRoute({ package: draft, mode: 'address_sequence' });

    expect(result.metadata.mode).toBe('address_sequence');
  });

  it('each task becomes one route step with copied allocations and no cart slot invention', () => {
    const draft = makeDraft([
      makeTask(1, {
        orderRefs: [
          { orderId: 'order-a', orderLineId: 'line-a', qty: 1 },
          { orderId: 'order-b', orderLineId: 'line-b', qty: 2 }
        ]
      }),
      makeTask(2)
    ]);

    const result = sequenceWorkPackageRoute({ package: draft });

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].allocations).toEqual([
      { orderId: 'order-a', orderLineId: 'line-a', qty: 1 },
      { orderId: 'order-b', orderLineId: 'line-b', qty: 2 }
    ]);
    expect(result.steps.every((step) => step.allocations.every((allocation) => allocation.cartSlotId === undefined))).toBe(
      true
    );
  });

  it('generates handling instructions', () => {
    const draft = makeDraft([
      makeTask(1, { handlingClass: 'heavy' }),
      makeTask(2, { handlingClass: 'fragile' }),
      makeTask(3, { handlingClass: 'frozen' })
    ]);

    const result = sequenceWorkPackageRoute({ package: draft, mode: 'handling' });

    expect(result.steps.find((step) => step.taskId === 'task-1')?.handlingInstruction).toBe(
      'Heavy item. Place low / at the bottom.'
    );
    expect(result.steps.find((step) => step.taskId === 'task-2')?.handlingInstruction).toBe(
      'Fragile item. Keep above heavy items.'
    );
    expect(result.steps.find((step) => step.taskId === 'task-3')?.handlingInstruction).toBe(
      'Frozen item. Minimize time outside temperature zone.'
    );
  });

  it('location_sequence sorts by zone/aisle/route sequence/position/address', () => {
    const draft = makeDraft([makeTask(1), makeTask(2), makeTask(3)]);
    const result = sequenceWorkPackageRoute({
      package: draft,
      mode: 'location_sequence',
      locationsById: {
        'loc-1': { id: 'loc-1', taskZoneId: 'zone-b', accessAisleId: 'aisle-2', routeSequence: 2, positionAlongAisle: 2 },
        'loc-2': { id: 'loc-2', taskZoneId: 'zone-a', accessAisleId: 'aisle-1', routeSequence: 1, positionAlongAisle: 9 },
        'loc-3': { id: 'loc-3', taskZoneId: 'zone-a', accessAisleId: 'aisle-1', routeSequence: 1, positionAlongAisle: 1 }
      }
    });

    expect(result.steps[0].taskId).toMatch(/task-(2|3)/);
    expect(result.steps[1].taskId).toMatch(/task-(2|3)/);
    expect(result.steps[0].taskId).not.toBe(result.steps[1].taskId);
    expect(result.steps[2].taskId).toBe('task-1');
  });

  it('address_sequence sorts by address label', () => {
    const draft = makeDraft([makeTask(1), makeTask(2)]);
    const result = sequenceWorkPackageRoute({
      package: draft,
      mode: 'address_sequence',
      locationsById: {
        'loc-1': { id: 'loc-1', addressLabel: 'B-01-01' },
        'loc-2': { id: 'loc-2', addressLabel: 'A-01-01' }
      }
    });

    expect(result.steps.map((step) => step.taskId)).toEqual(['task-2', 'task-1']);
  });

  it('handling mode puts heavy/bulky before fragile', () => {
    const draft = makeDraft([
      makeTask(1, { handlingClass: 'fragile' }),
      makeTask(2, { handlingClass: 'heavy' }),
      makeTask(3, { handlingClass: 'bulky' })
    ]);

    const result = sequenceWorkPackageRoute({ package: draft, mode: 'handling' });

    expect(result.steps[0].taskId).toMatch(/task-(2|3)/);
    expect(result.steps[1].taskId).toMatch(/task-(2|3)/);
    expect(result.steps[0].taskId).not.toBe(result.steps[1].taskId);
    expect(result.steps[2].taskId).toBe('task-1');
  });

  it('hybrid mode prioritizes zone/aisle/position and uses handling as secondary', () => {
    const draft = makeDraft([
      makeTask(1, { handlingClass: 'fragile' }),
      makeTask(2, { handlingClass: 'heavy' }),
      makeTask(3, { handlingClass: 'normal' })
    ]);

    const result = sequenceWorkPackageRoute({
      package: draft,
      mode: 'hybrid',
      locationsById: {
        'loc-1': { id: 'loc-1', taskZoneId: 'zone-a', accessAisleId: 'a1', positionAlongAisle: 2 },
        'loc-2': { id: 'loc-2', taskZoneId: 'zone-a', accessAisleId: 'a1', positionAlongAisle: 2 },
        'loc-3': { id: 'loc-3', taskZoneId: 'zone-b', accessAisleId: 'a9', positionAlongAisle: 1 }
      }
    });

    expect(result.steps.map((step) => step.taskId)).toEqual(['task-2', 'task-1', 'task-3']);
  });

  it('distance mode falls back to hybrid and warns', () => {
    const draft = makeDraft([makeTask(1)]);

    const result = sequenceWorkPackageRoute({ package: draft, mode: 'distance' });

    expect(result.metadata.mode).toBe('hybrid');
    expect(result.warnings).toContain(
      'Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.'
    );
    expect(result.warningDetails).toContainEqual(
      expect.objectContaining({
        code: 'DISTANCE_MODE_FALLBACK',
        severity: 'info',
        message: 'Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.',
        source: 'route'
      })
    );
  });

  it('unknown locations are sorted last and warned', () => {
    const draft = makeDraft([makeTask(1), makeTask(2)]);

    const result = sequenceWorkPackageRoute({
      package: draft,
      mode: 'location_sequence',
      locationsById: {
        'loc-2': { id: 'loc-2', zoneId: 'zone-a', accessAisleId: 'a1' }
      }
    });

    expect(result.steps.map((step) => step.taskId)).toEqual(['task-2', 'task-1']);
    expect(result.warnings.some((warning) => warning.includes('unknown source locations'))).toBe(true);
  });

  it('hazmat task warning is produced', () => {
    const draft = makeDraft([makeTask(1, { handlingClass: 'hazmat' })]);

    const result = sequenceWorkPackageRoute({ package: draft, mode: 'handling' });

    expect(result.warnings.some((warning) => warning.includes('Hazmat tasks are present'))).toBe(true);
  });

  it('cluster strategy without cart slots warning is produced', () => {
    const draft = makeDraft([makeTask(1)], getDefaultPickingStrategy('cluster'));

    const result = sequenceWorkPackageRoute({ package: draft });

    expect(result.warnings).toContain('Cluster strategy requires cart slots but no cart slot allocations exist yet.');
  });

  it('sequence numbers are 1-based and continuous', () => {
    const draft = makeDraft([makeTask(1), makeTask(2), makeTask(3)]);

    const result = sequenceWorkPackageRoute({ package: draft });

    expect(result.steps.map((step) => step.sequence)).toEqual([1, 2, 3]);
  });

  it('does not mutate input package/tasks', () => {
    const tasks = [makeTask(1), makeTask(2)];
    const draft = makeDraft(tasks);
    const beforeDraft = structuredClone(draft);
    const beforeTasks = structuredClone(tasks);

    void sequenceWorkPackageRoute({
      package: draft,
      locationsById: {
        'loc-1': { id: 'loc-1', addressLabel: 'A-01' }
      }
    });

    expect(draft).toEqual(beforeDraft);
    expect(tasks).toEqual(beforeTasks);
  });

  it('stable deterministic output for equal keys', () => {
    const draft = makeDraft([
      makeTask(1, { fromLocationId: 'loc-same', id: 'task-a' }),
      makeTask(2, { fromLocationId: 'loc-same', id: 'task-a' }),
      makeTask(3, { fromLocationId: 'loc-same', id: 'task-a' })
    ]);

    const result = sequenceWorkPackageRoute({
      package: draft,
      mode: 'location_sequence',
      locationsById: {
        'loc-same': { id: 'loc-same', zoneId: 'z', accessAisleId: 'a', routeSequence: 1, positionAlongAisle: 1 }
      }
    });

    expect(result.steps.map((step) => step.sequence)).toEqual([1, 2, 3]);
    expect(result.steps.map((step) => step.skuId)).toEqual(['sku-1', 'sku-2', 'sku-3']);
  });
});
