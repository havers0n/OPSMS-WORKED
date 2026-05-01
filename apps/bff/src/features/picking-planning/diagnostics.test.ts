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
