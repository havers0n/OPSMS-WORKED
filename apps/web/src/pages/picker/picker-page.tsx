import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { pickerTasksQueryOptions } from '@/entities/picker/api/queries';
import { pickerTaskPath } from '@/shared/config/routes';

function taskStatusLabel(status: string): string {
  switch (status) {
    case 'assigned': return 'Assigned';
    case 'in_progress': return 'In progress';
    case 'completed': return 'Completed';
    case 'completed_with_exceptions': return 'Done (exceptions)';
    default: return status;
  }
}

function statusChipClass(status: string): string {
  if (status === 'completed' || status === 'completed_with_exceptions') {
    return 'bg-green-100 text-green-700';
  }
  if (status === 'in_progress') return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-600';
}

export function PickerPage() {
  const navigate = useNavigate();

  const { data: tasks, isLoading, isError, error, refetch } = useQuery(
    pickerTasksQueryOptions()
  );

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-white"
        data-testid="picker-loading"
      >
        <span className="text-sm text-gray-500">Loading tasks...</span>
      </div>
    );
  }

  if (isError) {
    const bffError = error as { code?: string };
    if (bffError?.code === 'PICKER_WORKER_NOT_BOUND') {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center p-6 bg-white text-center"
          data-testid="picker-missing-worker"
        >
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">הפעלה לא מזוהה</h1>
          <p className="text-sm text-gray-500 mb-4">לא נמצא חשבון משויך לעובד. פנה למנהל המערכת.</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 text-sm font-medium underline"
            data-testid="picker-return-home"
          >
            חזור לדף הראשי
          </button>
        </div>
      );
    }

    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6 bg-white"
        data-testid="picker-error"
      >
        <p className="text-sm text-red-600 mb-4">
          נכשל בטעינת המשימות
        </p>
        <button
          onClick={() => refetch()}
          className="text-blue-600 text-sm font-medium underline"
          data-testid="picker-retry"
        >
          נסה שוב
        </button>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6 bg-white text-center"
        data-testid="picker-empty"
      >
        <div className="text-4xl mb-4">📋</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">No tasks assigned</h1>
        <p className="text-sm text-gray-500">You don't have any picking tasks right now.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-lg font-bold text-gray-900">My Tasks</h1>
        <p className="text-xs text-gray-500 mt-0.5">{tasks.length} assigned</p>
      </header>

      <div className="p-4 space-y-3" data-testid="picker-task-list">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            className="w-full rounded-xl bg-white border border-gray-200 p-4 text-left active:bg-gray-50 transition-colors shadow-sm"
            onClick={() => navigate(pickerTaskPath(task.id))}
            data-testid="picker-task-item"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-bold text-gray-900">Task #{task.taskNumber}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusChipClass(task.status)}`}
              >
                {taskStatusLabel(task.status)}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              {task.completedSteps}/{task.totalSteps} steps done
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
