import type { WaveStatus } from '@wos/domain';

export function getAllowedWaveTransitions(currentStatus: WaveStatus): WaveStatus[] {
  switch (currentStatus) {
    case 'draft':
      return ['ready'];
    case 'ready':
      return ['draft', 'released'];
    case 'released':
      return ['closed'];
    case 'in_progress':
    case 'completed':
    case 'partial':
    case 'closed':
      return [];
    default:
      return [];
  }
}

export function isWaveTransitionAllowed(currentStatus: WaveStatus, targetStatus: WaveStatus): boolean {
  return getAllowedWaveTransitions(currentStatus).includes(targetStatus);
}
