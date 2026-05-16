import type { WaveStatus, WaveSummary } from '@wos/domain';
import { translate } from '@/shared/i18n';

const waveStatusLabelKey: Record<WaveStatus, Parameters<typeof translate>[0]> = {
  draft: 'operations.wave.status.draft',
  ready: 'operations.wave.status.ready',
  released: 'operations.wave.status.released',
  in_progress: 'operations.wave.status.inProgress',
  completed: 'operations.wave.status.completed',
  partial: 'operations.wave.status.partial',
  closed: 'operations.wave.status.closed'
};

export function getWaveStatusLabel(status: WaveStatus): string {
  return translate(waveStatusLabelKey[status]);
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
        label: translate('operations.wave.action.markReady'),
        reason: wave.totalOrders === 0 ? translate('operations.wave.reason.addOrderFirst') : null
      };

    case 'ready':
      return {
        target: 'released',
        label: translate('operations.wave.action.releaseWave'),
        reason: wave.blockingOrderCount > 0 ? translate('operations.wave.reason.ordersNotReady') : null
      };

    case 'released':
      return {
        target: 'closed',
        label: translate('operations.wave.action.closeWave'),
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
    return { target: 'draft', label: translate('operations.wave.action.rollbackToDraft') };
  }
  return { target: null, label: null };
}
