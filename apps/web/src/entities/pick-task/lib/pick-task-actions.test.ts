import { describe, expect, it } from 'vitest';
import {
  findNextPendingStep,
  getPickStepStatusColor,
  getPickStepStatusLabel,
  getPickTaskStatusColor,
  getPickTaskStatusLabel,
  isTerminalStep
} from './pick-task-actions';
import type { PickStepStatus, PickTaskStatus } from '@wos/domain';
import { translate } from '@/shared/i18n';

// ── getPickStepStatusLabel ────────────────────────────────────────────────────

describe('getPickStepStatusLabel', () => {
  const cases: [PickStepStatus, string][] = [
    ['pending',             translate('operations.pick.step.status.pending')],
    ['picked',              translate('operations.pick.step.status.picked')],
    ['partial',             translate('operations.pick.step.status.partial')],
    ['skipped',             translate('operations.pick.step.status.skipped')],
    ['exception',           translate('operations.pick.step.status.exception')],
    ['needs_replenishment', translate('operations.pick.step.status.needsReplenishment')]
  ];

  it.each(cases)('labels %s as "%s"', (status, expected) => {
    expect(getPickStepStatusLabel(status)).toBe(expected);
  });
});

// ── getPickStepStatusColor ────────────────────────────────────────────────────

describe('getPickStepStatusColor', () => {
  it('uses emerald for picked', () => {
    expect(getPickStepStatusColor('picked')).toContain('emerald');
  });

  it('uses orange for partial', () => {
    expect(getPickStepStatusColor('partial')).toContain('orange');
  });

  it('uses amber for needs_replenishment', () => {
    expect(getPickStepStatusColor('needs_replenishment')).toContain('amber');
  });

  it('uses red for exception', () => {
    expect(getPickStepStatusColor('exception')).toContain('red');
  });

  it('uses slate for pending', () => {
    expect(getPickStepStatusColor('pending')).toContain('slate');
  });
});

// ── getPickTaskStatusLabel ────────────────────────────────────────────────────

describe('getPickTaskStatusLabel', () => {
  const cases: [PickTaskStatus, string][] = [
    ['ready',                     translate('operations.pick.task.status.ready')],
    ['assigned',                  translate('operations.pick.task.status.assigned')],
    ['in_progress',               translate('operations.pick.task.status.inProgress')],
    ['completed',                 translate('operations.pick.task.status.completed')],
    ['completed_with_exceptions', translate('operations.pick.task.status.completedWithExceptions')]
  ];

  it.each(cases)('labels %s correctly', (status, expected) => {
    expect(getPickTaskStatusLabel(status)).toBe(expected);
  });
});

// ── getPickTaskStatusColor ────────────────────────────────────────────────────

describe('getPickTaskStatusColor', () => {
  it('uses emerald for completed', () => {
    expect(getPickTaskStatusColor('completed')).toContain('emerald');
  });

  it('uses orange for completed_with_exceptions', () => {
    expect(getPickTaskStatusColor('completed_with_exceptions')).toContain('orange');
  });

  it('uses amber for in_progress', () => {
    expect(getPickTaskStatusColor('in_progress')).toContain('amber');
  });
});

// ── findNextPendingStep ───────────────────────────────────────────────────────

describe('findNextPendingStep', () => {
  it('returns the first pending step in sequence', () => {
    const steps = [
      { id: '1', status: 'picked' as PickStepStatus },
      { id: '2', status: 'pending' as PickStepStatus },
      { id: '3', status: 'pending' as PickStepStatus }
    ];
    expect(findNextPendingStep(steps)?.id).toBe('2');
  });

  it('returns null when all steps are terminal', () => {
    const steps = [
      { id: '1', status: 'picked' as PickStepStatus },
      { id: '2', status: 'partial' as PickStepStatus }
    ];
    expect(findNextPendingStep(steps)).toBeNull();
  });

  it('returns null for an empty array', () => {
    expect(findNextPendingStep([])).toBeNull();
  });

  it('skips needs_replenishment steps (they are not pending)', () => {
    const steps = [
      { id: '1', status: 'needs_replenishment' as PickStepStatus },
      { id: '2', status: 'pending' as PickStepStatus }
    ];
    expect(findNextPendingStep(steps)?.id).toBe('2');
  });
});

// ── isTerminalStep ────────────────────────────────────────────────────────────

describe('isTerminalStep', () => {
  const terminal: PickStepStatus[] = ['picked', 'partial', 'skipped', 'exception', 'needs_replenishment'];
  const nonTerminal: PickStepStatus[] = ['pending'];

  it.each(terminal)('%s is terminal', (status) => {
    expect(isTerminalStep(status)).toBe(true);
  });

  it.each(nonTerminal)('%s is not terminal', (status) => {
    expect(isTerminalStep(status)).toBe(false);
  });
});
