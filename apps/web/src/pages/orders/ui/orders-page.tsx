import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackagePlus, RefreshCw, ChevronRight, X, Layers } from 'lucide-react';
import type { OrderStatus, OrderSummary, Order, PickTaskSummary } from '@wos/domain';
import { ordersQueryOptions, orderQueryOptions, orderExecutionQueryOptions } from '@/entities/order/api/queries';
import { useCreateOrder, useTransitionOrderStatus } from '@/entities/order/api/mutations';
import {
  getOrderActions,
  getOrderStatusColor,
  getOrderStatusLabel,
  getPrimaryTransitionTarget,
  getProgressLabel,
  canEditLines
} from '@/entities/order/lib/order-actions';

// ── Summary cards ─────────────────────────────────────────────────────────────

const STATUS_TABS: { status: OrderStatus | 'all'; label: string }[] = [
  { status: 'all', label: 'Все' },
  { status: 'draft', label: 'Черновик' },
  { status: 'ready', label: 'Готов' },
  { status: 'released', label: 'Выпущен' },
  { status: 'picking', label: 'В работе' },
  { status: 'picked', label: 'Собран' },
  { status: 'partial', label: 'Частично' },
  { status: 'closed', label: 'Закрыт' }
];

function useSummaryCounts(orders: OrderSummary[]) {
  const counts: Record<string, number> = {};
  for (const o of orders) {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }
  return counts;
}

// ── Order detail drawer ────────────────────────────────────────────────────────

function ExecutionSummary({ task }: { task: PickTaskSummary }) {
  const pct = task.totalSteps > 0 ? Math.round((task.completedSteps / task.totalSteps) * 100) : 0;

  const statusLabel: Record<string, string> = {
    ready: 'Ожидает пикера',
    assigned: 'Назначен',
    in_progress: 'В работе',
    completed: 'Завершён',
    completed_with_exceptions: 'Завершён с исключениями'
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <Layers className="h-3.5 w-3.5 text-cyan-600" />
          Pick Task
        </span>
        <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700 border border-cyan-200">
          {statusLabel[task.status] ?? task.status}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">{task.completedSteps}/{task.totalSteps}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="font-semibold text-slate-900">{task.totalSteps}</p>
            <p className="text-slate-400">Шагов</p>
          </div>
          <div>
            <p className="font-semibold text-emerald-600">{task.completedSteps}</p>
            <p className="text-slate-400">Собрано</p>
          </div>
          <div>
            <p className={`font-semibold ${task.exceptionSteps > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
              {task.exceptionSteps}
            </p>
            <p className="text-slate-400">Исключений</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailDrawer({
  orderId,
  onClose
}: {
  orderId: string;
  onClose: () => void;
}) {
  const { data: order, isLoading } = useQuery(orderQueryOptions(orderId));
  const { data: execution = [] } = useQuery(orderExecutionQueryOptions(orderId));
  const transition = useTransitionOrderStatus();

  if (isLoading || !order) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const primaryTarget = getPrimaryTransitionTarget(order.status);
  const actions = getOrderActions(order.status);

  const handleTransition = (status: OrderStatus) => {
    transition.mutate({ orderId: order.id, status });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 p-4">
        <div>
          <p className="text-xs text-slate-500">Заказ</p>
          <h2 className="text-base font-semibold text-slate-900">{order.externalNumber}</h2>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}>
            {getOrderStatusLabel(order.status)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">Позиции</h3>
          {canEditLines(order.status) && (
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              + Добавить
            </button>
          )}
        </div>

        {order.lines.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
            Нет позиций
          </p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {order.lines.map((line) => (
              <div key={line.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{line.name}</p>
                  <p className="text-xs text-slate-500">{line.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {line.qtyPicked} / {line.qtyRequired}
                  </p>
                  <p className={`text-xs font-medium ${
                    line.status === 'picked' ? 'text-emerald-600'
                    : line.status === 'partial' ? 'text-orange-600'
                    : line.status === 'skipped' || line.status === 'exception' ? 'text-red-500'
                    : 'text-slate-400'
                  }`}>
                    {line.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Execution section */}
        {execution.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-slate-700">Исполнение</h3>
            <div className="space-y-2">
              {execution.map((task) => (
                <ExecutionSummary key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex flex-wrap gap-2">
          {primaryTarget && (
            <button
              type="button"
              disabled={transition.isPending}
              onClick={() => handleTransition(primaryTarget)}
              className="flex-1 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {transition.isPending ? '...' : getOrderStatusLabel(primaryTarget)}
            </button>
          )}
          {actions.includes('cancel') && (
            <button
              type="button"
              disabled={transition.isPending}
              onClick={() => handleTransition('cancelled')}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Отменить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create order modal ─────────────────────────────────────────────────────────

function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const [externalNumber, setExternalNumber] = useState('');
  const createOrder = useCreateOrder();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalNumber.trim()) return;
    createOrder.mutate({ externalNumber: externalNumber.trim() }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Новый заказ</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Номер заказа
            </label>
            <input
              type="text"
              value={externalNumber}
              onChange={(e) => setExternalNumber(e.target.value)}
              placeholder="ORD-1001"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createOrder.isPending || !externalNumber.trim()}
              className="flex-1 rounded-xl bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {createOrder.isPending ? '...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Orders page ───────────────────────────────────────────────────────────────

export function OrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: allOrders = [], isLoading, refetch, isRefetching } = useQuery(ordersQueryOptions());
  const counts = useSummaryCounts(allOrders);

  const filteredOrders = activeTab === 'all'
    ? allOrders
    : allOrders.filter((o) => o.status === activeTab);

  const transition = useTransitionOrderStatus();

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Main panel */}
      <div className={`flex flex-col overflow-hidden transition-all ${selectedOrderId ? 'flex-1' : 'w-full'}`}>
        <div className="flex h-full flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white m-4">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h1 className="text-base font-semibold text-slate-900">Заказы</h1>
              <p className="text-xs text-slate-500">{allOrders.length} заказов всего</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refetch()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500"
              >
                <PackagePlus className="h-3.5 w-3.5" />
                Создать заказ
              </button>
            </div>
          </header>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 border-b border-slate-200 px-5 py-3 xl:grid-cols-8">
            {(['draft', 'ready', 'released', 'picking', 'picked', 'partial', 'closed', 'cancelled'] as OrderStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveTab(s)}
                className={`rounded-xl border p-2 text-left transition-colors ${
                  activeTab === s ? 'border-cyan-300 bg-cyan-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <p className="text-lg font-bold leading-none text-slate-900">{counts[s] ?? 0}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{getOrderStatusLabel(s)}</p>
              </button>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-0 border-b border-slate-200 px-5 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.status}
                type="button"
                onClick={() => setActiveTab(tab.status)}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab.status
                    ? 'border-cyan-600 text-cyan-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {tab.status !== 'all' && counts[tab.status] ? (
                  <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {counts[tab.status]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-1">
                <p className="text-sm text-slate-500">Нет заказов</p>
                {activeTab === 'all' && (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="text-xs text-cyan-600 hover:underline"
                  >
                    Создать первый заказ
                  </button>
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">Заказ</th>
                    <th className="px-4 py-2.5">Статус</th>
                    <th className="px-4 py-2.5">Позиций</th>
                    <th className="px-4 py-2.5">Единиц</th>
                    <th className="px-4 py-2.5">Прогресс</th>
                    <th className="px-4 py-2.5">Создан</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredOrders.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      isSelected={selectedOrderId === order.id}
                      onOpen={() => setSelectedOrderId(order.id)}
                      onTransition={(status) => transition.mutate({ orderId: order.id, status })}
                      isTransitioning={transition.isPending && transition.variables?.orderId === order.id}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selectedOrderId && (
        <div className="w-80 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white m-4 ml-0">
          <OrderDetailDrawer
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
          />
        </div>
      )}

      {showCreateModal && (
        <CreateOrderModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

// ── Order table row ───────────────────────────────────────────────────────────

function OrderRow({
  order,
  isSelected,
  onOpen,
  onTransition,
  isTransitioning
}: {
  order: OrderSummary;
  isSelected: boolean;
  onOpen: () => void;
  onTransition: (status: OrderStatus) => void;
  isTransitioning: boolean;
}) {
  const primaryTarget = getPrimaryTransitionTarget(order.status);
  const createdDate = new Date(order.createdAt).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <tr
      className={`cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-cyan-50/60' : ''}`}
      onClick={onOpen}
    >
      <td className="px-5 py-3">
        <p className="font-medium text-slate-900">{order.externalNumber}</p>
        {order.waveId && (
          <p className="text-xs text-slate-400">Wave</p>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}>
          {getOrderStatusLabel(order.status)}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">{order.lineCount}</td>
      <td className="px-4 py-3 text-slate-600">{order.unitCount}</td>
      <td className="px-4 py-3">
        {order.unitCount > 0 ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cyan-500"
                style={{ width: `${Math.round((order.pickedUnitCount / order.unitCount) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{getProgressLabel(order)}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{createdDate}</td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          {primaryTarget && (
            <button
              type="button"
              disabled={isTransitioning}
              onClick={() => onTransition(primaryTarget)}
              className="rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
            >
              {isTransitioning ? '...' : getOrderStatusLabel(primaryTarget)}
            </button>
          )}
          <button
            type="button"
            onClick={onOpen}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
