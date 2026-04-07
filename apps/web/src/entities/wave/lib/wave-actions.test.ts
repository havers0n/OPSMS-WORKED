import { describe, expect, it } from 'vitest';
import {
  getWaveStatusLabel,
  getWaveStatusColor,
  getWavePrimaryAction,
  getWaveSecondaryAction
} from './wave-actions';
import type { WaveSummary } from '@wos/domain';

describe('Wave Workflow Actions', () => {
  describe('getWaveStatusLabel', () => {
    it('returns correct status labels for all wave statuses', () => {
      expect(getWaveStatusLabel('draft')).toBe('Draft');
      expect(getWaveStatusLabel('ready')).toBe('Ready');
      expect(getWaveStatusLabel('released')).toBe('Released');
      expect(getWaveStatusLabel('in_progress')).toBe('In progress');
      expect(getWaveStatusLabel('completed')).toBe('Completed');
      expect(getWaveStatusLabel('partial')).toBe('Partial');
      expect(getWaveStatusLabel('closed')).toBe('Closed');
    });
  });

  describe('getWaveStatusColor', () => {
    it('returns Tailwind color classes for all wave statuses', () => {
      const draft = getWaveStatusColor('draft');
      expect(draft).toContain('bg-slate-100');
      expect(draft).toContain('text-slate-700');

      const ready = getWaveStatusColor('ready');
      expect(ready).toContain('bg-blue-50');
      expect(ready).toContain('border-blue-200');

      const released = getWaveStatusColor('released');
      expect(released).toContain('bg-cyan-50');

      const closed = getWaveStatusColor('closed');
      expect(closed).toContain('bg-slate-100');
      expect(closed).toContain('text-slate-500');
    });
  });

  describe('getWavePrimaryAction - Draft Wave', () => {
    it('blocks marking ready when no orders', () => {
      const draftEmptyWave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'draft',
        totalOrders: 0,
        blockingOrderCount: 0
      };

      const action = getWavePrimaryAction(draftEmptyWave);
      expect(action.target).toBe('ready');
      expect(action.label).toBe('Mark ready');
      expect(action.reason).toBe('Add at least one order first.');
    });

    it('allows marking ready when orders exist', () => {
      const draftWaveWithOrders: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'draft',
        totalOrders: 3,
        blockingOrderCount: 0
      };

      const action = getWavePrimaryAction(draftWaveWithOrders);
      expect(action.target).toBe('ready');
      expect(action.label).toBe('Mark ready');
      expect(action.reason).toBeNull();
    });
  });

  describe('getWavePrimaryAction - Ready Wave', () => {
    it('blocks release when orders are not ready', () => {
      const readyWaveWithBlockers: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'ready',
        totalOrders: 5,
        blockingOrderCount: 2
      };

      const action = getWavePrimaryAction(readyWaveWithBlockers);
      expect(action.target).toBe('released');
      expect(action.label).toBe('Release wave');
      expect(action.reason).toBe('Not all orders are ready.');
    });

    it('allows release when all orders are ready', () => {
      const readyWaveNoBlockers: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'ready',
        totalOrders: 5,
        blockingOrderCount: 0
      };

      const action = getWavePrimaryAction(readyWaveNoBlockers);
      expect(action.target).toBe('released');
      expect(action.label).toBe('Release wave');
      expect(action.reason).toBeNull();
    });
  });

  describe('getWavePrimaryAction - Released Wave', () => {
    it('allows closing released wave', () => {
      const releasedWave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'released',
        totalOrders: 5,
        blockingOrderCount: 0
      };

      const action = getWavePrimaryAction(releasedWave);
      expect(action.target).toBe('closed');
      expect(action.label).toBe('Close wave');
      expect(action.reason).toBeNull();
    });
  });

  describe('getWavePrimaryAction - Non-Transitionable Statuses', () => {
    it('returns no action for in_progress, completed, partial, closed', () => {
      const inProgressWave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'in_progress',
        totalOrders: 5,
        blockingOrderCount: 0
      };

      let action = getWavePrimaryAction(inProgressWave);
      expect(action.target).toBeNull();
      expect(action.label).toBeNull();
      expect(action.reason).toBeNull();

      const completedWave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'completed',
        totalOrders: 5,
        blockingOrderCount: 0
      };

      action = getWavePrimaryAction(completedWave);
      expect(action.target).toBeNull();

      const partialWave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'partial',
        totalOrders: 5,
        blockingOrderCount: 0
      };

      action = getWavePrimaryAction(partialWave);
      expect(action.target).toBeNull();

      const closedWave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'closed',
        totalOrders: 5,
        blockingOrderCount: 0
      };

      action = getWavePrimaryAction(closedWave);
      expect(action.target).toBeNull();
    });
  });

  describe('getWaveSecondaryAction - Rollback Logic', () => {
    it('allows rollback to draft only when ready', () => {
      const readyWave: Pick<WaveSummary, 'status'> = { status: 'ready' };
      const action = getWaveSecondaryAction(readyWave);
      expect(action.target).toBe('draft');
      expect(action.label).toBe('Rollback to draft');
    });

    it('blocks rollback for all other statuses', () => {
      const statuses = ['draft', 'released', 'in_progress', 'completed', 'partial', 'closed'] as const;

      for (const status of statuses) {
        const action = getWaveSecondaryAction({ status });
        expect(action.target).toBeNull();
        expect(action.label).toBeNull();
      }
    });
  });

  describe('Wave Workflow Ownership - Semantics', () => {
    describe('Draft to Ready transition', () => {
      const draftWave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'draft',
        totalOrders: 3,
        blockingOrderCount: 0
      };

      it('label is wave-owned action', () => {
        const action = getWavePrimaryAction(draftWave);
        expect(action.label).toBe('Mark ready');
        // NOT "Commit and reserve" (that's order's wording)
        expect(action.label).not.toBe('Commit and reserve');
      });

      it('reason explains wave-level constraint (order count)', () => {
        const emptyWave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
          status: 'draft',
          totalOrders: 0,
          blockingOrderCount: 0
        };
        const action = getWavePrimaryAction(emptyWave);
        expect(action.reason).toContain('order');
      });
    });

    describe('Ready to Released transition', () => {
      it('reason mentions orders readiness (wave-owned constraint)', () => {
        const readyWaveWithBlockers: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
          status: 'ready',
          totalOrders: 5,
          blockingOrderCount: 2
        };
        const action = getWavePrimaryAction(readyWaveWithBlockers);
        expect(action.reason).toContain('orders');
        expect(action.reason).toContain('ready');
        // NOT about individual order's release readiness
        expect(action.reason).not.toContain('Release is controlled');
      });
    });
  });

  describe('Wave Workflow Consistency', () => {
    it('same wave status always returns same label and color', () => {
      const readyWave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'ready',
        totalOrders: 3,
        blockingOrderCount: 1
      };

      const action1 = getWavePrimaryAction(readyWave);
      const action2 = getWavePrimaryAction(readyWave);

      expect(action1.label).toBe(action2.label);
      expect(action1.target).toBe(action2.target);
      expect(action1.reason).toBe(action2.reason);

      const color1 = getWaveStatusColor('ready');
      const color2 = getWaveStatusColor('ready');
      expect(color1).toBe(color2);
    });

    it('wave status label is consistent across lookups', () => {
      const label1 = getWaveStatusLabel('released');
      const label2 = getWaveStatusLabel('released');
      expect(label1).toBe(label2);
      expect(label1).toBe('Released');
    });
  });

  describe('Wave Workflow Edge Cases', () => {
    it('handles ready wave with zero blocking orders correctly', () => {
      const readyWaveAllReady: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'ready',
        totalOrders: 10,
        blockingOrderCount: 0
      };

      const action = getWavePrimaryAction(readyWaveAllReady);
      expect(action.target).toBe('released');
      expect(action.reason).toBeNull();
    });

    it('handles wave transition path correctly', () => {
      // Draft -> Ready -> Released -> Closed
      const draft: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'draft',
        totalOrders: 1,
        blockingOrderCount: 0
      };

      const ready: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'ready',
        totalOrders: 1,
        blockingOrderCount: 0
      };

      const released: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'> = {
        status: 'released',
        totalOrders: 1,
        blockingOrderCount: 0
      };

      expect(getWavePrimaryAction(draft).target).toBe('ready');
      expect(getWavePrimaryAction(ready).target).toBe('released');
      expect(getWavePrimaryAction(released).target).toBe('closed');
    });
  });
});
