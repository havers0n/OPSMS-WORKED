import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackagePlus, RefreshCw } from 'lucide-react';
import type { OrderStatus, OrderSummary } from '@wos/domain';
import {
  useCreateOrder,
  useTransitionOrderStatus
} from '@/entities/order/api/mutations';
import { ordersQueryOptions } from '@/entities/order/api/queries';
import {
  getOrderStatusColor,
  getOrderStatusLabel,
  getProgressLabel,
  getPrimaryTransitionTarget
} from '@/entities/order/lib/order-actions';
import { OrderPreview } from '@/features/order-detail/ui/order-preview';

// 9 статусов сгруппированы в 4 понятные вкладки
type TabGroup = 'all' | 'active' | 'done' | 'issues';

const TAB_GROUPS: { id: TabGroup; label: string; statuses: OrderStatus[] }[] = [
  { id: 'all', label: 'All', statuses: [] },
  {
    id: 'active',
    label: 'Active',
    statuses: ['draft', 'ready', 'released', 'picking']
  },
  { id: 'done', label: 'Done', statuses: ['picked', 'closed'] },
  { id: 'issues', label: 'Issues', statuses: ['partial', 'cancelled'] }
];

/**
 * Orders page uses OrderSummary with lineCount property.
 * Adapts to shared order workflow rules.
 */
function getOrderListActionState(
  order: Pick<OrderSummary, 'status' | 'lineCount' | 'waveId' | 'waveName'>
) {
  const target = getPrimaryTransitionTarget(order.status);
  if (!target) return { target: null, reason: null as string | null };
  if (target === 'ready' && order.lineCount === 0)
    return { target, reason: 'Add at least one line before marking ready.' };
  if (target === 'released' && order.waveId)
    return { target, reason: `Release is controlled by wave ${order.waveName ?? order.waveId}.` };
  return { target, reason: null };
}

function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const [externalNumber, setExternalNumber] = useState('');
  const createOrder = useCreateOrder();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="text-lg font-semibold text-slate-900">Create order</div>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!externalNumber.trim()) return;
            createOrder.mutate(
              { externalNumber: externalNumber.trim() },
              { onSuccess: onClose }
            );
          }}
        >
          <input
            value={externalNumber}
            onChange={(e) => setExternalNumber(e.target.value)}
            placeholder="ORD-1001"
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createOrder.isPending || !externalNumber.trim()}
              className="flex-1 rounded-xl bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {createOrder.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabGroup>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const transition = useTransitionOrderStatus();
  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery(ordersQueryOptions());

  const activeGroup = TAB_GROUPS.find((g) => g.id === activeTab)!;
  const visibleOrders =
    activeGroup.statuses.length === 0
      ? orders
      : orders.filter((o) => activeGroup.statuses.includes(o.status));

  // Counts per group for badges
  const counts = TAB_GROUPS.reduce<Record<TabGroup, number>>(
    (acc, group) => {
      acc[group.id] =
        group.statuses.length === 0
          ? orders.length
          : orders.filter((o) => group.statuses.includes(o.status)).length;
      return acc;
    },
    { all: 0, active: 0, done: 0, issues: 0 }
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Orders list */}
      <div className={`flex flex-col overflow-hidden ${selectedOrderId ? 'flex-1' : 'w-full'}`}>
        <div className="m-4 flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">Orders</div>
              <div className="text-sm text-slate-500">{orders.length} total</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refetch()}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
              >
                <PackagePlus className="h-4 w-4" />
                Create order
              </button>
            </div>
          </header>

          {/* 4-group tabs */}
          <div className="flex border-b border-slate-200 px-5">
            {TAB_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveTab(group.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition ${
                  activeTab === group.id
                    ? 'border-cyan-600 text-cyan-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {group.label}
                {counts[group.id] > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      activeTab === group.id
                        ? 'bg-cyan-100 text-cyan-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {counts[group.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : visibleOrders.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                No orders in this filter.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Lines</th>
                    <th className="px-4 py-3">Units</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visibleOrders.map((order) => {
                    const action = getOrderListActionState(order);
                    const isSelected = selectedOrderId === order.id;
                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrderId(isSelected ? null : order.id)}
                        className={`cursor-pointer transition hover:bg-slate-50 ${isSelected ? 'bg-cyan-50/60' : ''}`}
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">{order.externalNumber}</div>
                          {order.waveId ? (
                            <div className="text-xs text-amber-700">
                              Wave: {order.waveName ?? order.waveId}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}
                          >
                            {getOrderStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{order.lineCount}</td>
                        <td className="px-4 py-3 text-slate-600">{order.unitCount}</td>
                        <td className="px-4 py-3 text-slate-500">{getProgressLabel(order)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="flex items-center justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {action.target ? (
                              <button
                                type="button"
                                disabled={
                                  Boolean(action.reason) ||
                                  (transition.isPending &&
                                    transition.variables?.orderId === order.id)
                                }
                                title={action.reason ?? undefined}
                                onClick={() =>
                                  transition.mutate({
                                    orderId: order.id,
                                    status: action.target as OrderStatus
                                  })
                                }
                                className="rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
                              >
                                {transition.isPending &&
                                transition.variables?.orderId === order.id
                                  ? '...'
                                  : getOrderStatusLabel(action.target)}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Order preview panel */}
      {selectedOrderId ? (
        <div className="m-4 ml-0 w-[360px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white flex flex-col">
          <OrderPreview orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
        </div>
      ) : null}

      {showCreate ? <CreateOrderModal onClose={() => setShowCreate(false)} /> : null}
    </div>
  );
}
