import { describe, expect, it } from 'vitest';
import type { PickingMethod } from './picking-planning';
import {
  DEFAULT_PICKING_STRATEGIES,
  DEFAULT_PICKING_STRATEGY_METHOD,
  getDefaultPickingStrategy,
  isPickingMethod,
  isPostSortRequired,
  requiresCartSlots
} from './picking-strategies';

const METHODS: PickingMethod[] = [
  'single_order',
  'batch',
  'wave_bulk',
  'cluster',
  'zone',
  'pick_and_pack',
  'two_step'
];

describe('picking strategy defaults', () => {
  it('has a default strategy for every known method', () => {
    for (const method of METHODS) {
      expect(DEFAULT_PICKING_STRATEGIES[method]).toBeDefined();
      expect(DEFAULT_PICKING_STRATEGIES[method].method).toBe(method);
    }
  });

  it('returns single_order strategy by default', () => {
    const defaultStrategy = getDefaultPickingStrategy();

    expect(DEFAULT_PICKING_STRATEGY_METHOD).toBe('single_order');
    expect(defaultStrategy.method).toBe('single_order');
  });

  it('returns defensive copies to avoid mutating defaults', () => {
    const strategyA = getDefaultPickingStrategy('batch');
    const strategyB = getDefaultPickingStrategy('batch');

    expect(strategyA).not.toBe(strategyB);
    expect(strategyA.splitPolicy).not.toBe(strategyB.splitPolicy);

    strategyA.splitPolicy.maxPickLines = 999;

    expect(getDefaultPickingStrategy('batch').splitPolicy.maxPickLines).toBe(25);
    expect(DEFAULT_PICKING_STRATEGIES.batch.splitPolicy.maxPickLines).toBe(25);
  });

  it('flags post-sort methods correctly', () => {
    expect(isPostSortRequired('batch')).toBe(true);
    expect(isPostSortRequired('wave_bulk')).toBe(true);
    expect(isPostSortRequired('single_order')).toBe(false);
  });

  it('returns cluster cart slot and separation defaults', () => {
    const cluster = getDefaultPickingStrategy('cluster');

    expect(requiresCartSlots('cluster')).toBe(true);
    expect(cluster.preserveOrderSeparation).toBe(true);
  });

  it('uses handling route mode for pick_and_pack', () => {
    expect(getDefaultPickingStrategy('pick_and_pack').routePriorityMode).toBe('handling');
  });

  it('single_order preserves separation without post-sort', () => {
    const strategy = getDefaultPickingStrategy('single_order');

    expect(strategy.preserveOrderSeparation).toBe(true);
    expect(strategy.requiresPostSort).toBe(false);
  });

  it('rejects unknown picking method values', () => {
    expect(isPickingMethod('batch')).toBe(true);
    expect(isPickingMethod('unknown_method')).toBe(false);
    expect(isPickingMethod(null)).toBe(false);
    expect(isPickingMethod(42)).toBe(false);
  });

  it('keeps split policies present and positive', () => {
    for (const method of METHODS) {
      const splitPolicy = getDefaultPickingStrategy(method).splitPolicy;
      expect(splitPolicy.maxPickLines).toBeGreaterThan(0);
      expect(splitPolicy.maxEstimatedPickTimeSec).toBeGreaterThan(0);
      expect(splitPolicy.maxWeightKg).toBeGreaterThan(0);
      expect(splitPolicy.maxVolumeLiters).toBeGreaterThan(0);
      expect(splitPolicy.maxUniqueLocations).toBeGreaterThan(0);
      expect(splitPolicy.maxZones).toBeGreaterThan(0);
    }
  });
});
