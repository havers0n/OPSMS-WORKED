import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ChevronDown, ChevronRight, ChevronUp, RefreshCw, Search } from 'lucide-react';
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
import { useOpenPickingPlan } from '@/features/picking-planning-navigation/model/use-open-picking-plan';
import { pickTaskDetailPath, routes } from '@/shared/config/routes';

/**
 * Full Order Workspace
 *
 * Primary editing surface for a single order.
 * Information hierarchy: identity → status summary → warnings → lines → editing area.
 *
 * Route: /operations/orders/:orderId
 * Reached from: "Open full order" CTA in preview panels, direct URL navigation.
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
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${styles[color]}`}>
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
      className="block rounded-lg border border-slate-200 p-3 text-sm transition hover:border-cyan-300 hover:bg-cyan-50/40"
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

/** Add product form — collapsible, positioned below the lines table as a secondary editing area. */
function AddProductSection({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const { data: products = [], isLoading } = useProductsSearch(search);
  const addLine = useAddOrderLine(order.id);

  return (
    <div className="border-t border-slate-200 pt-3">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-1 text-left"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Add product to order
        </span>
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
          : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search catalog…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-100"
            />
          </label>

          {(search || products.length > 0) && (
            <div className="max-h-36 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              {isLoading ? (
                <div className="p-3 text-sm text-slate-400">Loading…</div>
              ) : products.length === 0 ? (
                <div className="p-3 text-sm text-slate-400">No products found.</div>
              ) : (
                products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelected(product)}
                    className={`block w-full px-3 py-2 text-left text-sm transition ${
                      selected?.id === product.id
                        ? 'bg-cyan-50 text-cyan-900'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate font-medium text-slate-800">{product.name}</div>
                    <div className="text-xs text-slate-400">
                      {product.sku ?? product.externalProductId}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex flex-1 items-center truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
              {selected
                ? `${selected.name} · ${selected.sku ?? selected.externalProductId}`
                : 'Select a product above'}
            </div>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm tabular-nums outline-none focus:border-cyan-400"
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
              className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-50"
            >
              {addLine.isPending ? 'Adding…' : '+ Add line'}
            </button>
          </div>
          {error ? <div className="text-xs text-red-500">{error}</div> : null}
        </div>
      )}
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="tabular-nums font-semibold text-slate-700">{value}</span>
      <span className="text-slate-400">{label}</span>
    </span>
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
  const { openForOrder } = useOpenPickingPlan();

  // ── Guards ──────────────────────────────────────────────────────────────

  if (!orderId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-slate-500">Invalid order ID</div>
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
        <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-slate-500">Order not found</div>
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
  const canPlanPicking = order.lines.length > 0;

  const hasWarnings =
    Boolean(order.waveId) ||
    order.status === 'ready' ||
    Boolean(transitionError) ||
    Boolean(action.reason);

  // Summary stats derived from lines
  const totalUnits   = order.lines.reduce((s, l) => s + l.qtyRequired, 0);
  const pickedUnits  = order.lines.reduce((s, l) => s + l.qtyPicked, 0);
  const reservedUnits = order.lines.reduce((s, l) => s + l.reservedQty, 0);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50">

      {/* ── Header row ───────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">

          {/* Back navigation */}
          <Link
            to={routes.operations}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Back to Operations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Identity */}
          <div className="flex flex-1 min-w-0 items-center gap-2.5">
            <h1 className="truncate text-base font-bold text-slate-900 leading-none">
              {order.externalNumber}
            </h1>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getOrderStatusColor(order.status)}`}
            >
              {getOrderStatusLabel(order.status)}
            </span>
            {order.waveId ? (
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Wave: {order.waveName ?? order.waveId}
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-400">
                Standalone
              </span>
            )}
          </div>

          {/* Lifecycle actions — clear visual hierarchy */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={!canPlanPicking}
              title={!canPlanPicking ? 'Add order lines before planning picking.' : undefined}
              onClick={() => openForOrder(order.id)}
              className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Plan picking
            </button>

            <div className="mx-1 h-4 w-px bg-slate-200" />

            {/* Secondary: rollback (outline, only when ready) */}
            {order.status === 'ready' ? (
              <button
                type="button"
                disabled={transition.isPending}
                onClick={() => transition.mutate({ orderId: order.id, status: 'draft' })}
                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                Rollback to draft
              </button>
            ) : null}

            {/* Primary: filled, prominent */}
            {action.target ? (
              <button
                type="button"
                disabled={Boolean(action.reason) || transition.isPending}
                title={action.reason ?? undefined}
                onClick={() =>
                  transition.mutate({ orderId: order.id, status: action.target as OrderStatus })
                }
                className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {transition.isPending
                  ? 'Updating…'
                  : getPrimaryActionLabel(order.status, action.target)}
              </button>
            ) : null}

            {/* Separator */}
            <div className="mx-1 h-4 w-px bg-slate-200" />

            {/* Destructive: text-only, visually recedes */}
            <button
              type="button"
              disabled={transition.isPending}
              onClick={() => transition.mutate({ orderId: order.id, status: 'cancelled' })}
              className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
            >
              Cancel order
            </button>

            {/* Utility: icon only */}
            <button
              type="button"
              onClick={() => void refetch()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-500"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary strip — one-glance order state ────────────────────────── */}
      <div className="shrink-0 border-b border-slate-100 bg-white px-6 py-2">
        <div className="flex items-center gap-5 text-xs">
          <StatChip label="lines" value={order.lines.length} />
          <span className="text-slate-200">·</span>
          <StatChip label="units required" value={totalUnits} />
          <span className="text-slate-200">·</span>
          <StatChip label="picked" value={pickedUnits} />
          <span className="text-slate-200">·</span>
          <StatChip label="reserved" value={reservedUnits} />
          {order.priority !== 0 ? (
            <>
              <span className="text-slate-200">·</span>
              <StatChip label="priority" value={order.priority} />
            </>
          ) : null}
          <span className="ml-auto text-slate-300">
            {new Date(order.createdAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* ── Workspace body ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="flex gap-6 p-6">

          {/* ── Main column ────────────────────────────────────────────── */}
          <div className="flex flex-1 flex-col gap-5 min-w-0">

            {/* 1. Lifecycle / warnings — read these before the table */}
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
                    Stock reserved. Roll back to Draft to edit lines.
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

            {/* 2. Lines section — primary content, no editing yet */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Order Lines
                </h2>
                <span className="text-xs text-slate-400">
                  {order.lines.length === 0
                    ? 'No lines added'
                    : `${order.lines.length} line${order.lines.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              {order.lines.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                  {editable
                    ? 'No lines yet. Use the form below to add products.'
                    : 'This order has no lines.'}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Product</th>
                        <th className="px-4 py-2.5 font-medium">Picked / Req</th>
                        <th className="px-4 py-2.5 font-medium">Reserved</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {order.lines.map((line) => (
                        <tr key={line.id} className="group hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{line.name}</div>
                            <div className="mt-0.5 text-xs text-slate-400">{line.sku}</div>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            <span className={line.qtyPicked >= line.qtyRequired ? 'text-emerald-600' : ''}>
                              {line.qtyPicked}
                            </span>
                            <span className="text-slate-300"> / </span>
                            {line.qtyRequired}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {line.reservedQty}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-500 capitalize">{line.status}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {editable ? (
                              <button
                                type="button"
                                disabled={removeLine.isPending}
                                onClick={() => removeLine.mutate(line.id)}
                                className="text-xs text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500 focus:opacity-100 disabled:opacity-50"
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

              {/* 3. Editing area — below the table, visually secondary */}
              {editable ? <AddProductSection order={order} /> : null}
            </section>
          </div>

          {/* ── Side column: pick tasks ─────────────────────────────────── */}
          {execution.length > 0 ? (
            <aside className="w-64 shrink-0">
              <div className="mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pick Tasks
                </h2>
                <div className="mt-0.5 text-xs text-slate-400">
                  {execution.length} task{execution.length !== 1 ? 's' : ''}
                </div>
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
