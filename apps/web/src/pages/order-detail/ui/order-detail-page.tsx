import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Order, OrderStatus, PickTaskSummary, Product } from '@wos/domain';
import { useProductsSearch } from '@/entities/product/api/use-products-search';
import {
  useAddOrderLine,
  useRemoveOrderLine,
  useTransitionOrderStatus
} from '@/entities/order/api/mutations';
import { orderExecutionQueryOptions, orderQueryOptions } from '@/entities/order/api/queries';
import {
  canEditLines,
  getOrderStatusColor,
  getOrderStatusLabel,
  getPrimaryActionLabel,
  getPrimaryOrderAction,
  getTransitionErrorMessage
} from '@/entities/order/lib/order-actions';
import {
  getPickTaskStatusColor,
  getPickTaskStatusLabel
} from '@/entities/pick-task/lib/pick-task-actions';
import { pickTaskDetailPath, routes } from '@/shared/config/routes';

/**
 * Full Order Workspace
 *
 * Primary editing surface for a single order:
 * - Lifecycle actions (commit, rollback, cancel, close) live in the page header
 * - Lines section: full editable table with add-product form (when draft)
 * - Pick tasks section: live execution state per task
 *
 * Route: /operations/orders/:orderId
 * Reached from: "Open full order" CTA in preview panels, direct URL navigation
 */

// ── Sub-components ─────────────────────────────────────────────────────────

function AlertBanner({
  color,
  children,
}: {
  color: 'amber' | 'blue' | 'red' | 'slate';
  children: React.ReactNode;
}) {
  const styles: Record<typeof color, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue:  'border-blue-200 bg-blue-50 text-blue-800',
    red:   'border-red-200 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${styles[color]}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function TaskCard({
  task,
  orderId,
  waveId,
}: {
  task: PickTaskSummary;
  orderId: string;
  waveId?: string;
}) {
  const pct =
    task.totalSteps > 0
      ? Math.round((task.completedSteps / task.totalSteps) * 100)
      : 0;

  return (
    <Link
      to={pickTaskDetailPath(task.id, { orderId, waveId })}
      className="block rounded-xl border border-slate-200 p-3 text-sm transition hover:border-cyan-300 hover:bg-cyan-50/40"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{task.taskNumber}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPickTaskStatusColor(task.status)}`}
          >
            {getPickTaskStatusLabel(task.status)}
          </span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-slate-500">
          {task.completedSteps}/{task.totalSteps} steps
        </span>
      </div>

      {task.exceptionSteps > 0 && (
        <div className="mt-1 text-xs text-orange-600">
          {task.exceptionSteps} exception{task.exceptionSteps !== 1 ? 's' : ''}
        </div>
      )}
    </Link>
  );
}

function AddProductSection({ order }: { order: Order }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const { data: products = [], isLoading } = useProductsSearch(search);
  const addLine = useAddOrderLine(order.id);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 text-sm font-medium text-slate-900">Add catalog product</div>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-cyan-500"
        />
      </label>

      {(search || products.length > 0) && (
        <div className="mt-2 max-h-36 overflow-auto rounded-xl border border-slate-200 bg-white">
          {isLoading ? (
            <div className="p-3 text-sm text-slate-500">Loading products…</div>
          ) : products.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">No products found.</div>
          ) : (
            products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelected(product)}
                className={`block w-full px-3 py-2 text-left text-sm transition ${
                  selected?.id === product.id ? 'bg-cyan-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="font-medium text-slate-900">{product.name}</div>
                <div className="text-xs text-slate-500">
                  {product.sku ?? product.externalProductId}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-[1fr_96px_auto] gap-2">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {selected
            ? `${selected.name} (${selected.sku ?? selected.externalProductId})`
            : 'Select a product above'}
        </div>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500"
        />
        <button
          type="button"
          disabled={addLine.isPending}
          onClick={() => {
            const parsed = Number(qty);
            if (!selected) return setError('Select a product.');
            if (!Number.isInteger(parsed) || parsed <= 0)
              return setError('Quantity must be a positive integer.');
            setError(null);
            addLine.mutate(
              { productId: selected.id, qtyRequired: parsed },
              {
                onSuccess: () => {
                  setSelected(null);
                  setQty('1');
                  setSearch('');
                },
              }
            );
          }}
          className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {addLine.isPending ? 'Adding…' : 'Add line'}
        </button>
      </div>
      {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();

  const { data: order, isLoading, refetch, isRefetching } = useQuery(
    orderQueryOptions(orderId ?? null)
  );
  const { data: execution = [] } = useQuery(orderExecutionQueryOptions(orderId ?? null));
  const transition = useTransitionOrderStatus();
  const removeLine = useRemoveOrderLine(orderId ?? '');

  // ── Guards ──────────────────────────────────────────────────────────────

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

  // ── Derived state ────────────────────────────────────────────────────────

  const action = getPrimaryOrderAction(order);
  const editable = canEditLines(order.status);
  const transitionError = getTransitionErrorMessage(transition.error);

  const hasWarnings =
    Boolean(order.waveId) ||
    order.status === 'ready' ||
    Boolean(transitionError) ||
    Boolean(action.reason);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-start gap-4">

          {/* Back navigation */}
          <Link
            to={routes.operations}
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Back to Operations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">{order.externalNumber}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getOrderStatusColor(order.status)}`}
              >
                {getOrderStatusLabel(order.status)}
              </span>
              {order.waveId ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Wave: {order.waveName ?? order.waveId}
                </span>
              ) : (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                  Standalone
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Created {new Date(order.createdAt).toLocaleString()}
            </div>
          </div>

          {/* Lifecycle actions */}
          <div className="flex shrink-0 items-center gap-2">
            {order.status === 'ready' ? (
              <button
                type="button"
                disabled={transition.isPending}
                onClick={() => transition.mutate({ orderId: order.id, status: 'draft' })}
                className="rounded-xl border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                Rollback to draft
              </button>
            ) : null}

            {action.target ? (
              <button
                type="button"
                disabled={Boolean(action.reason) || transition.isPending}
                title={action.reason ?? undefined}
                onClick={() =>
                  transition.mutate({ orderId: order.id, status: action.target as OrderStatus })
                }
                className="rounded-xl bg-cyan-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {transition.isPending
                  ? 'Updating…'
                  : getPrimaryActionLabel(order.status, action.target)}
              </button>
            ) : null}

            <button
              type="button"
              disabled={transition.isPending}
              onClick={() => transition.mutate({ orderId: order.id, status: 'cancelled' })}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="ml-1 h-6 w-px bg-slate-200" />

            <button
              type="button"
              onClick={() => void refetch()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Workspace body ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="flex gap-6 p-6">

          {/* ── Main column: warnings + lines ──────────────────────────── */}
          <div className="flex flex-1 flex-col gap-4 min-w-0">

            {/* Warnings */}
            {hasWarnings ? (
              <div className="flex flex-col gap-2">
                {order.waveId ? (
                  <AlertBanner color="amber">
                    Release is controlled by wave {order.waveName ?? order.waveId}. Use the Wave
                    workspace to release this order.
                  </AlertBanner>
                ) : null}
                {order.status === 'ready' ? (
                  <AlertBanner color="blue">
                    This order is committed and stock is reserved. Roll back to Draft to edit lines.
                  </AlertBanner>
                ) : null}
                {transitionError ? (
                  <AlertBanner color="red">{transitionError}</AlertBanner>
                ) : null}
                {action.reason && !transitionError ? (
                  <AlertBanner color="slate">{action.reason}</AlertBanner>
                ) : null}
              </div>
            ) : null}

            {/* Order Lines */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Order Lines
                </h2>
                <span className="text-xs text-slate-400">{order.lines.length} total</span>
              </div>

              {editable ? <AddProductSection order={order} /> : null}

              <div className="mt-3">
                {order.lines.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400">
                    No lines yet. Add a product above to get started.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Product</th>
                          <th className="px-4 py-2.5">Picked / Req</th>
                          <th className="px-4 py-2.5">Reserved</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {order.lines.map((line) => (
                          <tr key={line.id} className="bg-white">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{line.name}</div>
                              <div className="text-xs text-slate-500">{line.sku}</div>
                            </td>
                            <td className="px-4 py-3 tabular-nums text-slate-600">
                              {line.qtyPicked} / {line.qtyRequired}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-slate-600">
                              {line.reservedQty}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{line.status}</td>
                            <td className="px-4 py-3 text-right">
                              {editable ? (
                                <button
                                  type="button"
                                  disabled={removeLine.isPending}
                                  onClick={() => removeLine.mutate(line.id)}
                                  className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ── Side column: pick tasks ─────────────────────────────────── */}
          {execution.length > 0 ? (
            <aside className="w-72 shrink-0">
              <div className="mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Pick Tasks
                </h2>
                <div className="mt-0.5 text-xs text-slate-400">{execution.length} task{execution.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="flex flex-col gap-2">
                {execution.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    orderId={order.id}
                    waveId={order.waveId ?? undefined}
                  />
                ))}
              </div>
            </aside>
          ) : null}

        </div>
      </div>
    </div>
  );
}
