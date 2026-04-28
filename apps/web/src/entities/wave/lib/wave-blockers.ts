import type { OrderStatus, Wave } from '@wos/domain';

/**
 * Reason categories for wave release blockers
 */
export type BlockerReasonCode =
  | 'draft'
  | 'empty_order'
  | 'not_ready'
  | 'unknown_release_blocker';

/**
 * A single blocking order with reason
 */
export interface WaveBlocker {
  orderId: string;
  externalNumber: string;
  status: OrderStatus;
  reason: BlockerReasonCode;
  message: string;
}

/**
 * Wave blockers summary
 */
export interface WaveBlockersSummary {
  blocked: boolean;
  count: number;
  blockers: WaveBlocker[];
}

/**
 * Derive which orders are blocking wave release and why
 *
 * Currently detects:
 * - draft: order not yet committed to ready state
 * - empty_order: order has no lines to pick
 * - not_ready: order in a state that prevents wave release (e.g., partial, cancelled)
 * - unknown_release_blocker: blocker reason not determinable from order summary
 */
export function deriveWaveBlockers(
  wave: Pick<Wave, 'orders'>
): WaveBlockersSummary {
  const blockers: WaveBlocker[] = [];

  for (const order of wave.orders) {
    let reason: BlockerReasonCode | null = null;
    let message = '';

    // Draft orders block wave release
    if (order.status === 'draft') {
      reason = 'draft';
      message = 'Order not yet committed to ready state.';
    }
    // Empty orders block wave release
    else if (order.lineCount === 0 && order.status !== 'closed' && order.status !== 'cancelled') {
      reason = 'empty_order';
      message = 'Order has no lines to pick.';
    }
    // Terminal statuses don't block
    // closed, cancelled - these are fine
    // ready, released, picking, picked - these are fine
    // partial - check if this blocks (likely yes for wave release)
    else if (order.status === 'partial') {
      reason = 'not_ready';
      message = 'Order partially fulfilled. Resolve partial picks before wave release.';
    }

    if (reason) {
      blockers.push({
        orderId: order.id,
        externalNumber: order.externalNumber,
        status: order.status,
        reason,
        message
      });
    }
  }

  return {
    blocked: blockers.length > 0,
    count: blockers.length,
    blockers
  };
}

/**
 * Get human-readable label for blocker reason
 */
export function getBlockerReasonLabel(reason: BlockerReasonCode): string {
  const labels: Record<BlockerReasonCode, string> = {
    draft: 'Not committed',
    empty_order: 'No lines',
    not_ready: 'Not ready',
    unknown_release_blocker: 'Unknown issue'
  };
  return labels[reason];
}

/**
 * Get Tailwind color classes for blocker reason severity
 */
export function getBlockerReasonColor(_reason: BlockerReasonCode): string {
  // All blockers are amber/warning level
  return 'bg-amber-50 text-amber-700 border-amber-200';
}
