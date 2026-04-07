import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ordersQueryOptions } from '@/entities/order/api/queries';
import { routes } from '@/shared/config/routes';
import { OrderDrawer } from '@/features/order-detail/ui/order-drawer';

/**
 * Full Order Detail Page
 *
 * This is the primary workspace for managing a single order:
 * - Add/remove lines
 * - Edit product quantities
 * - Perform lifecycle transitions (commit, rollback, cancel)
 * - View full order context and history
 *
 * Reached from:
 * - Operations preview panel "Open full order" action
 * - Direct URL navigation /operations/orders/:orderId
 */
export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: allOrders = [], isLoading, refetch, isRefetching } = useQuery(ordersQueryOptions());

  if (!orderId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-slate-600">Invalid order ID</div>
        <Link
          to={routes.operations}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Back to Operations
        </Link>
      </div>
    );
  }

  const order = allOrders.find((o) => o.id === orderId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-slate-600">Order not found</div>
        <Link
          to={routes.operations}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Back to Operations
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to={routes.operations}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Back to Operations"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{order.externalNumber}</h1>
              <div className="mt-1 text-xs text-slate-500">Order workspace</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Refresh order"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Order Detail (Full Editing Surface) ──────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-4xl p-6">
          <OrderDrawer orderId={orderId} onClose={() => null} mode="full" />
        </div>
      </div>
    </div>
  );
}
