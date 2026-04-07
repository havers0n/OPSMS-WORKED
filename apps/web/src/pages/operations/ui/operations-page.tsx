import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, Package, PackagePlus, RefreshCw, Waves as WavesIcon } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { OrderStatus, WaveStatus, WaveSummary } from '@wos/domain';
import { useCreateOrder, useTransitionOrderStatus } from '@/entities/order/api/mutations';
import { ordersQueryOptions } from '@/entities/order/api/queries';
import { getOrderStatusColor, getOrderStatusLabel, getPrimaryTransitionTarget, getProgressLabel } from '@/entities/order/lib/order-actions';
import { useCreateWave, useTransitionWaveStatus } from '@/entities/wave/api/mutations';
import { wavesQueryOptions } from '@/entities/wave/api/queries';
import { waveDetailPath } from '@/shared/config/routes';
import { OrderDrawer } from './order-drawer';

// ── Wave status helpers ──────────────────────────────────────────────────────

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

function getWaveActionState(wave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'>) {
  switch (wave.status) {
    case 'draft': return { target: 'ready' as WaveStatus, label: 'Mark ready', reason: wave.totalOrders === 0 ? 'Add at least one order first.' : null };
    case 'ready': return { target: 'released' as WaveStatus, label: 'Release', reason: wave.blockingOrderCount > 0 ? 'Not all orders are ready.' : null };
    case 'released': return { target: 'closed' as WaveStatus, label: 'Close', reason: null };
    default: return { target: null, label: null, reason: null };
  }
}

function WaveProgress({ readyOrders, totalOrders }: { readyOrders: number; totalOrders: number }) {
  if (totalOrders === 0) return <span className="text-xs text-slate-400">Empty</span>;
  const pct = Math.round((readyOrders / totalOrders) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500">{readyOrders}/{totalOrders}</span>
    </div>
  );
}

// ── Modals ───────────────────────────────────────────────────────────────────

function CreateWaveModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const createWave = useCreateWave();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="text-lg font-semibold text-slate-900">New wave</div>
        <p className="mt-1 text-sm text-slate-500">Give this wave a name to identify it. You'll add orders and products on the next screen.</p>
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; createWave.mutate({ name: name.trim() }, { onSuccess: (w) => onCreated(w.id) }); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning run A" className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={createWave.isPending || !name.trim()} className="flex-1 rounded-xl bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50">
              {createWave.isPending ? 'Creating...' : 'Create & open →'}
            </button>
          </div>
        </form>
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
        <div className="text-lg font-semibold text-slate-900">Quick order</div>
        <p className="mt-1 text-sm text-slate-500">Create a standalone order — no wave needed. You'll add products after creation.</p>
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!externalNumber.trim()) return; createOrder.mutate({ externalNumber: externalNumber.trim() }, { onSuccess: onClose }); }}>
          <input value={externalNumber} onChange={(e) => setExternalNumber(e.target.value)} placeholder="e.g. ORD-1001" className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500" autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={createOrder.isPending || !externalNumber.trim()} className="flex-1 rounded-xl bg-slate-800 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
              {createOrder.isPending ? 'Creating...' : 'Create order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function OperationsPage() {
  const [showCreateWave, setShowCreateWave] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedOrderId = searchParams.get('order');
  const [navigateToWave, setNavigateToWave] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: waves = [], isLoading: wavesLoading, refetch: refetchWaves, isRefetching: wavesRefetching } = useQuery(wavesQueryOptions());
  const { data: allOrders = [], isLoading: ordersLoading, refetch: refetchOrders, isRefetching: ordersRefetching } = useQuery(ordersQueryOptions());
  const waveTransition = useTransitionWaveStatus();
  const orderTransition = useTransitionOrderStatus();

  const standaloneOrders = allOrders.filter((o) => !o.waveId);

  // Navigate after wave creation (SPA-safe: no hard reload)
  useEffect(() => {
    if (navigateToWave) {
      navigate(waveDetailPath(navigateToWave));
    }
  }, [navigateToWave, navigate]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-8 overflow-auto p-6">

        {/* ── Entry cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Wave flow */}
          <button
            type="button"
            onClick={() => setShowCreateWave(true)}
            className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50/40 p-5 text-left transition hover:border-cyan-400 hover:bg-cyan-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 transition group-hover:bg-cyan-200">
              <WavesIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">Start a wave</div>
              <div className="mt-0.5 text-sm text-slate-500">
                Group multiple orders into a single picking run
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-cyan-700">
              Create wave <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>

          {/* Quick order */}
          <button
            type="button"
            onClick={() => setShowCreateOrder(true)}
            className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-5 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-200">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">Quick order</div>
              <div className="mt-0.5 text-sm text-slate-500">
                One-off order — process it directly without a wave
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
              Create order <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>
        </div>

        {/* ── Waves section ─────────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Waves</h2>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{waves.length}</span>
            </div>
            <button type="button" onClick={() => void refetchWaves()} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <RefreshCw className={`h-3.5 w-3.5 ${wavesRefetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {wavesLoading ? (
            <div className="flex h-24 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <RefreshCw className="h-4 w-4 animate-spin text-slate-300" />
            </div>
          ) : waves.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
              No waves yet — create one above
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Wave</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {waves.map((wave) => {
                    const action = getWaveActionState(wave);
                    return (
                      <tr key={wave.id} className="group transition hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <Link to={waveDetailPath(wave.id)} className="flex items-center gap-1 font-medium text-slate-900 hover:text-cyan-700">
                            {wave.name}
                            <ChevronRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                          </Link>
                          <div className="text-xs text-slate-400">
                            {wave.blockingOrderCount > 0 ? `${wave.blockingOrderCount} blocking` : wave.totalOrders > 0 ? 'All ready' : 'No orders'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getWaveStatusColor(wave.status)}`}>
                            {waveStatusLabel[wave.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <WaveProgress readyOrders={wave.readyOrders} totalOrders={wave.totalOrders} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {action.target && (
                              <button
                                type="button"
                                disabled={Boolean(action.reason) || (waveTransition.isPending && waveTransition.variables?.waveId === wave.id)}
                                title={action.reason ?? undefined}
                                onClick={() => waveTransition.mutate({ waveId: wave.id, status: action.target as WaveStatus })}
                                className="rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
                              >
                                {waveTransition.isPending && waveTransition.variables?.waveId === wave.id ? '...' : action.label}
                              </button>
                            )}
                            <Link to={waveDetailPath(wave.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Standalone orders section ──────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Standalone orders</h2>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{standaloneOrders.length}</span>
            </div>
            <button type="button" onClick={() => void refetchOrders()} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <RefreshCw className={`h-3.5 w-3.5 ${ordersRefetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {ordersLoading ? (
            <div className="flex h-24 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <RefreshCw className="h-4 w-4 animate-spin text-slate-300" />
            </div>
          ) : standaloneOrders.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
              No standalone orders — create one above
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Lines</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {standaloneOrders.map((order) => {
                    const target = getPrimaryTransitionTarget(order.status);
                    const canTransition = Boolean(target) && !(target === 'ready' && order.lineCount === 0);
                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSearchParams((p) => { p.set('order', order.id); return p; })}
                        className={`cursor-pointer transition hover:bg-slate-50 ${selectedOrderId === order.id ? 'bg-cyan-50/60' : ''}`}
                      >
                        <td className="px-5 py-3 font-medium text-slate-900">{order.externalNumber}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                            {getOrderStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{order.lineCount}</td>
                        <td className="px-4 py-3 text-slate-500">{getProgressLabel(order)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                            {canTransition && target && (
                              <button
                                type="button"
                                disabled={orderTransition.isPending && orderTransition.variables?.orderId === order.id}
                                onClick={() => orderTransition.mutate({ orderId: order.id, status: target as OrderStatus })}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                              >
                                {order.status === 'draft' && target === 'ready'
                                  ? 'Commit and reserve'
                                  : getOrderStatusLabel(target)}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        </div>
      </div>

      {/* Order detail panel — in-flow sibling, not fixed overlay */}
      {selectedOrderId && (
        <div className="m-4 ml-0 w-[420px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <OrderDrawer orderId={selectedOrderId} onClose={() => setSearchParams((p) => { p.delete('order'); return p; })} />
        </div>
      )}

      {showCreateWave && <CreateWaveModal onClose={() => setShowCreateWave(false)} onCreated={(id) => setNavigateToWave(id)} />}
      {showCreateOrder && <CreateOrderModal onClose={() => setShowCreateOrder(false)} />}
    </div>
  );
}
