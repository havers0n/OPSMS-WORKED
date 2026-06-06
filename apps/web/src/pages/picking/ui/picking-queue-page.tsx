import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderExecutionQueryOptions } from '@/entities/order/api/queries';
import { pickingQueueQueryOptions } from '@/entities/picking-queue/api/queries';
import { orderDetailPath, pickTaskDetailPath } from '@/shared/config/routes';

function statusLabel(status: 'ready' | 'in_progress' | 'blocked') {
  if (status === 'ready') return 'Ready';
  if (status === 'in_progress') return 'In progress';
  return 'Blocked';
}

const actionableTaskStatuses = new Set(['ready', 'assigned', 'in_progress']);

export function PickingQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery(pickingQueueQueryOptions());
  const [resolvingOrderId, setResolvingOrderId] = useState<string | null>(null);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  async function handleOrderClick(orderId: string) {
    if (resolvingOrderId) return;

    setResolvingOrderId(orderId);
    setResolutionError(null);

    try {
      const tasks = await queryClient.fetchQuery(orderExecutionQueryOptions(orderId));
      const actionableTasks = tasks.filter((task) => actionableTaskStatuses.has(task.status));

      if (actionableTasks.length === 1) {
        navigate(pickTaskDetailPath(actionableTasks[0].id, { orderId }));
        return;
      }

      navigate(orderDetailPath(orderId));
    } catch (resolveError) {
      setResolutionError(
        resolveError instanceof Error
          ? `Failed to resolve order execution: ${resolveError.message}`
          : 'Failed to resolve order execution.'
      );
    } finally {
      setResolvingOrderId(null);
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-600" data-testid="picking-queue-loading">Loading picker queue...</div>;
  }

  if (isError) {
    return (
      <div className="p-6 text-sm text-red-700" data-testid="picking-queue-error">
        Failed to load picker queue: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-sm text-slate-600" data-testid="picking-queue-empty">
        No available picking runs.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Tasks</h1>
      <p className="mb-4 text-sm text-slate-600">Available picking tasks for orders and waves.</p>
      {resolutionError ? (
        <div className="mb-4 text-sm text-red-700" data-testid="picking-queue-resolution-error">
          {resolutionError}
        </div>
      ) : null}
      <div className="space-y-3" data-testid="picking-queue-list">
        {data.map((item) => (
          item.kind === 'order' ? (
            <button
              key={`${item.kind}:${item.id}`}
              type="button"
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left opacity-80 transition hover:border-cyan-300 hover:bg-cyan-50/40 disabled:cursor-wait disabled:hover:border-slate-200 disabled:hover:bg-white"
              data-testid={`picking-queue-item-${item.kind}`}
              disabled={Boolean(resolvingOrderId)}
              onClick={() => void handleOrderClick(item.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.displayCode}</div>
                  <div className="text-xs text-slate-500">
                    Type: {item.kind}
                    {resolvingOrderId === item.id ? ' - Resolving...' : ''}
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {statusLabel(item.status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                {typeof item.lineCount === 'number' && <span>Lines: {item.lineCount}</span>}
                {typeof item.taskCount === 'number' && <span>Tasks: {item.taskCount}</span>}
                {typeof item.warningCount === 'number' && <span>Warnings: {item.warningCount}</span>}
              </div>
            </button>
          ) : (
            <div
              key={`${item.kind}:${item.id}`}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left opacity-80"
              data-testid={`picking-queue-item-${item.kind}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.displayCode}</div>
                  <div className="text-xs text-slate-500">Type: {item.kind}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {statusLabel(item.status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                {typeof item.lineCount === 'number' && <span>Lines: {item.lineCount}</span>}
                {typeof item.taskCount === 'number' && <span>Tasks: {item.taskCount}</span>}
                {item.kind === 'wave' && typeof item.orderCount === 'number' && <span>Orders: {item.orderCount}</span>}
                {typeof item.warningCount === 'number' && <span>Warnings: {item.warningCount}</span>}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
