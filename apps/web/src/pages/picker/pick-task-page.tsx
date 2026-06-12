import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { pickerTaskDetailQueryOptions } from '@/entities/picker/api/queries';
import { pickerPath, pickerStepPath } from '@/shared/config/routes';

function stepStatusChipClass(status: string): string {
  if (status === 'picked') return 'bg-green-100 text-green-700';
  if (status === 'partial') return 'bg-yellow-100 text-yellow-700';
  if (status === 'skipped' || status === 'exception') return 'bg-gray-100 text-gray-600';
  if (status === 'needs_replenishment') return 'bg-orange-100 text-orange-700';
  return 'bg-blue-100 text-blue-700';
}

function stepStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'picked': return 'Picked';
    case 'partial': return 'Partial';
    case 'skipped': return 'Skipped';
    case 'exception': return 'Exception';
    case 'needs_replenishment': return 'Needs replenishment';
    default: return status;
  }
}

export function PickTaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const { data: task, isLoading, isError, error, refetch } = useQuery(
    pickerTaskDetailQueryOptions(taskId ?? null)
  );

  const goBack = () => navigate(pickerPath());

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-white"
        data-testid="pick-task-loading"
      >
        <span className="text-sm text-gray-500">Loading task...</span>
      </div>
    );
  }

  if (isError) {
    const bffError = error as { code?: string };
    if (bffError?.code === 'PICKER_WORKER_NOT_BOUND') {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center p-6 bg-white text-center"
          data-testid="pick-task-missing-worker"
        >
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">הפעלה לא מזוהה</h1>
          <p className="text-sm text-gray-500 mb-4">לא נמצא חשבון משויך לעובד. פנה למנהל המערכת.</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 text-sm font-medium underline"
            data-testid="pick-task-return-home"
          >
            חזור לדף הראשי
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white p-6" data-testid="pick-task-error">
        <button
          onClick={goBack}
          className="flex items-center text-blue-600 mb-4 active:bg-blue-50 rounded-lg p-1"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium ml-1">Back</span>
        </button>
        <p className="text-sm text-red-600 mb-4">
          נכשל בטעינת המשימה
        </p>
        <button
          onClick={() => refetch()}
          className="text-blue-600 text-sm font-medium underline"
          data-testid="pick-task-retry"
        >
          נסה שוב
        </button>
      </div>
    );
  }

  if (!task) return null;

  if (task.status === 'completed' || task.status === 'completed_with_exceptions') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6 bg-white text-center"
        data-testid="pick-task-completed"
      >
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">הקטיף הושלם</h1>
        <p className="text-sm text-gray-500 mb-6">ההזמנה מוכנה לבדיקה</p>
        <button
          onClick={goBack}
          className="bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all"
          data-testid="pick-task-back-to-list"
        >
          חזור לרשימת המשימות
        </button>
      </div>
    );
  }

  const progressPct =
    task.totalSteps > 0
      ? Math.round((task.completedSteps / task.totalSteps) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={goBack}
          className="flex items-center justify-center text-blue-600 active:bg-blue-50 p-1 rounded-lg shrink-0"
          data-testid="pick-task-back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 truncate" data-testid="pick-task-number">
            Task #{task.taskNumber}
          </h1>
          <p className="text-xs text-gray-500">
            {task.completedSteps}/{task.totalSteps} steps
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
            task.status === 'in_progress'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600'
          }`}
          data-testid="pick-task-status"
        >
          {task.status}
        </span>
      </header>

      <div className="h-1.5 bg-gray-200">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${progressPct}%` }}
          data-testid="pick-task-progress"
        />
      </div>

      <div className="flex-1 p-4 space-y-3" data-testid="pick-task-steps">
        {task.steps.map((step) => {
          const isDone = step.status !== 'pending';
          return (
            <button
              key={step.id}
              type="button"
              disabled={isDone}
              className={`w-full rounded-xl border p-4 text-left transition-colors shadow-sm ${
                isDone
                  ? 'bg-gray-50 border-gray-100 opacity-60 cursor-default'
                  : 'bg-white border-gray-200 active:bg-blue-50'
              }`}
              onClick={() => {
                if (!isDone) navigate(pickerStepPath(task.id, step.id));
              }}
              data-testid={`pick-step-item-${step.status}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{step.itemName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">SKU: {step.sku}</p>
                  {step.sourceCellAddress && (
                    <p className="text-xs text-gray-500">Location: {step.sourceCellAddress}</p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${stepStatusChipClass(step.status)}`}
                    data-testid="pick-step-status"
                  >
                    {stepStatusLabel(step.status)}
                  </span>
                  <p className="text-xs text-gray-500">
                    {step.qtyPicked}/{step.qtyRequired} pcs
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
