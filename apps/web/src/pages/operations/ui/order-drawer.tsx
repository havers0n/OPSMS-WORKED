import { useQuery } from '@tanstack/react-query';
import { AlertCircle, RefreshCw, Search, X } from 'lucide-react';
import { useState } from 'react';
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
  getPrimaryTransitionTarget
} from '@/entities/order/lib/order-actions';

function primaryAction(order: Pick<Order, 'status' | 'lines' | 'waveId' | 'waveName'>) {
  const target = getPrimaryTransitionTarget(order.status);
  if (!target) return { target: null, reason: null as string | null };
  if (target === 'ready' && order.lines.length === 0)
    return { target, reason: 'Add at least one line before marking ready.' };
  if (target === 'released' && order.waveId)
    return { target, reason: `Release is controlled by wave ${order.waveName ?? order.waveId}.` };
  return { target, reason: null };
}

function TaskCard({ task }: { task: PickTaskSummary }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-900">Pick task</span>
        <span className="text-xs text-slate-500">{task.status}</span>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {task.completedSteps}/{task.totalSteps} steps complete
      </div>
      <div className="mt-1 text-xs text-slate-500">Exceptions: {task.exceptionSteps}</div>
    </div>
  );
}

function ProductLineEditor({ order }: { order: Order }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const { data: products = [], isLoading } = useProductsSearch(search);
  const addLine = useAddOrderLine(order.id);
  const editable = canEditLines(order.status);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-sm font-medium text-slate-900">Add catalog product</div>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={!editable}
          placeholder="Search products"
          className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-100"
        />
      </label>
      <div className="mt-2 max-h-36 overflow-auto rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <div className="p-3 text-sm text-slate-500">Loading products…</div>
        ) : (
          products.map((product) => (
            <button
              key={product.id}
              type="button"
              disabled={!editable}
              onClick={() => setSelected(product)}
              className={`block w-full px-3 py-2 text-left text-sm transition ${selected?.id === product.id ? 'bg-cyan-50' : 'hover:bg-slate-50'}`}
            >
              <div className="font-medium text-slate-900">{product.name}</div>
              <div className="text-xs text-slate-500">{product.sku ?? product.externalProductId}</div>
            </button>
          ))
        )}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_96px_auto] gap-2">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {selected ? `${selected.name} (${selected.sku ?? selected.externalProductId})` : 'Select a product'}
        </div>
        <input
          type="number"
          min={1}
          value={qty}
          disabled={!editable}
          onChange={(e) => setQty(e.target.value)}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-100"
        />
        <button
          type="button"
          disabled={!editable || addLine.isPending}
          onClick={() => {
            const parsed = Number(qty);
            if (!selected) return setError('Select a product.');
            if (!Number.isInteger(parsed) || parsed <= 0) return setError('Quantity must be positive.');
            setError(null);
            addLine.mutate(
              { productId: selected.id, qtyRequired: parsed },
              {
                onSuccess: () => {
                  setSelected(null);
                  setQty('1');
                  setSearch('');
                }
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

export function OrderDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: order, isLoading } = useQuery(orderQueryOptions(orderId));
  const { data: execution = [] } = useQuery(orderExecutionQueryOptions(orderId));
  const transition = useTransitionOrderStatus();
  const removeLine = useRemoveOrderLine(orderId);

  if (isLoading || !order) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const action = primaryAction(order);
  const editable = canEditLines(order.status);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Order</div>
            <div className="text-lg font-semibold text-slate-900">{order.externalNumber}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                {getOrderStatusLabel(order.status)}
              </span>
              {order.waveId ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Wave: {order.waveName ?? order.waveId}
                </span>
              ) : null}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {order.waveId ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Release is controlled by the wave.
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {editable ? <ProductLineEditor order={order} /> : null}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-900">Lines</div>
            <div className="text-xs text-slate-500">{order.lines.length} total</div>
          </div>
          {order.lines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">
              No lines yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {order.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{line.name}</div>
                        <div className="text-xs text-slate-500">{line.sku}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {line.qtyPicked} / {line.qtyRequired}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{line.status}</td>
                      <td className="px-3 py-2 text-right">
                        {editable ? (
                          <button
                            type="button"
                            disabled={removeLine.isPending}
                            onClick={() => removeLine.mutate(line.id)}
                            className="text-xs font-medium text-red-600 disabled:opacity-50"
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
        {execution.length > 0 ? (
          <div className="space-y-2">
            {execution.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="flex flex-wrap gap-2">
          {action.target ? (
            <button
              type="button"
              disabled={Boolean(action.reason) || transition.isPending}
              onClick={() =>
                transition.mutate({ orderId: order.id, status: action.target as OrderStatus })
              }
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {transition.isPending ? 'Updating…' : getOrderStatusLabel(action.target)}
            </button>
          ) : null}
          <button
            type="button"
            disabled={transition.isPending}
            onClick={() => transition.mutate({ orderId: order.id, status: 'cancelled' })}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {action.reason ? <div className="mt-2 text-xs text-slate-500">{action.reason}</div> : null}
      </div>
    </div>
  );
}
