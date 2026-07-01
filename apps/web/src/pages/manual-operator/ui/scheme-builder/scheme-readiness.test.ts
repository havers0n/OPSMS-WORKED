import { describe, expect, it } from 'vitest';
import { getPlanReadiness } from './scheme-readiness';
import type { SourceOrder, SourceOrderItem, PlanningLine, WorkGroup, ItemAllocation } from './scheme-types';

function makeOrder(id: string, itemLines = 0): SourceOrder {
  return {
    orderId: id,
    orderNumber: id,
    customerName: null,
    pointName: null,
    sourceZone: null,
    backendStatus: 'queued',
    totalQuantity: 0,
    itemLinesCount: itemLines,
    hasAshlama: false,
    hasCheckUnits: false,
    sourceDeliveryLine: null,
    areaName: 'North',
    areaDisplayName: 'North',
    deliveryPointId: null,
    deliveryPointName: null,
    deliveryPointMatchStatus: null,
    rawDestinationLabel: null,
  };
}

function makeItem(id: string, orderId: string, qty: number): SourceOrderItem {
  return { id, orderId, sku: 'SKU', description: null, category: null, quantity: qty, notes: null, zone: null, sourceRows: null, sourceFile: null };
}

function userLine(id: string, areaName = 'North'): PlanningLine {
  return { id, areaName, name: 'Line A', sortOrder: 0, createdAt: 0 };
}

function techLine(id: string, areaName = 'North'): PlanningLine {
  return { id, areaName, name: 'default', sortOrder: 0, createdAt: 0 };
}

function userGroup(id: string, planningLineId: string, areaName = 'North'): WorkGroup {
  return { id, planningLineId, areaName, name: 'Group A', createdAt: 0 };
}

function techGroup(id: string, planningLineId: string, areaName = 'North'): WorkGroup {
  return { id, planningLineId, areaName, name: 'unassigned', createdAt: 0 };
}

function alloc(id: string, itemRowId: string, workGroupId: string, qty: number): ItemAllocation {
  return { id, itemRowId, workGroupId, qty, createdAt: 0 };
}

describe('getPlanReadiness', () => {
  describe('empty', () => {
    it('returns empty when there are no orders', () => {
      const result = getPlanReadiness({
        orders: [],
        orderItemMap: {},
        planningLines: [],
        workGroups: [],
        itemAllocations: [],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('empty');
      expect(result.canPublish).toBe(false);
      expect(result.blockers).toHaveLength(0);
      expect(result.counts.totalRows).toBe(0);
      expect(result.counts.orders).toBe(0);
    });

    it('returns empty when there are orders but no item rows', () => {
      const result = getPlanReadiness({
        orders: [makeOrder('o1')],
        orderItemMap: { o1: [] },
        planningLines: [],
        workGroups: [],
        itemAllocations: [],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('empty');
      expect(result.canPublish).toBe(false);
      expect(result.counts.orders).toBe(1);
      expect(result.counts.totalRows).toBe(0);
    });
  });

  describe('blocked: infrastructure missing', () => {
    it('returns blocked when orders exist but no user planning lines', () => {
      const result = getPlanReadiness({
        orders: [makeOrder('o1', 2)],
        orderItemMap: { o1: [makeItem('i1', 'o1', 10)] },
        planningLines: [techLine('pl-tech')],
        workGroups: [techGroup('wg-tech', 'pl-tech')],
        itemAllocations: [],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('blocked');
      expect(result.canPublish).toBe(false);
      expect(result.blockers).toEqual(['לא נוצרו קווי עבודה']);
      expect(result.counts.userPlanningLines).toBe(0);
    });

    it('returns blocked when user lines exist but no user work groups', () => {
      const result = getPlanReadiness({
        orders: [makeOrder('o1', 2)],
        orderItemMap: { o1: [makeItem('i1', 'o1', 10)] },
        planningLines: [userLine('pl-user')],
        workGroups: [techGroup('wg-tech', 'pl-user')],
        itemAllocations: [],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('blocked');
      expect(result.canPublish).toBe(false);
      expect(result.blockers).toEqual(['לא נוצרו קבוצות עבודה']);
      expect(result.counts.userPlanningLines).toBe(1);
      expect(result.counts.userWorkGroups).toBe(0);
    });

    it('returns blocked when target shift is missing', () => {
      const pl = userLine('pl-user');
      const wg = userGroup('wg-user', 'pl-user');
      const result = getPlanReadiness({
        orders: [makeOrder('o1', 1)],
        orderItemMap: { o1: [makeItem('i1', 'o1', 10)] },
        planningLines: [pl],
        workGroups: [wg],
        itemAllocations: [alloc('a1', 'i1', 'wg-user', 10)],
        publishUiMode: 'noTargetShift',
      });

      expect(result.status).toBe('blocked');
      expect(result.canPublish).toBe(false);
      expect(result.blockers).toEqual(['לא נבחרה משמרת יעד']);
    });
  });

  describe('blocked: no publishable allocations', () => {
    it('returns blocked when zero allocations exist into user-visible groups', () => {
      const pl = userLine('pl-user');
      const wg = userGroup('wg-user', 'pl-user');
      const result = getPlanReadiness({
        orders: [makeOrder('o1', 2)],
        orderItemMap: { o1: [makeItem('i1', 'o1', 10), makeItem('i2', 'o1', 5)] },
        planningLines: [pl],
        workGroups: [wg],
        itemAllocations: [],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('blocked');
      expect(result.canPublish).toBe(false);
      expect(result.blockers).toContain('אין שורות לפרסום');
      expect(result.counts.unassignedRows).toBe(2);
    });

    it('returns blocked when allocations only exist in technical/unassigned group', () => {
      const pl = userLine('pl-user');
      const techPl = techLine('pl-tech');
      const wg = userGroup('wg-user', 'pl-user');
      const techWg = techGroup('wg-tech', 'pl-tech');
      const result = getPlanReadiness({
        orders: [makeOrder('o1', 1)],
        orderItemMap: { o1: [makeItem('i1', 'o1', 10)] },
        planningLines: [pl, techPl],
        workGroups: [wg, techWg],
        itemAllocations: [alloc('a1', 'i1', 'wg-tech', 10)],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('blocked');
      expect(result.canPublish).toBe(false);
      expect(result.blockers).toContain('אין שורות לפרסום');
      expect(result.counts.unassignedRows).toBe(1);
      expect(result.counts.assignedRows).toBe(0);
    });
  });

  describe('partial: publishable with warnings', () => {
    it('returns partial with canPublish true when some rows have no allocation but at least one valid allocation exists', () => {
      const pl = userLine('pl-user');
      const wg = userGroup('wg-user', 'pl-user');
      const result = getPlanReadiness({
        orders: [makeOrder('o1', 2)],
        orderItemMap: { o1: [makeItem('i1', 'o1', 10), makeItem('i2', 'o1', 5)] },
        planningLines: [pl],
        workGroups: [wg],
        itemAllocations: [alloc('a1', 'i1', 'wg-user', 10)],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('partial');
      expect(result.canPublish).toBe(true);
      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toContain('1 שורות לא שובצו ולא יפורסמו');
      expect(result.counts.unassignedRows).toBe(1);
      expect(result.counts.assignedRows).toBe(1);
      expect(result.counts.partialRows).toBe(0);
    });

    it('returns partial with canPublish true when some rows have partial quantity allocated', () => {
      const pl = userLine('pl-user');
      const wg = userGroup('wg-user', 'pl-user');
      const result = getPlanReadiness({
        orders: [makeOrder('o1', 1)],
        orderItemMap: { o1: [makeItem('i1', 'o1', 10)] },
        planningLines: [pl],
        workGroups: [wg],
        itemAllocations: [alloc('a1', 'i1', 'wg-user', 6)],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('partial');
      expect(result.canPublish).toBe(true);
      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toContain('1 שורות שובצו חלקית — היתרה תישאר זמינה לתכנון הבא');
      expect(result.counts.partialRows).toBe(1);
      expect(result.counts.unassignedRows).toBe(0);
    });

    it('returns partial with both warnings when unassigned and partial rows exist alongside valid allocation', () => {
      const pl = userLine('pl-user');
      const wg = userGroup('wg-user', 'pl-user');
      const result = getPlanReadiness({
        orders: [makeOrder('o1', 3)],
        orderItemMap: { o1: [makeItem('i1', 'o1', 10), makeItem('i2', 'o1', 5), makeItem('i3', 'o1', 8)] },
        planningLines: [pl],
        workGroups: [wg],
        itemAllocations: [
          alloc('a1', 'i1', 'wg-user', 10),
          alloc('a2', 'i2', 'wg-user', 3),
        ],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('partial');
      expect(result.canPublish).toBe(true);
      expect(result.warnings).toContain('1 שורות לא שובצו ולא יפורסמו');
      expect(result.warnings).toContain('1 שורות שובצו חלקית — היתרה תישאר זמינה לתכנון הבא');
      expect(result.counts.assignedRows).toBe(1);
      expect(result.counts.partialRows).toBe(1);
      expect(result.counts.unassignedRows).toBe(1);
    });
  });

  describe('ready: all rows fully assigned', () => {
    it('returns ready when all rows are fully assigned into user-visible groups and target shift exists', () => {
      const pl = userLine('pl-user');
      const wg = userGroup('wg-user', 'pl-user');
      const result = getPlanReadiness({
        orders: [makeOrder('o1', 2)],
        orderItemMap: { o1: [makeItem('i1', 'o1', 10), makeItem('i2', 'o1', 5)] },
        planningLines: [pl],
        workGroups: [wg],
        itemAllocations: [
          alloc('a1', 'i1', 'wg-user', 10),
          alloc('a2', 'i2', 'wg-user', 5),
        ],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('ready');
      expect(result.canPublish).toBe(true);
      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.counts.assignedRows).toBe(2);
      expect(result.counts.unassignedRows).toBe(0);
      expect(result.counts.partialRows).toBe(0);
    });
  });

  describe('counts', () => {
    it('counts technical entities separately in counts', () => {
      const pl = userLine('pl-user');
      const techPl = techLine('pl-tech');
      const wg = userGroup('wg-user', 'pl-user');
      const techWg = techGroup('wg-tech', 'pl-tech');
      const result = getPlanReadiness({
        orders: [makeOrder('o1', 1)],
        orderItemMap: { o1: [makeItem('i1', 'o1', 10)] },
        planningLines: [pl, techPl],
        workGroups: [wg, techWg],
        itemAllocations: [alloc('a1', 'i1', 'wg-user', 10)],
        publishUiMode: 'readyToPublish',
      });

      expect(result.status).toBe('ready');
      expect(result.counts.userPlanningLines).toBe(1);
      expect(result.counts.technicalPlanningLines).toBe(1);
      expect(result.counts.userWorkGroups).toBe(1);
      expect(result.counts.technicalWorkGroups).toBe(1);
    });
  });
});
