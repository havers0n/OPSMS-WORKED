import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, ChevronRight, PackagePlus, RefreshCw, X } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { OrderStatus, OrderSummary, WaveStatus } from '@wos/domain';
import { useCreateOrder, useTransitionOrderStatus } from '@/entities/order/api/mutations';
import { ordersQueryOptions } from '@/entities/order/api/queries';
import { getOrderStatusColor, getOrderStatusLabel, getPrimaryTransitionTarget } from '@/entities/order/lib/order-actions';
import { useAttachOrderToWave, useDetachOrderFromWave, useTransitionWaveStatus } from '@/entities/wave/api/mutations';
import { waveKeys, waveQueryOptions } from '@/entities/wave/api/queries';
import { getWaveStatusColor, getWaveStatusLabel, getWavePrimaryAction } from '@/entities/wave/lib/wave-actions';
import { deriveWaveBlockers, getBlockerReasonLabel } from '@/entities/wave/lib/wave-blockers';
import { routes } from '@/shared/config/routes';
import { OrderPreview } from '@/features/order-detail/ui/order-preview';

// ── Wave workflow is now centralized in entities/wave/lib/wave-actions.ts ──

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

// ── Wave Blocker Panel ────────────────────────────────────────────────────────

function WaveBlockerPanel({
  waveOrders,
  onOpenOrder
}: {
  waveOrders: OrderSummary[];
  onOpenOrder: (orderId: string) => void;
}) {
  const blockers = deriveWaveBlockers({ orders: waveOrders });

  if (!blockers.blocked) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-amber-900">
            Wave release blocked ({blockers.count} {blockers.count === 1 ? 'issue' : 'issues'})
          </div>
          <div className="mt-3 space-y-2">
            {blockers.blockers.map((blocker) => (
              <button
                key={blocker.orderId}
                onClick={() => onOpenOrder(blocker.orderId)}
                type="button"
                className="block w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-left transition hover:border-amber-300 hover:bg-amber-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900">{blocker.externalNumber}</div>
                    <div className="mt-1 text-xs text-slate-600">{blocker.message}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                      {getBlockerReasonLabel(blocker.reason)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 text-xs text-amber-700">
            💡 Resolve these issues to proceed with wave release
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wave Order Row (compact, for list view) ────────────────────────────────────

function WaveOrderRow({ order, waveId, isSelected, onSelect }: { order: OrderSummary; waveId: string; isSelected: boolean; onSelect: () => void }) {
  const detach = useDetachOrderFromWave();
  const orderTransition = useTransitionOrderStatus();
  const target = getPrimaryTransitionTarget(order.status);
  const canTransition = Boolean(target) && !(target === 'ready' && order.lineCount === 0);
  const pct = order.unitCount > 0 ? Math.round((order.pickedUnitCount / order.unitCount) * 100) : 0;

  return (
    <tr
      className={`cursor-pointer transition hover:bg-slate-50 ${isSelected ? 'bg-cyan-50/60' : ''}`}
      onClick={onSelect}
    >
      <td className="px-4 py-3 font-medium text-slate-900">
        <span className="flex items-center gap-1">
          {order.externalNumber}
          {isSelected && <ChevronRight className="h-3.5 w-3.5 text-cyan-600" />}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}>
          {getOrderStatusLabel(order.status)}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">{order.lineCount} lines</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {order.unitCount > 0 ? (
            <>
              <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-7 text-right text-xs text-slate-500">{pct}%</span>
            </>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {canTransition && target && (
            <button
              type="button"
              disabled={orderTransition.isPending && orderTransition.variables?.orderId === order.id}
              onClick={() => orderTransition.mutate({ orderId: order.id, status: target as OrderStatus })}
              className="rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
            >
              {orderTransition.isPending && orderTransition.variables?.orderId === order.id ? '…' : getOrderStatusLabel(target)}
            </button>
          )}
          <button
            type="button"
            disabled={detach.isPending}
            onClick={() => detach.mutate({ waveId, orderId: order.id })}
            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
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

  const action = getWavePrimaryAction(wave);
  const blockers = deriveWaveBlockers({ orders: wave.orders });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50">
      {/* ── Compact Wave Summary Header ────────────────────────── */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              to={routes.operations}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Back to Operations"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900">{wave.name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getWaveStatusColor(wave.status)}`}>
                  {getWaveStatusLabel(wave.status)}
                </span>
                <span className="text-xs text-slate-500">
                  {wave.totalOrders}O · {wave.readyOrders}R {wave.blockingOrderCount > 0 && `· ${wave.blockingOrderCount}⚠`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Refresh wave"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
            {action.target && (
              <button
                type="button"
                disabled={Boolean(action.reason) || waveTransition.isPending}
                title={action.reason ?? undefined}
                onClick={() => waveTransition.mutate({ waveId: wave.id, status: action.target as WaveStatus })}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {waveTransition.isPending ? '…' : action.label}
              </button>
            )}
          </div>
        </div>

        {action.reason && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {action.reason}
          </div>
        )}
      </div>

      {/* ── Blocker Panel (if needed) ──────────────────────────── */}
      {blockers.blocked && (
        <div className="border-b border-slate-200 bg-white px-6 py-3">
          <WaveBlockerPanel
            waveOrders={wave.orders}
            onOpenOrder={openOrder}
          />
        </div>
      )}

      {/* ── Stale order param notice ──────────────────────────── */}
      {rawOrderParam && !selectedOrderId && (
        <div className="border-b border-slate-200 bg-amber-50 px-6 py-2">
          <div className="flex items-center justify-between gap-3 text-xs text-amber-800">
            <span>Selected order was not found in this wave.</span>
            <button
              type="button"
              onClick={closeOrder}
              className="shrink-0 rounded p-0.5 hover:bg-amber-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Master-Detail Area ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Orders List */}
        <div className="flex flex-1 flex-col overflow-hidden bg-white">
          <div className="border-b border-slate-200 px-6 py-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Orders <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">{wave.orders.length}</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowAddOrder(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
            >
              <PackagePlus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {wave.orders.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="text-sm text-slate-500">No orders in this wave yet.</div>
              <button
                type="button"
                onClick={() => setShowAddOrder(true)}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500"
              >
                Add first order
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Number</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Lines</th>
                    <th className="px-4 py-2">Progress</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wave.orders.map((order) => (
                    <WaveOrderRow
                      key={order.id}
                      order={order}
                      waveId={wave.id}
                      isSelected={selectedOrderId === order.id}
                      onSelect={() => openOrder(order.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Order Preview (if selected) */}
        {selectedOrderId ? (
          <div className="w-[360px] border-l border-slate-200 bg-white overflow-hidden flex flex-col">
            <OrderPreview orderId={selectedOrderId} onClose={closeOrder} />
          </div>
        ) : (
          <div className="w-[360px] border-l border-slate-200 bg-slate-50 flex flex-col items-center justify-center">
            <div className="text-center">
              <div className="text-xs text-slate-500">Select an order to view details</div>
            </div>
          </div>
        )}
      </div>

      {showAddOrder && waveId && (
        <AddOrderModal waveId={waveId} onClose={() => setShowAddOrder(false)} />
      )}
    </div>
  );
}
