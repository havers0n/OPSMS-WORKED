import { describe, expect, it } from 'vitest';
import { calculatePlanningCoverage, summarizeUnresolvedPlanningLines } from './diagnostics.js';

describe('picking planning diagnostics', () => {
  it('summarizes unresolved lines by reason', () => {
    const summary = summarizeUnresolvedPlanningLines([
      {
        orderId: 'o1',
        orderLineId: 'l1',
        qty: 1,
        reason: 'missing_product',
        message: 'missing product'
      },
      {
        orderId: 'o1',
        orderLineId: 'l2',
        qty: 2,
        reason: 'missing_product',
        message: 'missing product'
      },
      {
        orderId: 'o2',
        orderLineId: 'l3',
        qty: 3,
        reason: 'no_available_inventory',
        message: 'no inventory'
      }
    ]);

    expect(summary).toEqual({
      total: 3,
      byReason: {
        missing_product: 2,
        no_available_inventory: 1
      }
    });
  });

  it('calculates line and quantity coverage with zero-denominator safety', () => {
    expect(
      calculatePlanningCoverage({
        orderIds: [],
        tasks: [],
        unresolved: []
      })
    ).toEqual({
      orderCount: 0,
      orderLineCount: 0,
      plannedLineCount: 0,
      unresolvedLineCount: 0,
      plannedQty: 0,
      unresolvedQty: 0,
      planningCoveragePct: 100
    });

    const coverage = calculatePlanningCoverage({
      orderIds: ['o1', 'o2'],
      tasks: [
        {
          id: 't1',
          skuId: 'sku-1',
          fromLocationId: 'loc-1',
          qty: 4,
          orderRefs: [{ orderId: 'o1', orderLineId: 'l1', qty: 4 }]
        }
      ],
      unresolved: [
        {
          orderId: 'o2',
          orderLineId: 'l2',
          qty: 2,
          reason: 'no_primary_pick_location',
          message: 'missing location'
        }
      ]
    });

    expect(coverage).toEqual({
      orderCount: 2,
      orderLineCount: 2,
      plannedLineCount: 1,
      unresolvedLineCount: 1,
      plannedQty: 4,
      unresolvedQty: 2,
      planningCoveragePct: 50
    });
  });

  it('counts a partially fulfilled line as unresolved, not fully planned (test A)', () => {
    // Same line appears in both tasks (partial allocation) and unresolved.
    const coverage = calculatePlanningCoverage({
      orderIds: ['o1'],
      tasks: [
        {
          id: 't1',
          skuId: 'sku-1',
          fromLocationId: 'loc-1',
          qty: 4,
          orderRefs: [{ orderId: 'o1', orderLineId: 'l1', qty: 4 }]
        }
      ],
      unresolved: [
        {
          orderId: 'o1',
          orderLineId: 'l1',
          qty: 6,
          reason: 'no_available_inventory',
          message: 'insufficient stock'
        }
      ]
    });

    expect(coverage).toEqual({
      orderCount: 1,
      orderLineCount: 1,
      plannedLineCount: 0,
      unresolvedLineCount: 1,
      plannedQty: 4,
      unresolvedQty: 6,
      planningCoveragePct: 0
    });
  });

  it('counts a fully fulfilled line as planned (test B)', () => {
    const coverage = calculatePlanningCoverage({
      orderIds: ['o1'],
      tasks: [
        {
          id: 't1',
          skuId: 'sku-1',
          fromLocationId: 'loc-1',
          qty: 10,
          orderRefs: [{ orderId: 'o1', orderLineId: 'l1', qty: 10 }]
        }
      ],
      unresolved: []
    });

    expect(coverage).toEqual({
      orderCount: 1,
      orderLineCount: 1,
      plannedLineCount: 1,
      unresolvedLineCount: 0,
      plannedQty: 10,
      unresolvedQty: 0,
      planningCoveragePct: 100
    });
  });

  it('handles mixed order with fully planned, partially fulfilled, and unsupported_uom (test C)', () => {
    const coverage = calculatePlanningCoverage({
      orderIds: ['o1'],
      tasks: [
        {
          id: 'tA',
          skuId: 'sku-A',
          fromLocationId: 'loc-A',
          qty: 5,
          orderRefs: [{ orderId: 'o1', orderLineId: 'lA', qty: 5 }]
        },
        {
          id: 'tB',
          skuId: 'sku-B',
          fromLocationId: 'loc-B',
          qty: 3,
          orderRefs: [{ orderId: 'o1', orderLineId: 'lB', qty: 3 }]
        }
      ],
      unresolved: [
        {
          orderId: 'o1',
          orderLineId: 'lB',
          qty: 2,
          reason: 'no_available_inventory',
          message: 'insufficient stock for line B'
        },
        {
          orderId: 'o1',
          orderLineId: 'lC',
          qty: 5,
          reason: 'unsupported_uom',
          message: 'unsupported UOM for line C'
        }
      ]
    });

    // lA fully planned, lB partially fulfilled + unresolved, lC unsupported_uom
    expect(coverage.orderLineCount).toBe(3);
    expect(coverage.plannedLineCount).toBe(1);
    expect(coverage.unresolvedLineCount).toBe(2);
    expect(coverage.planningCoveragePct).toBeCloseTo(33.3, 0);
    expect(coverage.planningCoveragePct).toBeGreaterThanOrEqual(0);
    expect(coverage.planningCoveragePct).toBeLessThanOrEqual(100);
  });

  it('deduplicates unresolved lines when counting coverage, even if duplicate entries exist (test 6)', () => {
    const coverage = calculatePlanningCoverage({
      orderIds: ['o1'],
      tasks: [
        {
          id: 't1',
          skuId: 'sku-1',
          fromLocationId: 'loc-1',
          qty: 5,
          orderRefs: [{ orderId: 'o1', orderLineId: 'l1', qty: 5 }]
        }
      ],
      unresolved: [
        {
          orderId: 'o1',
          orderLineId: 'l2',
          qty: 5,
          reason: 'unsupported_uom',
          message: 'duplicate A'
        },
        {
          orderId: 'o1',
          orderLineId: 'l2',
          qty: 5,
          reason: 'no_available_inventory',
          message: 'duplicate B'
        }
      ]
    });

    expect(coverage.orderLineCount).toBe(2);
    expect(coverage.plannedLineCount).toBe(1);
    expect(coverage.unresolvedLineCount).toBe(1);
    expect(coverage.planningCoveragePct).toBe(50);
    expect(coverage.planningCoveragePct).toBeGreaterThanOrEqual(0);
    expect(coverage.planningCoveragePct).toBeLessThanOrEqual(100);
  });

  it('counts split tasks for the same order line once in line coverage', () => {
    const coverage = calculatePlanningCoverage({
      orderIds: ['o1'],
      tasks: [
        {
          id: 't1',
          skuId: 'sku-1',
          fromLocationId: 'loc-a',
          qty: 6,
          orderRefs: [{ orderId: 'o1', orderLineId: 'l1', qty: 6 }]
        },
        {
          id: 't2',
          skuId: 'sku-1',
          fromLocationId: 'loc-b',
          qty: 4,
          orderRefs: [{ orderId: 'o1', orderLineId: 'l1', qty: 4 }]
        }
      ],
      unresolved: []
    });

    expect(coverage).toEqual({
      orderCount: 1,
      orderLineCount: 1,
      plannedLineCount: 1,
      unresolvedLineCount: 0,
      plannedQty: 10,
      unresolvedQty: 0,
      planningCoveragePct: 100
    });
  });
});
