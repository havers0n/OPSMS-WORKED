import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { pickingQueueQueryOptions } from '@/entities/picking-queue/api/queries';
import { pickingRunPath } from '@/shared/config/routes';

function statusLabel(status: 'ready' | 'in_progress' | 'blocked') {
  if (status === 'ready') return 'Ready';
  if (status === 'in_progress') return 'In progress';
  return 'Blocked';
}

export function PickingQueuePage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery(pickingQueueQueryOptions());

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
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Picker queue</h1>
      <p className="mb-4 text-sm text-slate-600">Available picking runs for orders and waves.</p>
      <div className="space-y-3" data-testid="picking-queue-list">
        {data.map((item) => (
          <button
            key={`${item.kind}:${item.id}`}
            type="button"
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-slate-300"
            onClick={() =>
              navigate(
                item.kind === 'order'
                  ? pickingRunPath({ orderId: item.id })
                  : pickingRunPath({ waveId: item.id })
              )
            }
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
          </button>
        ))}
      </div>
    </div>
  );
}

