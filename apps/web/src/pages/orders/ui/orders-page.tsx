import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronRight, PackagePlus, RefreshCw, Search, X } from 'lucide-react';
import type { Order, OrderStatus, OrderSummary, PickTaskSummary, Product } from '@wos/domain';
import { useProductsSearch } from '@/entities/product/api/use-products-search';
import { useAddOrderLine, useCreateOrder, useRemoveOrderLine, useTransitionOrderStatus } from '@/entities/order/api/mutations';
import { orderExecutionQueryOptions, orderQueryOptions, ordersQueryOptions } from '@/entities/order/api/queries';
import { canEditLines, getOrderStatusColor, getOrderStatusLabel, getPrimaryTransitionTarget, getProgressLabel } from '@/entities/order/lib/order-actions';

const tabs: Array<OrderStatus | 'all'> = ['all', 'draft', 'ready', 'released', 'picking', 'picked', 'partial', 'closed', 'cancelled'];

function primaryAction(order: Pick<OrderSummary, 'status' | 'lineCount' | 'waveId' | 'waveName'>) {
  const target = getPrimaryTransitionTarget(order.status);
  if (!target) return { target: null, reason: null as string | null };
  if (target === 'ready' && order.lineCount === 0) return { target, reason: 'Add at least one line before marking ready.' };
  if (target === 'released' && order.waveId) return { target, reason: `Release is controlled by wave ${order.waveName ?? order.waveId}.` };
  return { target, reason: null };
}

function TaskCard({ task }: { task: PickTaskSummary }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-900">Pick task</span>
        <span className="text-xs text-slate-500">{task.status}</span>
      </div>
      <div className="mt-2 text-xs text-slate-500">{task.completedSteps}/{task.totalSteps} steps complete</div>
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
        <input value={search} onChange={(e) => setSearch(e.target.value)} disabled={!editable} placeholder="Search products" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-100" />
      </label>
      <div className="mt-2 max-h-36 overflow-auto rounded-xl border border-slate-200 bg-white">
        {isLoading ? <div className="p-3 text-sm text-slate-500">Loading products…</div> : products.map((product) => (
          <button key={product.id} type="button" disabled={!editable} onClick={() => setSelected(product)} className={`block w-full px-3 py-2 text-left text-sm transition ${selected?.id === product.id ? 'bg-cyan-50' : 'hover:bg-slate-50'}`}>
            <div className="font-medium text-slate-900">{product.name}</div>
            <div className="text-xs text-slate-500">{product.sku ?? product.externalProductId}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_96px_auto] gap-2">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{selected ? `${selected.name} (${selected.sku ?? selected.externalProductId})` : 'Select a product'}</div>
        <input type="number" min={1} value={qty} disabled={!editable} onChange={(e) => setQty(e.target.value)} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-100" />
        <button
          type="button"
          disabled={!editable || addLine.isPending}
          onClick={() => {
            const parsed = Number(qty);
            if (!selected) return setError('Select a product.');
            if (!Number.isInteger(parsed) || parsed <= 0) return setError('Quantity must be positive.');
            setError(null);
            addLine.mutate({ productId: selected.id, qtyRequired: parsed }, { onSuccess: () => { setSelected(null); setQty('1'); setSearch(''); } });
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

function OrderDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: order, isLoading } = useQuery(orderQueryOptions(orderId));
  const { data: execution = [] } = useQuery(orderExecutionQueryOptions(orderId));
  const transition = useTransitionOrderStatus();
  const removeLine = useRemoveOrderLine(orderId);

  if (isLoading || !order) return <div className="flex h-full items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-slate-400" /></div>;

  const action = primaryAction({ status: order.status, lineCount: order.lines.length, waveId: order.waveId, waveName: order.waveName });
  const editable = canEditLines(order.status);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Order</div>
            <div className="text-lg font-semibold text-slate-900">{order.externalNumber}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}>{getOrderStatusLabel(order.status)}</span>
              {order.waveId ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Wave: {order.waveName ?? order.waveId}</span> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        {order.waveId ? <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Release is controlled by the wave.</div> : null}
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-4">
        {editable ? <ProductLineEditor order={order} /> : null}
        <div>
          <div className="mb-2 flex items-center justify-between"><div className="text-sm font-medium text-slate-900">Lines</div><div className="text-xs text-slate-500">{order.lines.length} total</div></div>
          {order.lines.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">No lines yet.</div> : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr></thead>
                <tbody className="divide-y divide-slate-100 bg-white">{order.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2"><div className="font-medium text-slate-900">{line.name}</div><div className="text-xs text-slate-500">{line.sku}</div></td>
                    <td className="px-3 py-2 text-slate-600">{line.qtyPicked} / {line.qtyRequired}</td>
                    <td className="px-3 py-2 text-slate-600">{line.status}</td>
                    <td className="px-3 py-2 text-right">{editable ? <button type="button" disabled={removeLine.isPending} onClick={() => removeLine.mutate(line.id)} className="text-xs font-medium text-red-600 disabled:opacity-50">Remove</button> : null}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
        {execution.length > 0 ? <div className="space-y-2">{execution.map((task) => <TaskCard key={task.id} task={task} />)}</div> : null}
      </div>
      <div className="border-t border-slate-200 p-4">
        <div className="flex flex-wrap gap-2">
          {action.target ? <button type="button" disabled={Boolean(action.reason) || transition.isPending} onClick={() => transition.mutate({ orderId: order.id, status: action.target as OrderStatus })} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50">{transition.isPending ? 'Updating…' : getOrderStatusLabel(action.target)}</button> : null}
          <button type="button" disabled={transition.isPending} onClick={() => transition.mutate({ orderId: order.id, status: 'cancelled' })} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
        </div>
        {action.reason ? <div className="mt-2 text-xs text-slate-500">{action.reason}</div> : null}
      </div>
    </div>
  );
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
            createOrder.mutate({ externalNumber: externalNumber.trim() }, { onSuccess: onClose });
          }}
        >
          <input value={externalNumber} onChange={(e) => setExternalNumber(e.target.value)} placeholder="ORD-1001" className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={createOrder.isPending || !externalNumber.trim()} className="flex-1 rounded-xl bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50">{createOrder.isPending ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const transition = useTransitionOrderStatus();
  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery(ordersQueryOptions());
  const visibleOrders = activeTab === 'all' ? orders : orders.filter((order) => order.status === activeTab);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className={`flex flex-col overflow-hidden ${selectedOrderId ? 'flex-1' : 'w-full'}`}>
        <div className="m-4 flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><div className="text-lg font-semibold text-slate-900">Orders</div><div className="text-sm text-slate-500">{orders.length} total</div></div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void refetch()} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} /></button>
              <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"><PackagePlus className="h-4 w-4" />Create order</button>
            </div>
          </header>
          <div className="flex overflow-x-auto border-b border-slate-200 px-5">{tabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition ${activeTab === tab ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{tab === 'all' ? 'All' : getOrderStatusLabel(tab)}</button>)}</div>
          <div className="flex-1 overflow-auto">
            {isLoading ? <div className="flex h-32 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-slate-300" /></div> : visibleOrders.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-slate-500">No orders in this filter.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Order</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Lines</th><th className="px-4 py-3">Units</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100 bg-white">{visibleOrders.map((order) => {
                  const action = primaryAction(order);
                  return (
                    <tr key={order.id} className={`transition hover:bg-slate-50 ${selectedOrderId === order.id ? 'bg-cyan-50/60' : ''}`}>
                      <td className="px-5 py-3"><div className="font-medium text-slate-900">{order.externalNumber}</div>{order.waveId ? <div className="text-xs text-amber-700">Wave: {order.waveName ?? order.waveId}</div> : null}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}>{getOrderStatusLabel(order.status)}</span></td>
                      <td className="px-4 py-3 text-slate-600">{order.lineCount}</td>
                      <td className="px-4 py-3 text-slate-600">{order.unitCount}</td>
                      <td className="px-4 py-3 text-slate-500">{getProgressLabel(order)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3"><div className="flex items-center justify-end gap-2">{action.target ? <button type="button" disabled={Boolean(action.reason) || (transition.isPending && transition.variables?.orderId === order.id)} title={action.reason ?? undefined} onClick={() => transition.mutate({ orderId: order.id, status: action.target as OrderStatus })} className="rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-50">{transition.isPending && transition.variables?.orderId === order.id ? '...' : getOrderStatusLabel(action.target)}</button> : null}<button type="button" onClick={() => setSelectedOrderId(order.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ChevronRight className="h-3.5 w-3.5" /></button></div></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {selectedOrderId ? <div className="m-4 ml-0 w-[420px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"><OrderDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} /></div> : null}
      {showCreate ? <CreateOrderModal onClose={() => setShowCreate(false)} /> : null}
    </div>
  );
}
