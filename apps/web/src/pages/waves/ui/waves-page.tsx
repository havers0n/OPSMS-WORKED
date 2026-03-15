import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, PackagePlus, RefreshCw, Waves as WavesIcon, X } from 'lucide-react';
import type { OrderStatus, Wave, WaveStatus, WaveSummary } from '@wos/domain';
import { useCreateOrder } from '@/entities/order/api/mutations';
import { ordersQueryOptions } from '@/entities/order/api/queries';
import { getOrderStatusColor, getOrderStatusLabel } from '@/entities/order/lib/order-actions';
import {
  useAttachOrderToWave,
  useCreateWave,
  useDetachOrderFromWave,
  useTransitionWaveStatus
} from '@/entities/wave/api/mutations';
import { waveQueryOptions, wavesQueryOptions } from '@/entities/wave/api/queries';

const waveStatusLabel: Record<WaveStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  released: 'Released',
  in_progress: 'In progress',
  completed: 'Completed',
  partial: 'Partial',
  closed: 'Closed'
};

function getWaveStatusColor(status: WaveStatus) {
  switch (status) {
    case 'draft':
      return 'bg-slate-100 text-slate-700';
    case 'ready':
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'released':
      return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    case 'in_progress':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'partial':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'closed':
      return 'bg-slate-100 text-slate-500';
  }
}

function getWaveActionState(wave: Pick<WaveSummary, 'status' | 'totalOrders' | 'blockingOrderCount'>) {
  switch (wave.status) {
    case 'draft':
      return {
        target: 'ready' as WaveStatus,
        label: 'Mark ready',
        reason:
          wave.totalOrders === 0 ? 'Add at least one order before marking the wave ready.' : null
      };
    case 'ready':
      return {
        target: 'released' as WaveStatus,
        label: 'Release wave',
        reason:
          wave.totalOrders === 0
            ? 'Add at least one order before releasing the wave.'
            : wave.blockingOrderCount > 0
              ? 'All attached orders must be ready before release.'
              : null
      };
    case 'released':
      return { target: 'closed' as WaveStatus, label: 'Close wave', reason: null };
    default:
      return { target: null, label: null, reason: null };
  }
}

function getWaveSecondaryAction(wave: Pick<WaveSummary, 'status'>) {
  if (wave.status === 'ready') {
    return { target: 'draft' as WaveStatus, label: 'Return to draft' };
  }
  return null;
}

// Progress bar for wave readiness
function WaveProgress({ readyOrders, totalOrders }: { readyOrders: number; totalOrders: number }) {
  if (totalOrders === 0) return <span className="text-xs text-slate-400">Empty</span>;
  const pct = Math.round((readyOrders / totalOrders) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500">
        {readyOrders}/{totalOrders}
      </span>
    </div>
  );
}

// Unified "Add order" form with two sub-tabs: Create / Attach
function AddOrderSection({ wave, disabled }: { wave: Wave; disabled: boolean }) {
  const [mode, setMode] = useState<'create' | 'attach'>('create');
  const [externalNumber, setExternalNumber] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const createOrder = useCreateOrder();
  const attachOrder = useAttachOrderToWave();
  const { data: orders = [] } = useQuery(ordersQueryOptions());

  const candidateOrders = useMemo(
    () =>
      orders.filter(
        (o) => !o.waveId && (o.status === 'draft' || o.status === 'ready')
      ),
    [orders]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      {/* Sub-tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`flex-1 rounded-tl-xl py-2 text-xs font-medium transition ${
            mode === 'create'
              ? 'bg-white text-cyan-700'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Create new
        </button>
        <button
          type="button"
          onClick={() => setMode('attach')}
          className={`flex-1 rounded-tr-xl py-2 text-xs font-medium transition ${
            mode === 'attach'
              ? 'bg-white text-cyan-700'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Attach existing
          {candidateOrders.length > 0 && (
            <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
              {candidateOrders.length}
            </span>
          )}
        </button>
      </div>

      <div className="p-3">
        {mode === 'create' ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!externalNumber.trim() || disabled) return;
              createOrder.mutate(
                { externalNumber: externalNumber.trim(), waveId: wave.id },
                { onSuccess: () => setExternalNumber('') }
              );
            }}
          >
            <input
              value={externalNumber}
              onChange={(e) => setExternalNumber(e.target.value)}
              disabled={disabled}
              placeholder="Order number, e.g. ORD-1001"
              className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-100"
            />
            <button
              type="submit"
              disabled={disabled || createOrder.isPending || !externalNumber.trim()}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {createOrder.isPending ? 'Creating...' : 'Create'}
            </button>
          </form>
        ) : (
          <div className="flex gap-2">
            <select
              value={selectedOrderId}
              disabled={disabled || candidateOrders.length === 0}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-100"
            >
              <option value="">
                {candidateOrders.length === 0 ? 'No eligible orders' : 'Select order…'}
              </option>
              {candidateOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.externalNumber} · {getOrderStatusLabel(o.status)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={disabled || attachOrder.isPending || !selectedOrderId}
              onClick={() =>
                attachOrder.mutate(
                  { waveId: wave.id, orderId: selectedOrderId },
                  { onSuccess: () => setSelectedOrderId('') }
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {attachOrder.isPending ? 'Attaching...' : 'Attach'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WaveDrawer({ waveId, onClose }: { waveId: string; onClose: () => void }) {
  const { data: wave, isLoading } = useQuery(waveQueryOptions(waveId));
  const transition = useTransitionWaveStatus();
  const detachOrder = useDetachOrderFromWave();

  if (isLoading || !wave) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const primaryAction = getWaveActionState(wave);
  const secondaryAction = getWaveSecondaryAction(wave);
  const membershipLocked = wave.status === 'released' || wave.status === 'closed';
  const blockingOrders = wave.orders.filter((o) => o.status !== 'ready');
  const allReady = wave.totalOrders > 0 && blockingOrders.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Wave</div>
            <div className="text-lg font-semibold text-slate-900">{wave.name}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${getWaveStatusColor(wave.status)}`}
              >
                {waveStatusLabel[wave.status]}
              </span>
              <WaveProgress readyOrders={wave.readyOrders} totalOrders={wave.totalOrders} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {membershipLocked && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Wave membership is locked after release. Orders cannot be added or removed.
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-auto p-4">
        {/* Summary cards */}
        <div className="grid gap-3 grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{wave.totalOrders}</div>
          </article>
          <article
            className={`rounded-xl border p-3 ${allReady ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">Ready</div>
            <div
              className={`mt-1 text-xl font-semibold ${allReady ? 'text-emerald-700' : 'text-slate-900'}`}
            >
              {wave.readyOrders}
            </div>
          </article>
          <article
            className={`rounded-xl border p-3 ${wave.blockingOrderCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">Blocking</div>
            <div
              className={`mt-1 text-xl font-semibold ${wave.blockingOrderCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}
            >
              {wave.blockingOrderCount}
            </div>
          </article>
        </div>

        {/* Add order section — unified Create/Attach */}
        {!membershipLocked && <AddOrderSection wave={wave} disabled={membershipLocked} />}

        {/* Attached orders table */}
        <div className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-medium text-slate-900">Attached orders</div>
            {!membershipLocked && wave.totalOrders > 0 && (
              <div className="mt-0.5 text-xs text-slate-500">
                {allReady
                  ? 'All orders are ready — wave can be released.'
                  : `${wave.blockingOrderCount} order(s) must reach ready state before release.`}
              </div>
            )}
          </div>
          {wave.orders.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No orders attached yet.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Lines</th>
                    <th className="px-4 py-3">Units</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {wave.orders.map((order) => {
                    const detachable =
                      !membershipLocked &&
                      (order.status === 'draft' || order.status === 'ready');
                    return (
                      <tr key={order.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {order.externalNumber}
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
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={!detachable || detachOrder.isPending}
                            onClick={() =>
                              detachOrder.mutate({ waveId: wave.id, orderId: order.id })
                            }
                            className="text-xs font-medium text-red-600 disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex flex-wrap gap-2">
          {secondaryAction && (
            <button
              type="button"
              disabled={transition.isPending}
              onClick={() =>
                transition.mutate({ waveId: wave.id, status: secondaryAction.target })
              }
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction.target && (
            <button
              type="button"
              disabled={Boolean(primaryAction.reason) || transition.isPending}
              onClick={() =>
                transition.mutate({ waveId: wave.id, status: primaryAction.target as WaveStatus })
              }
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {transition.isPending ? 'Updating...' : primaryAction.label}
            </button>
          )}
        </div>
        {primaryAction.reason && (
          <div className="mt-2 text-xs text-slate-500">{primaryAction.reason}</div>
        )}
      </div>
    </div>
  );
}

function CreateWaveModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const createWave = useCreateWave();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="text-lg font-semibold text-slate-900">Create wave</div>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createWave.mutate({ name: name.trim() }, { onSuccess: onClose });
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wave A"
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
              disabled={createWave.isPending || !name.trim()}
              className="flex-1 rounded-xl bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {createWave.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WavesPage() {
  const [selectedWaveId, setSelectedWaveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const transition = useTransitionWaveStatus();
  const { data: waves = [], isLoading, isRefetching, refetch } = useQuery(wavesQueryOptions());

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Waves list */}
      <div className={`flex flex-col overflow-hidden ${selectedWaveId ? 'flex-1' : 'w-full'}`}>
        <div className="m-4 flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">Waves</div>
              <div className="text-sm text-slate-500">{waves.length} total</div>
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
                <WavesIcon className="h-4 w-4" />
                Create wave
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : waves.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                No waves yet.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Wave</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {waves.map((wave) => {
                    const primaryAction = getWaveActionState(wave);
                    const isSelected = selectedWaveId === wave.id;
                    return (
                      <tr
                        key={wave.id}
                        onClick={() => setSelectedWaveId(isSelected ? null : wave.id)}
                        className={`cursor-pointer transition hover:bg-slate-50 ${isSelected ? 'bg-cyan-50/60' : ''}`}
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">{wave.name}</div>
                          <div className="text-xs text-slate-500">
                            {wave.totalOrders === 0
                              ? 'No orders'
                              : `${wave.blockingOrderCount > 0 ? `${wave.blockingOrderCount} blocking` : 'All ready'}`}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getWaveStatusColor(wave.status)}`}
                          >
                            {waveStatusLabel[wave.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <WaveProgress
                            readyOrders={wave.readyOrders}
                            totalOrders={wave.totalOrders}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="flex items-center justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {primaryAction.target && (
                              <button
                                type="button"
                                disabled={
                                  Boolean(primaryAction.reason) ||
                                  (transition.isPending &&
                                    transition.variables?.waveId === wave.id)
                                }
                                title={primaryAction.reason ?? undefined}
                                onClick={() =>
                                  transition.mutate({
                                    waveId: wave.id,
                                    status: primaryAction.target as WaveStatus
                                  })
                                }
                                className="rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
                              >
                                {transition.isPending && transition.variables?.waveId === wave.id
                                  ? '...'
                                  : primaryAction.label}
                              </button>
                            )}
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

      {/* Wave detail panel */}
      {selectedWaveId && (
        <div className="m-4 ml-0 w-[460px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <WaveDrawer waveId={selectedWaveId} onClose={() => setSelectedWaveId(null)} />
        </div>
      )}

      {showCreate && <CreateWaveModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
