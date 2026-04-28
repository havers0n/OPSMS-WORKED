import { describe, expect, it } from 'vitest';
import {
  getOrderActions,
  canEditLines,
  isActiveOrder,
  isCompletedOrder,
  isProblematicOrder,
  getOrderStatusLabel,
  getOrderStatusColor,
  getPrimaryTransitionTarget,
  getPrimaryOrderAction,
  getPrimaryActionLabel,
  getTransitionErrorMessage
} from './order-actions';
import type { Order } from '@wos/domain';
import { BffRequestError } from '@/shared/api/bff/client';

const orderLine: Order['lines'][number] = {
  id: 'line-1',
  orderId: 'order-1',
  tenantId: 'tenant-1',
  productId: null,
  sku: 'SKU-1',
  name: 'Widget',
  qtyRequired: 5,
  qtyPicked: 0,
  reservedQty: 0,
  status: 'pending'
};

describe('Order Workflow Actions', () => {
  describe('canEditLines', () => {
    it('allows editing lines only in draft status', () => {
      expect(canEditLines('draft')).toBe(true);
      expect(canEditLines('ready')).toBe(false);
      expect(canEditLines('released')).toBe(false);
      expect(canEditLines('picking')).toBe(false);
      expect(canEditLines('picked')).toBe(false);
      expect(canEditLines('partial')).toBe(false);
      expect(canEditLines('closed')).toBe(false);
      expect(canEditLines('cancelled')).toBe(false);
    });
  });

  describe('isActiveOrder', () => {
    it('identifies active orders (released or picking)', () => {
      expect(isActiveOrder('draft')).toBe(false);
      expect(isActiveOrder('ready')).toBe(false);
      expect(isActiveOrder('released')).toBe(true);
      expect(isActiveOrder('picking')).toBe(true);
      expect(isActiveOrder('picked')).toBe(false);
      expect(isActiveOrder('partial')).toBe(false);
      expect(isActiveOrder('closed')).toBe(false);
      expect(isActiveOrder('cancelled')).toBe(false);
    });
  });

  describe('isCompletedOrder', () => {
    it('identifies completed orders (picked or closed)', () => {
      expect(isCompletedOrder('draft')).toBe(false);
      expect(isCompletedOrder('ready')).toBe(false);
      expect(isCompletedOrder('released')).toBe(false);
      expect(isCompletedOrder('picking')).toBe(false);
      expect(isCompletedOrder('picked')).toBe(true);
      expect(isCompletedOrder('partial')).toBe(false);
      expect(isCompletedOrder('closed')).toBe(true);
      expect(isCompletedOrder('cancelled')).toBe(false);
    });
  });

  describe('isProblematicOrder', () => {
    it('identifies problematic orders (partial)', () => {
      expect(isProblematicOrder('draft')).toBe(false);
      expect(isProblematicOrder('ready')).toBe(false);
      expect(isProblematicOrder('released')).toBe(false);
      expect(isProblematicOrder('picking')).toBe(false);
      expect(isProblematicOrder('picked')).toBe(false);
      expect(isProblematicOrder('partial')).toBe(true);
      expect(isProblematicOrder('closed')).toBe(false);
      expect(isProblematicOrder('cancelled')).toBe(false);
    });
  });

  describe('getOrderStatusLabel', () => {
    it('returns correct status labels for all statuses', () => {
      expect(getOrderStatusLabel('draft')).toBe('Draft');
      expect(getOrderStatusLabel('ready')).toBe('Ready');
      expect(getOrderStatusLabel('released')).toBe('Released');
      expect(getOrderStatusLabel('picking')).toBe('In progress');
      expect(getOrderStatusLabel('picked')).toBe('Picked');
      expect(getOrderStatusLabel('partial')).toBe('Partial');
      expect(getOrderStatusLabel('closed')).toBe('Closed');
      expect(getOrderStatusLabel('cancelled')).toBe('Cancelled');
    });
  });

  describe('getOrderStatusColor', () => {
    it('returns Tailwind color classes for all statuses', () => {
      const draft = getOrderStatusColor('draft');
      expect(draft).toContain('bg-slate-100');
      expect(draft).toContain('text-slate-600');

      const ready = getOrderStatusColor('ready');
      expect(ready).toContain('bg-blue-50');
      expect(ready).toContain('border-blue-200');

      const released = getOrderStatusColor('released');
      expect(released).toContain('bg-cyan-50');

      const cancelled = getOrderStatusColor('cancelled');
      expect(cancelled).toContain('bg-red-50');
      expect(cancelled).toContain('text-red-600');
    });
  });

  describe('getPrimaryTransitionTarget', () => {
    it('returns correct transition targets for order workflow', () => {
      expect(getPrimaryTransitionTarget('draft')).toBe('ready');
      expect(getPrimaryTransitionTarget('ready')).toBe('released');
      expect(getPrimaryTransitionTarget('picked')).toBe('closed');
      expect(getPrimaryTransitionTarget('partial')).toBe('closed');
      expect(getPrimaryTransitionTarget('released')).toBe(null);
      expect(getPrimaryTransitionTarget('picking')).toBe(null);
      expect(getPrimaryTransitionTarget('closed')).toBe(null);
      expect(getPrimaryTransitionTarget('cancelled')).toBe(null);
    });
  });

  describe('getPrimaryOrderAction - Standalone Draft Order', () => {
    const draftOrder: Pick<Order, 'status' | 'lines' | 'waveId' | 'waveName'> = {
      status: 'draft',
      lines: [orderLine],
      waveId: null,
      waveName: null
    };

    it('allows marking ready when lines exist', () => {
      const action = getPrimaryOrderAction(draftOrder);
      expect(action.target).toBe('ready');
      expect(action.reason).toBe(null);
    });

    it('blocks marking ready when no lines', () => {
      const action = getPrimaryOrderAction({ ...draftOrder, lines: [] });
      expect(action.target).toBe('ready');
      expect(action.reason).toBe('Add at least one line before marking ready.');
    });
  });

  describe('getPrimaryOrderAction - Standalone Ready Order', () => {
    const readyOrder: Pick<Order, 'status' | 'lines' | 'waveId' | 'waveName'> = {
      status: 'ready',
      lines: [orderLine],
      waveId: null,
      waveName: null
    };

    it('allows releasing when ready and not in wave', () => {
      const action = getPrimaryOrderAction(readyOrder);
      expect(action.target).toBe('released');
      expect(action.reason).toBe(null);
    });
  });

  describe('getPrimaryOrderAction - Wave-Attached Order', () => {
    const waveAttachedReady: Pick<Order, 'status' | 'lines' | 'waveId' | 'waveName'> = {
      status: 'ready',
      lines: [orderLine],
      waveId: 'wave-123',
      waveName: 'Morning Run'
    };

    it('blocks release when order is attached to wave', () => {
      const action = getPrimaryOrderAction(waveAttachedReady);
      expect(action.target).toBe('released');
      expect(action.reason).toBe('Release is controlled by wave Morning Run.');
    });

    it('uses waveId in message when waveName unavailable', () => {
      const action = getPrimaryOrderAction({
        ...waveAttachedReady,
        waveName: null
      });
      expect(action.reason).toBe('Release is controlled by wave wave-123.');
    });
  });

  describe('getPrimaryOrderAction - Non-Transitionable Statuses', () => {
    it('returns null target for released, picking, closed, cancelled', () => {
      expect(getPrimaryOrderAction({
        status: 'released',
        lines: [],
        waveId: null,
        waveName: null
      }).target).toBe(null);

      expect(getPrimaryOrderAction({
        status: 'picking',
        lines: [],
        waveId: null,
        waveName: null
      }).target).toBe(null);

      expect(getPrimaryOrderAction({
        status: 'closed',
        lines: [],
        waveId: null,
        waveName: null
      }).target).toBe(null);
    });
  });

  describe('getPrimaryActionLabel - Correct Wording', () => {
    it('uses custom "Commit and reserve" for draft → ready', () => {
      expect(getPrimaryActionLabel('draft', 'ready')).toBe('Commit and reserve');
    });

    it('uses status label for other transitions', () => {
      expect(getPrimaryActionLabel('ready', 'released')).toBe('Released');
      expect(getPrimaryActionLabel('picking', 'closed')).toBe('Closed');
      expect(getPrimaryActionLabel('partial', 'closed')).toBe('Closed');
    });
  });

  describe('getTransitionErrorMessage - ATP/Shortage Errors', () => {
    it('parses INSUFFICIENT_STOCK error with shortage details', () => {
      const error = new BffRequestError(
        400,
        'INSUFFICIENT_STOCK',
        'Insufficient stock',
        'req-123',
        'err-456',
        {
          shortage: {
            sku: 'SKU-123',
            required: 100,
            physical: 50,
            reserved: 30,
            atp: 20
          }
        }
      );

      const message = getTransitionErrorMessage(error);
      expect(message).toContain('Insufficient stock');
      expect(message).toContain('SKU-123');
      expect(message).toContain('required 100');
      expect(message).toContain('ATP 20');
    });

    it('falls back to error message if no shortage details found', () => {
      const error = new BffRequestError(
        400,
        'INSUFFICIENT_STOCK',
        'Insufficient stock',
        'req-123',
        'err-456',
        {} // no shortage details
      );

      const message = getTransitionErrorMessage(error);
      // Falls back to the error message since there's no shortage data to parse
      expect(message).toBe('Insufficient stock');
    });

    it('extracts message from generic Error instances', () => {
      const error = new Error('Custom error message');
      const message = getTransitionErrorMessage(error);
      expect(message).toBe('Custom error message');
    });

    it('returns null for non-Error objects', () => {
      expect(getTransitionErrorMessage(null)).toBeNull();
      expect(getTransitionErrorMessage('not an error')).toBeNull();
      expect(getTransitionErrorMessage({ code: 'SOMETHING' })).toBeNull();
    });
  });

  describe('getOrderActions - Action Sets by Status', () => {
    it('draft has edit, mark_ready, cancel', () => {
      expect(getOrderActions('draft')).toEqual(['edit', 'mark_ready', 'cancel']);
    });

    it('ready has mark_draft, release, cancel', () => {
      expect(getOrderActions('ready')).toEqual(['mark_draft', 'release', 'cancel']);
    });

    it('released has open, cancel', () => {
      expect(getOrderActions('released')).toEqual(['open', 'cancel']);
    });

    it('picking has open, view_progress', () => {
      expect(getOrderActions('picking')).toEqual(['open', 'view_progress']);
    });

    it('picked has review, close', () => {
      expect(getOrderActions('picked')).toEqual(['review', 'close']);
    });

    it('partial has review_issues, close', () => {
      expect(getOrderActions('partial')).toEqual(['review_issues', 'close']);
    });

    it('closed and cancelled have open', () => {
      expect(getOrderActions('closed')).toEqual(['open']);
      expect(getOrderActions('cancelled')).toEqual(['open']);
    });
  });
});
