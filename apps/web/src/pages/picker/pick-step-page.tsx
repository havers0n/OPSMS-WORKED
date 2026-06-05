import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Minus, Package, Plus } from 'lucide-react';
import { pickerTaskDetailQueryOptions } from '@/entities/picker/api/queries';
import { useConfirmPickStep } from '@/entities/picker/api/mutations';
import { pickerStepPath, pickerTaskPath } from '@/shared/config/routes';
import type { PickStepDetail, PickTaskDetail } from '@wos/domain';

type PickStepScreenProps = {
  task: PickTaskDetail;
  step: PickStepDetail;
  qtyPicked: number;
  onQtyChange: (qty: number) => void;
  onConfirm: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  error: string | null;
};

function PickStepScreen({
  task,
  step,
  qtyPicked,
  onQtyChange,
  onConfirm,
  onBack,
  isSubmitting,
  error,
}: PickStepScreenProps) {
  const isShortage = qtyPicked < step.qtyRequired;

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-md mx-auto">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center text-blue-600 active:bg-blue-50 p-2 rounded-lg -ml-2"
          data-testid="pick-step-back"
        >
          <ChevronLeft className="w-6 h-6" />
          <span className="font-medium ml-1 text-sm">Back</span>
        </button>
        <div className="text-base font-bold text-gray-800">Task #{task.taskNumber}</div>
        <div className="w-16" />
      </header>

      <main className="flex-1 overflow-y-auto pb-28">
        <section className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-center">
          <div className="w-full aspect-square max-h-48 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center">
            {step.imageUrl ? (
              <img
                src={step.imageUrl}
                alt={step.itemName}
                className="w-full h-full object-contain rounded-xl"
                data-testid="pick-step-product-image"
              />
            ) : (
              <Package
                className="w-20 h-20 text-gray-300"
                data-testid="pick-step-product-placeholder"
              />
            )}
          </div>
        </section>

        <section className="p-5 border-b border-gray-200">
          <h1
            className="text-xl font-bold text-gray-900 leading-tight mb-2"
            data-testid="pick-step-product-name"
          >
            {step.itemName}
          </h1>
          <div
            className="text-sm font-mono text-gray-500 bg-gray-100 w-fit px-2 py-1 rounded"
            data-testid="pick-step-sku"
          >
            SKU: {step.sku}
          </div>
        </section>

        {step.sourceCellAddress && (
          <section className="p-5 border-b border-gray-200 bg-blue-50/50">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Location
            </div>
            <div
              className="font-medium text-lg text-gray-800 flex items-center gap-2 mb-3"
              data-testid="pick-step-location"
            >
              <MapPin className="text-blue-500 w-5 h-5 shrink-0" />
              {step.sourceCellAddress}
            </div>
            <button
              disabled
              className="w-full bg-gray-100 text-gray-400 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 cursor-not-allowed"
              data-testid="pick-step-where-is-it"
            >
              <MapPin className="w-4 h-4" />
              Where is it? (coming soon)
            </button>
          </section>
        )}

        <section className="p-5">
          <div className="flex justify-between items-end border-b border-gray-100 pb-5 mb-5">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Required
              </div>
              <div
                className="text-4xl font-bold text-gray-900"
                data-testid="pick-step-qty-required"
              >
                {step.qtyRequired}{' '}
                <span className="text-lg text-gray-500 font-medium">pcs.</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Qty picked
            </div>
            <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-2 border border-gray-200">
              <button
                onClick={() => onQtyChange(Math.max(0, qtyPicked - 1))}
                className="w-14 h-14 flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-200 text-gray-700 active:bg-gray-100"
                data-testid="pick-step-qty-decrease"
              >
                <Minus className="w-6 h-6" />
              </button>
              <div
                className="flex-1 px-4 text-center text-4xl font-bold text-gray-900"
                data-testid="pick-step-qty-value"
              >
                {qtyPicked}
              </div>
              <button
                onClick={() => onQtyChange(Math.min(step.qtyRequired, qtyPicked + 1))}
                disabled={qtyPicked >= step.qtyRequired}
                className="w-14 h-14 flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-200 text-gray-700 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="pick-step-qty-increase"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          {isShortage && qtyPicked > 0 && (
            <div
              className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200"
              data-testid="pick-step-shortage-warning"
            >
              <p className="text-sm text-amber-700 font-medium">
                Picking {qtyPicked} of {step.qtyRequired} required — actual qty picked will be saved.
              </p>
            </div>
          )}

          {error && (
            <div
              className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200"
              data-testid="pick-step-error"
            >
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white border-t border-gray-200 pb-6">
        <button
          onClick={onConfirm}
          disabled={isSubmitting || qtyPicked === 0}
          className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 text-lg font-bold shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 ${
            isShortage
              ? 'bg-amber-500 text-white shadow-amber-500/20'
              : 'bg-green-500 text-white shadow-green-500/20'
          }`}
          data-testid="pick-step-confirm"
        >
          {isSubmitting
            ? 'Confirming...'
            : isShortage
            ? 'Confirm partial pick'
            : 'Confirm pick'}
        </button>
      </footer>
    </div>
  );
}

export function PickStepPage() {
  const { taskId, stepId } = useParams<{ taskId: string; stepId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workerId = searchParams.get('workerId') ?? '';

  const { data: task, isLoading } = useQuery(
    pickerTaskDetailQueryOptions(taskId ?? null, workerId || null)
  );

  const step = task?.steps.find((s) => s.id === stepId);

  const [qtyOverride, setQtyOverride] = useState<number | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const confirm = useConfirmPickStep();

  const effectiveQty = qtyOverride ?? step?.qtyRequired ?? 0;

  const handleBack = () => navigate(pickerTaskPath(taskId ?? '', workerId));

  const handleConfirm = async () => {
    if (!taskId || !stepId || !workerId) return;
    setConfirmError(null);
    try {
      const updatedTask = await confirm.mutateAsync({
        taskId,
        stepId,
        workerId,
        qtyPicked: effectiveQty,
      });
      const nextPending = updatedTask.steps.find((s) => s.status === 'pending');
      if (nextPending) {
        navigate(pickerStepPath(taskId, nextPending.id, workerId), { replace: true });
      } else {
        navigate(pickerTaskPath(taskId, workerId), { replace: true });
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        setConfirmError(
          'This step was already confirmed with a different quantity. Refresh to see the latest state.'
        );
      } else {
        setConfirmError(
          err instanceof Error ? err.message : 'Failed to confirm step. Please try again.'
        );
      }
    }
  };

  if (isLoading || !task) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-white"
        data-testid="pick-step-loading"
      >
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!step) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6 bg-white"
        data-testid="pick-step-not-found"
      >
        <p className="text-sm text-gray-600 mb-4">Step not found.</p>
        <button onClick={handleBack} className="text-blue-600 text-sm font-medium">
          Back to task
        </button>
      </div>
    );
  }

  return (
    <PickStepScreen
      task={task}
      step={step}
      qtyPicked={effectiveQty}
      onQtyChange={setQtyOverride}
      onConfirm={handleConfirm}
      onBack={handleBack}
      isSubmitting={confirm.isPending}
      error={confirmError}
    />
  );
}
