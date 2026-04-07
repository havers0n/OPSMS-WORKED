import type { Order, OrderStatus, OrderSummary } from '@wos/domain';
import { BffRequestError } from '@/shared/api/bff/client';

export type OrderAction =
  | 'edit'
  | 'mark_ready'
  | 'mark_draft'
  | 'release'
  | 'view_progress'
  | 'review'
  | 'review_issues'
  | 'close'
  | 'cancel'
  | 'open';

export function getOrderActions(status: OrderStatus): OrderAction[] {
  switch (status) {
    case 'draft':
      return ['edit', 'mark_ready', 'cancel'];
    case 'ready':
      return ['mark_draft', 'release', 'cancel'];
    case 'released':
      return ['open', 'cancel'];
    case 'picking':
      return ['open', 'view_progress'];
    case 'picked':
      return ['review', 'close'];
    case 'partial':
      return ['review_issues', 'close'];
    case 'closed':
    case 'cancelled':
      return ['open'];
    default:
      return ['open'];
  }
}

export function canEditLines(status: OrderStatus): boolean {
  return status === 'draft';
}

export function isActiveOrder(status: OrderStatus): boolean {
  return status === 'released' || status === 'picking';
}

export function isCompletedOrder(status: OrderStatus): boolean {
  return status === 'picked' || status === 'closed';
}

export function isProblematicOrder(status: OrderStatus): boolean {
  return status === 'partial';
}

/** UI badge label */
export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'draft':     return 'Draft';
    case 'ready':     return 'Ready';
    case 'released':  return 'Released';
    case 'picking':   return 'In progress';
    case 'picked':    return 'Picked';
    case 'partial':   return 'Partial';
    case 'closed':    return 'Closed';
    case 'cancelled': return 'Cancelled';
  }
}

/** Tailwind color classes for status badge */
export function getOrderStatusColor(status: OrderStatus): string {
  switch (status) {
    case 'draft':     return 'bg-slate-100 text-slate-600';
    case 'ready':     return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'released':  return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    case 'picking':   return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'picked':    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'partial':   return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'closed':    return 'bg-slate-100 text-slate-500';
    case 'cancelled': return 'bg-red-50 text-red-600';
  }
}

/** Target status when operator clicks primary action */
export function getPrimaryTransitionTarget(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case 'draft':  return 'ready';
    case 'ready':  return 'released';
    case 'picked': return 'closed';
    case 'partial':return 'closed';
    default:       return null;
  }
}

export function getProgressLabel(order: OrderSummary): string {
  if (order.unitCount === 0) return '-';
  return `${order.pickedUnitCount} / ${order.unitCount}`;
}

/**
 * Workflow state for primary order action.
 * Single source of truth for order transition UI across all entry points.
 */
export interface OrderActionState {
  target: OrderStatus | null;
  reason: string | null;
}

/**
 * Determine primary workflow action for an order based on its current status and constraints.
 * Accounts for line requirements and wave ownership.
 */
export function getPrimaryOrderAction(
  order: Pick<Order, 'status' | 'lines' | 'waveId' | 'waveName'>
): OrderActionState {
  const target = getPrimaryTransitionTarget(order.status);

  if (!target) {
    return { target: null, reason: null };
  }

  // Draft -> Ready: require at least one line
  if (target === 'ready' && order.lines.length === 0) {
    return {
      target,
      reason: 'Add at least one line before marking ready.'
    };
  }

  // Ready -> Released: can't release if part of a wave
  if (target === 'released' && order.waveId) {
    return {
      target,
      reason: `Release is controlled by wave ${order.waveName ?? order.waveId}.`
    };
  }

  return { target, reason: null };
}

/**
 * User-facing label for primary action button.
 * Override generic status label with domain-specific wording where needed.
 */
export function getPrimaryActionLabel(status: OrderStatus, target: OrderStatus): string {
  // Custom label for draft -> ready transition
  if (status === 'draft' && target === 'ready') {
    return 'Commit and reserve';
  }

  // Default: use status label
  return getOrderStatusLabel(target);
}

/**
 * Parse BFF error responses and generate user-friendly error messages.
 * Handles structured shortage/ATP payloads from reservation layer.
 */
export function getTransitionErrorMessage(error: unknown): string | null {
  if (error instanceof BffRequestError && error.code === 'INSUFFICIENT_STOCK') {
    const details = error.details as {
      shortage?: {
        sku?: string;
        required?: number;
        physical?: number;
        reserved?: number;
        atp?: number;
      };
    } | null;

    const shortage = details?.shortage;
    if (shortage) {
      return `Insufficient stock for ${shortage.sku ?? 'this SKU'}: required ${shortage.required ?? '-'}, physical ${shortage.physical ?? '-'}, already reserved ${shortage.reserved ?? '-'}, ATP ${shortage.atp ?? '-'}.`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
}
