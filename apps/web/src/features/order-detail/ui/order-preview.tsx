import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ExternalLink, Play, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { PickTaskSummary } from '@wos/domain';
import { orderExecutionQueryOptions } from '@/entities/order/api/queries';
import { ordersQueryOptions } from '@/entities/order/api/queries';
import { isActiveOrder, getOrderStatusColor, getOrderStatusLabel } from '@/entities/order/lib/order-actions';
import { getPickTaskStatusColor, getPickTaskStatusLabel } from '@/entities/pick-task/lib/pick-task-actions';
import { orderDetailPath, pickTaskDetailPath } from '@/shared/config/routes';
import { useT } from '@/shared/i18n';

/**
 * Order Preview (Read-only Summary)
 *
 * Lightweight preview panel for list contexts:
 * - Operations sidebar
 * - Wave detail sidebar
 * - Standalone orders list
 *
 * Shows:
 * - Order summary (number, status, wave context)
 * - Warnings/lifecycle info
 * - Compact lines summary
 * - Pick tasks with direct links (for released/picking orders)
 * - Link to full Order workspace
 *
 * Not editable. For editing, user opens full Order page.
 */

// ── Pick Task Card (compact, for preview panel) ───────────────────────────────

function PreviewTaskCard({
  task,
  orderId,
  waveId
}: {
  task: PickTaskSummary;
  orderId: string;
  waveId?: string;
}) {
  const pct =
    task.totalSteps > 0 ? Math.round((task.completedSteps / task.totalSteps) * 100) : 0;

  const isTerminal =
    task.status === 'completed' || task.status === 'completed_with_exceptions';

  return (
    <Link
      to={pickTaskDetailPath(task.id, { orderId, waveId })}
      className={[
        'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition',
        isTerminal
          ? 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
          : 'border-cyan-200 bg-cyan-50 hover:border-cyan-300 hover:bg-cyan-100'
      ].join(' ')}
    >
      {/* Icon */}
      <span
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          isTerminal ? 'bg-slate-200 text-slate-500' : 'bg-cyan-600 text-white'
        ].join(' ')}
      >
        {isTerminal ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 font-mono text-xs truncate">
            {task.taskNumber}
          </span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getPickTaskStatusColor(task.status)}`}
          >
            {getPickTaskStatusLabel(task.status)}
          </span>
        </div>
        {task.totalSteps > 0 && (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] text-slate-500">
              {task.completedSteps}/{task.totalSteps}
            </span>
          </div>
        )}
      </div>

      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OrderPreview({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const { data: allOrders = [], isLoading } = useQuery(ordersQueryOptions());

  const order = allOrders.find((o) => o.id === orderId);
  const isActive = order ? isActiveOrder(order.status) : false;

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    ...orderExecutionQueryOptions(isActive ? orderId : null),
    enabled: isActive && Boolean(orderId)
  });

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <RefreshCw className="h-4 w-4 animate-spin text-slate-300" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 text-center text-xs text-slate-500">
        {t('operations.preview.notFound')}
      </div>
    );
  }

  // Find the first non-terminal (actionable) task
  const activeTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'completed_with_exceptions'
  );
  const primaryTask: PickTaskSummary | undefined = activeTasks[0];

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-slate-900">{order.externalNumber}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                {getOrderStatusLabel(order.status)}
              </span>
              {order.waveId && (
                <span className="inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-slate-600 bg-slate-100">
                  Wave: {order.waveName ?? 'unknown'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-slate-500">{t('operations.preview.lines')}</div>
            <div className="font-medium text-slate-900">{order.lineCount}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('operations.preview.units')}</div>
            <div className="font-medium text-slate-900">{order.unitCount}</div>
          </div>
          <div>
            <div className="text-slate-500">{t('operations.preview.picked')}</div>
            <div className="font-medium text-slate-900">{order.pickedUnitCount}</div>
          </div>
        </div>
      </div>

      {/* ── Pick Tasks Section (active orders only) ── */}
      {isActive && (
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {t('operations.preview.pickTasks')}
            </div>
            {tasksLoading && (
              <RefreshCw className="h-3 w-3 animate-spin text-slate-300" />
            )}
          </div>

          {!tasksLoading && tasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
              {t('operations.preview.noPickTasks')}
            </div>
          )}

          {tasks.length > 0 && (
            <div className="space-y-2">
              {tasks.map((task) => (
                <PreviewTaskCard
                  key={task.id}
                  task={task}
                  orderId={orderId}
                  waveId={order.waveId ?? undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compact Lines Summary (non-active orders) */}
      {!isActive && (
        order.lineCount > 0 ? (
          <div className="flex-1 border-b border-slate-100 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-600 mb-2">
              {t('operations.preview.linesSection')}
            </div>
            <div className="space-y-1 text-xs">
              <div className="text-slate-600">
                {order.lineCount} {order.lineCount !== 1 ? t('operations.preview.linesPlural') : t('operations.preview.linesSingular')}
              </div>
              {order.unitCount > 0 && (
                <div className="text-slate-600">
                  {order.pickedUnitCount} / {order.unitCount} {t('operations.preview.unitsPicked')}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 border-b border-slate-100 px-4 py-3">
            <div className="text-xs text-slate-500">{t('operations.preview.noLines')}</div>
          </div>
        )
      )}

      {/* Primary CTA */}
      <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-2">
        {/* Start / continue picking — only for active orders with a task */}
        {isActive && primaryTask && (
          <Link
            to={pickTaskDetailPath(primaryTask.id, { orderId, waveId: order.waveId ?? undefined })}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
          >
            <Play className="h-3.5 w-3.5" />
            {primaryTask.status === 'in_progress'
              ? t('operations.preview.action.continuePicking')
              : t('operations.preview.action.startPicking')}
          </Link>
        )}

        {/* Open full order */}
        <button
          type="button"
          onClick={() => navigate(orderDetailPath(orderId))}
          className={[
            'w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium',
            isActive && primaryTask
              ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              : 'bg-cyan-600 text-white hover:bg-cyan-500'
          ].join(' ')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t('operations.preview.action.openFullOrder')}
        </button>
      </div>

      {/* Close Button */}
      <div className="border-t border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 py-1.5"
        >
          {t('operations.preview.action.close')}
        </button>
      </div>
    </div>
  );
}
