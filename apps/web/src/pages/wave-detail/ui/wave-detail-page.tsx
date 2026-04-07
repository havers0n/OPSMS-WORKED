import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, PackagePlus, RefreshCw, X } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { OrderStatus, OrderSummary, WaveStatus } from '@wos/domain';
import { useCreateOrder, useTransitionOrderStatus } from '@/entities/order/api/mutations';
import { ordersQueryOptions } from '@/entities/order/api/queries';
import { getOrderStatusColor, getOrderStatusLabel, getPrimaryTransitionTarget } from '@/entities/order/lib/order-actions';
import { useAttachOrderToWave, useDetachOrderFromWave, useTransitionWaveStatus } from '@/entities/wave/api/mutations';
import { waveKeys, waveQueryOptions } from '@/entities/wave/api/queries';
import { routes } from '@/shared/config/routes';
import { OrderDrawer } from '@/features/order-detail/ui/order-drawer';

// ── Wave status helpers ────────────────────────────────────────────────────────

const waveStatusLabel: Record<WaveStatus, string> = {
  draft: 'Draft', ready: 'Ready', released: 'Released',
  in_progress: 'In progress', completed: 'Completed', partial: 'Partial', closed: 'Closed'
};

function getWaveStatusColor(status: WaveStatus) {
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

function getWaveNextAction(status: WaveStatus, totalOrders: number, blockingOrderCount: number) {
  switch (status) {
    case 'draft': return { target: 'ready' as WaveStatus, label: 'Mark ready', reason: totalOrders === 0 ? 'Add at least one order first.' : null };
    case 'ready': return { target: 'released' as WaveStatus, label: 'Release wave', reason: blockingOrderCount > 0 ? 'Not all orders are ready.' : null };
    case 'released': return { target: 'closed' as WaveStatus, label: 'Close wave', reason: null };
    default: return { target: null, label: null, reason: null };
  }
}

// ── Add Order Modal ────────────────────────────────────────────────────────────

function AddOrderModal({ waveId, onClose }: { waveId: string; onClose: () => void }) {
  const [tab, setTab] = useState<'create' | 'attach'>('create');
  const [externalNumber, setExternalNumber] = useState('');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const createOrder = useCreateOrder();
  const attach = useAttachOrderToWave();

  function handleSuccess() {
    void queryClient.invalidateQueries({ queryKey: waveKeys.all });
    onClose();
  }
  const { data: allOrders = [] } = useQuery(ordersQueryOptions());

  // Only unattached orders can be attached
  const availableOrders = allOrders.filter((o) => !o.waveId && o.status === 'draft');
  const filtered = search
    ? availableOrders.filter((o) => o.externalNumber.toLowerCase().includes(search.toLowerCase()))
    : availableOrders;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="text-lg font-semibold text-slate-900">Add order to wave</div>

        {/* Tabs */}
        <div className="mt-4 flex rounded-xl border border-slate-200 p-0.5">
          {(['create', 'attach'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t === 'create' ? 'Create new' : 'Attach existing'}
            </button>
          ))}
        </div>

        {tab === 'create' ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!externalNumber.trim()) return;
              createOrder.mutate(
                { externalNumber: externalNumber.trim(), waveId },
                { onSuccess: handleSuccess }
              );
            }}
          >
            <input
              value={externalNumber}
              onChange={(e) => setExternalNumber(e.target.value)}
              placeholder="e.g. ORD-1001"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={createOrder.isPending || !externalNumber.trim()} className="flex-1 rounded-xl bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50">
                {createOrder.isPending ? 'Creating…' : 'Create & add'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders…"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
              autoFocus
            />
            <div className="max-h-48 overflow-auto rounded-xl border border-slate-200">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No available orders</div>
              ) : (
                filtered.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    disabled={attach.isPending}
                    onClick={() => attach.mutate({ waveId, orderId: order.id }, { onSuccess: handleSuccess })}
                    className="block w-full px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                  >
                    <div className="font-medium text-slate-900">{order.externalNumber}</div>
                    <div className="text-xs text-slate-500">{order.lineCount} lines</div>
                  </button>
                ))
              )}
            </div>
            <button type="button" onClick={onClose} className="w-full rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wave Order Card (expandable) ───────────────────────────────────────────────

function WaveOrderCard({ order, waveId, isExpanded, onToggle }: { order: OrderSummary; waveId: string; isExpanded: boolean; onToggle: () => void }) {
  const detach = useDetachOrderFromWave();
  const orderTransition = useTransitionOrderStatus();
  const target = getPrimaryTransitionTarget(order.status);
  const canTransition = Boolean(target) && !(target === 'ready' && order.lineCount === 0);
  const pct = order.unitCount > 0 ? Math.round((order.pickedUnitCount / order.unitCount) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Card header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? onToggle() : undefined}
        className="flex w-full cursor-pointer items-center gap-4 p-4 text-left transition hover:bg-slate-50"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{order.externalNumber}</span>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}>
              {getOrderStatusLabel(order.status)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-xs text-slate-500">{order.lineCount} lines · {order.unitCount} units</span>
            {order.unitCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{pct}%</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {canTransition && target && (
            <button
              type="button"
              disabled={orderTransition.isPending && orderTransition.variables?.orderId === order.id}
              onClick={() => orderTransition.mutate({ orderId: order.id, status: target as OrderStatus })}
              className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
            >
              {orderTransition.isPending && orderTransition.variables?.orderId === order.id ? '…' : getOrderStatusLabel(target)}
            </button>
          )}
          <button
            type="button"
            disabled={detach.isPending}
            onClick={() => detach.mutate({ waveId, orderId: order.id })}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Expanded: inline order detail */}
      {isExpanded && (
        <div className="border-t border-slate-100">
          <div className="max-h-[480px] overflow-auto">
            <OrderDrawer orderId={order.id} onClose={onToggle} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function WaveDetailPage() {
  const { id: waveId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAddOrder, setShowAddOrder] = useState(false);

  const { data: wave, isLoading, refetch, isRefetching } = useQuery(waveQueryOptions(waveId ?? null));

  // URL is the source of truth for selected order; validate against wave orders to handle stale/invalid params
  const rawOrderParam = searchParams.get('order');
  const selectedOrderId = wave?.orders.some((o) => o.id === rawOrderParam) ? rawOrderParam : null;

  function openOrder(orderId: string) {
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('order', orderId); return next; });
  }
  function closeOrder() {
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('order'); return next; });
  }
  const waveTransition = useTransitionWaveStatus();

  if (isLoading || !wave) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const action = getWaveNextAction(wave.status, wave.totalOrders, wave.blockingOrderCount);

  return (
    <div className="flex h-full w-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">

        {/* ── Back link ───────────────────────────────────────── */}
        <Link
          to={routes.operations}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Operations
        </Link>

        {/* ── Wave header ─────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{wave.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getWaveStatusColor(wave.status)}`}>
                {waveStatusLabel[wave.status]}
              </span>
              <span className="text-sm text-slate-500">
                {wave.totalOrders} orders · {wave.readyOrders} ready
              </span>
              {wave.blockingOrderCount > 0 && (
                <span className="text-sm text-amber-600">{wave.blockingOrderCount} blocking</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
            {action.target && (
              <button
                type="button"
                disabled={Boolean(action.reason) || waveTransition.isPending}
                title={action.reason ?? undefined}
                onClick={() => waveTransition.mutate({ waveId: wave.id, status: action.target as WaveStatus })}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {waveTransition.isPending ? '…' : action.label}
              </button>
            )}
          </div>
        </div>

        {action.reason && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {action.reason}
          </div>
        )}

        {/* ── Stale / invalid order param notice ──────────────── */}
        {rawOrderParam && !selectedOrderId && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>Selected order was not found in this wave.</span>
            <button
              type="button"
              onClick={closeOrder}
              className="shrink-0 rounded p-0.5 hover:bg-amber-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Orders section ──────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Orders <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">{wave.orders.length}</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowAddOrder(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              <PackagePlus className="h-3.5 w-3.5" />
              Add order
            </button>
          </div>

          {wave.orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
              <div className="text-sm text-slate-500">No orders in this wave yet.</div>
              <button
                type="button"
                onClick={() => setShowAddOrder(true)}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
              >
                Add first order
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {wave.orders.map((order) => (
                <WaveOrderCard
                  key={order.id}
                  order={order}
                  waveId={wave.id}
                  isExpanded={selectedOrderId === order.id}
                  onToggle={() => selectedOrderId === order.id ? closeOrder() : openOrder(order.id)}
                />
              ))}
            </div>
          )}
        </section>

      </div>

      {showAddOrder && waveId && (
        <AddOrderModal waveId={waveId} onClose={() => setShowAddOrder(false)} />
      )}
    </div>
  );
}
