import { describe, expect, it, vi } from 'vitest';
import { createPickingPlanningPreviewService } from './service.js';
import type { PickingPlanningInput } from '@wos/domain';

describe('picking planning preview service', () => {
  it('delegates to domain planner without additional dependencies', () => {
    const plannerResult = {
      metadata: { packageCount: 1, routeStepCount: 1, taskCount: 1, wasSplit: false, splitReason: 'none' }
    };
    const planner = vi.fn().mockReturnValue(plannerResult);
    const service = createPickingPlanningPreviewService(planner);

    const input: PickingPlanningInput = {
      strategyMethod: 'single_order' as const,
      routeMode: 'hybrid' as const,
      assignedPickerId: 'picker-1',
      assignedZoneId: 'zone-a',
      assignedCartId: 'cart-1',
      id: 'wp-preview-1',
      code: 'WP-PREVIEW-1',
      tasks: [
        {
          id: 'task-1',
          skuId: 'sku-1',
          fromLocationId: 'loc-1',
          qty: 1,
          orderRefs: [{ orderId: 'order-1', orderLineId: 'line-1', qty: 1 }]
        }
      ],
      locationsById: {
        'loc-1': { id: 'loc-1', zoneId: 'zone-a' }
      }
    };

    const result = service.previewPickingPlan(input);

    expect(planner).toHaveBeenCalledWith(input);
    expect(result).toBe(plannerResult);
  });
});
