import type { PickStepStatus, PickTaskStatus } from '@wos/domain';
import { translate } from '@/shared/i18n';

// ── Step status ───────────────────────────────────────────────────────────────

export function getPickStepStatusLabel(status: PickStepStatus): string {
  switch (status) {
    case 'pending':             return translate('operations.pick.step.status.pending');
    case 'picked':              return translate('operations.pick.step.status.picked');
    case 'partial':             return translate('operations.pick.step.status.partial');
    case 'skipped':             return translate('operations.pick.step.status.skipped');
    case 'exception':           return translate('operations.pick.step.status.exception');
    case 'needs_replenishment': return translate('operations.pick.step.status.needsReplenishment');
  }
}

export function getPickStepStatusColor(status: PickStepStatus): string {
  switch (status) {
    case 'pending':             return 'bg-slate-100 text-slate-600';
    case 'picked':              return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'partial':             return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'skipped':             return 'bg-slate-100 text-slate-500';
    case 'exception':           return 'bg-red-50 text-red-600 border border-red-200';
    case 'needs_replenishment': return 'bg-amber-50 text-amber-700 border border-amber-200';
  }
}

// ── Task status ───────────────────────────────────────────────────────────────

export function getPickTaskStatusLabel(status: PickTaskStatus): string {
  switch (status) {
    case 'ready':                    return translate('operations.pick.task.status.ready');
    case 'assigned':                 return translate('operations.pick.task.status.assigned');
    case 'in_progress':              return translate('operations.pick.task.status.inProgress');
    case 'completed':                return translate('operations.pick.task.status.completed');
    case 'completed_with_exceptions': return translate('operations.pick.task.status.completedWithExceptions');
  }
}

export function getPickTaskStatusColor(status: PickTaskStatus): string {
  switch (status) {
    case 'ready':                    return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'assigned':                 return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    case 'in_progress':              return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'completed':                return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'completed_with_exceptions': return 'bg-orange-50 text-orange-700 border border-orange-200';
  }
}

// ── Step navigation helpers ───────────────────────────────────────────────────

/** Returns the first step whose status is `pending`. */
export function findNextPendingStep<T extends { status: PickStepStatus }>(
  steps: T[]
): T | null {
  return steps.find((s) => s.status === 'pending') ?? null;
}

/** True for any terminal step status (contributes to completedSteps counter). */
export function isTerminalStep(status: PickStepStatus): boolean {
  return status === 'picked' || status === 'partial' || status === 'skipped' ||
    status === 'exception' || status === 'needs_replenishment';
}
