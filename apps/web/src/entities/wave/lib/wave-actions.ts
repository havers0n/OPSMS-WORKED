import type { WaveStatus, WaveSummary } from '@wos/domain';

const waveStatusLabel: Record<WaveStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  released: 'Released',
  in_progress: 'In progress',
  completed: 'Completed',
  partial: 'Partial',
  closed: 'Closed'
};

export function getWaveStatusLabel(status: WaveStatus): string {
  return waveStatusLabel[status];
}

export function getWaveStatusColor(status: WaveStatus): string {
  switch (status) {
    case 'draft': return 'bg-slate-100 text-slate-700';
    case 'ready': return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'released': return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    case 'in_progress': return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'completed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'partial': return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'closed': return 'bg-slate-100 text-slate-500';
  }
}

export interface WaveActionState {
  target: WaveStatus | null;
  label: string | null;
  reason: string | null;
}

/**
 * Determine primary workflow action for a wave based on its current status and constraints.
 * Single source of truth for wave transition UI across all entry points.
 */
export function getWavePrimaryAction(
  wave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'>
): WaveActionState {
  switch (wave.status) {
    case 'draft':
      return {
        target: 'ready',
        label: 'Mark ready',
        reason: wave.totalOrders === 0 ? 'Add at least one order first.' : null
      };

    case 'ready':
      return {
        target: 'released',
        label: 'Release wave',
        reason: wave.blockingOrderCount > 0 ? 'Not all orders are ready.' : null
      };

    case 'released':
      return {
        target: 'closed',
        label: 'Close wave',
        reason: null
      };

    default:
      return {
        target: null,
        label: null,
        reason: null
      };
  }
}

/**
 * Determine secondary action for a wave (e.g., rollback to draft).
 * Only available in certain states.
 */
export function getWaveSecondaryAction(wave: Pick<WaveSummary, 'status'>): {
  target: WaveStatus | null;
  label: string | null;
} {
  if (wave.status === 'ready') {
    return { target: 'draft', label: 'Rollback to draft' };
  }
  return { target: null, label: null };
}
