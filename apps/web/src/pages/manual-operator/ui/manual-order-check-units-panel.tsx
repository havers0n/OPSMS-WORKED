import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orderCheckUnitsQueryOptions } from '@/entities/manual-shift/api/queries';
import {
  useCreateManualShiftOrderCheckUnit,
  useUpdateManualShiftOrderCheckUnitStatus
} from '@/entities/manual-shift/api/mutations';
import {
  canCloseOrderFromCheckUnits,
  summarizeManualShiftOrderCheckUnits
} from '@/entities/manual-shift/model/shift-selectors';

const STATUS_LABELS = {
  open: 'פתוח',
  checked: 'נבדק',
  returned: 'דורש תיקון',
  voided: 'בוטל'
} as const;

interface ManualOrderCheckUnitsPanelState {
  hasUnits: boolean;
  canCloseOrder: boolean;
  isLoading: boolean;
  isError: boolean;
}

interface ManualOrderCheckUnitsPanelProps {
  orderId: string;
  interactive?: boolean;
  canInteract?: boolean;
  disabledReason?: string;
  compact?: boolean;
  detailsDefaultOpen?: boolean;
  onStateChange?: (state: ManualOrderCheckUnitsPanelState) => void;
}

export function ManualOrderCheckUnitsPanel({
  orderId,
  interactive = false,
  canInteract = true,
  disabledReason,
  compact = false,
  detailsDefaultOpen,
  onStateChange
}: ManualOrderCheckUnitsPanelProps) {
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createClickLockRef = useRef(false);
  const statusClickLockRef = useRef(false);
  const [isCreateCooldown, setIsCreateCooldown] = useState(false);
  const checkUnitsQuery = useQuery(orderCheckUnitsQueryOptions(orderId));
  const createCheckUnit = useCreateManualShiftOrderCheckUnit(orderId);
  const updateCheckUnitStatus = useUpdateManualShiftOrderCheckUnitStatus();
  const checkUnits = checkUnitsQuery.data ?? [];
  const progress = summarizeManualShiftOrderCheckUnits(checkUnits);
  const canCloseOrder = canCloseOrderFromCheckUnits(checkUnits);
  const hasUnits = checkUnits.length > 0;
  const canPerformActions = interactive && canInteract;
  const showInteractionHint = interactive && !canInteract && Boolean(disabledReason);
  const createDisabled = !canPerformActions || createCheckUnit.isPending || isCreateCooldown;
  const statusChipLabel =
    progress.returnedUnits > 0
      ? 'דורש תיקון'
      : progress.physicallyChecked
        ? 'כל היחידות נבדקו'
        : progress.partiallyChecked
          ? 'נבדק חלקית'
          : null;

  useEffect(() => {
    onStateChange?.({
      hasUnits,
      canCloseOrder,
      isLoading: checkUnitsQuery.isLoading,
      isError: checkUnitsQuery.isError
    });
  }, [onStateChange, hasUnits, canCloseOrder, checkUnitsQuery.isLoading, checkUnitsQuery.isError]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  function handleCreateCheckUnit() {
    if (createDisabled || createClickLockRef.current) return;
    createClickLockRef.current = true;
    createCheckUnit.mutate(
      {},
      {
        onSuccess: () => {
          setIsCreateCooldown(true);
          if (cooldownTimerRef.current) {
            clearTimeout(cooldownTimerRef.current);
          }
          cooldownTimerRef.current = setTimeout(() => {
            setIsCreateCooldown(false);
            createClickLockRef.current = false;
            cooldownTimerRef.current = null;
          }, 800);
        },
        onError: () => {
          createClickLockRef.current = false;
        }
      }
    );
  }

  return (
    <section className={`bg-white border border-gray-200 rounded-2xl ${compact ? 'p-3' : 'p-5'} flex flex-col gap-3 text-right`}>
      <h3 className={`${compact ? 'text-base' : 'text-lg'} font-bold`}>יחידות בדיקה</h3>

      {checkUnitsQuery.isLoading && (
        <p className="text-sm text-gray-500" data-testid="check-units-loading">
          טוען יחידות בדיקה...
        </p>
      )}
      {checkUnitsQuery.isError && (
        <p className="text-sm text-red-600" data-testid="check-units-error">
          שגיאה בטעינת יחידות בדיקה
        </p>
      )}
      {!checkUnitsQuery.isLoading && !checkUnitsQuery.isError && checkUnits.length === 0 && (
        <p className="text-sm text-gray-500" data-testid="check-units-empty">
          עדיין לא נוספו יחידות בדיקה
        </p>
      )}
      {!checkUnitsQuery.isLoading && !checkUnitsQuery.isError && checkUnits.length > 0 && (
        <>
          <div
            className={`flex ${compact ? 'flex-col gap-2' : 'items-center justify-between gap-3'} rounded-lg border border-gray-200 px-3 py-2`}
            data-testid="check-units-summary"
          >
            <div className="font-semibold text-sm">נבדקו {progress.checkedUnits} מתוך {progress.activeUnits}</div>
            {statusChipLabel && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                  statusChipLabel === 'דורש תיקון'
                    ? 'bg-red-100 text-red-700'
                    : statusChipLabel === 'כל היחידות נבדקו'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
                data-testid="check-units-status-chip"
              >
                {statusChipLabel}
              </span>
            )}
          </div>

          <details
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            open={detailsDefaultOpen ?? !compact}
            data-testid="check-units-details"
          >
            <summary className="cursor-pointer font-medium select-none">פרטים</summary>
            <div className="mt-2 flex flex-col gap-1 text-gray-700">
              <div>ממתינות לבדיקה: {progress.openUnits}</div>
              <div>דורשות תיקון: {progress.returnedUnits}</div>
              <div>בוטלו: {progress.voidedUnits}</div>
            </div>
          </details>

          <ul className="flex flex-col gap-2" data-testid="check-units-list">
            {checkUnits.map((unit) => {
              const isVoided = unit.status === 'voided';
              const statusActionDisabled = !canPerformActions || updateCheckUnitStatus.isPending;
              function mutateStatus(status: 'open' | 'checked' | 'returned' | 'voided') {
                if (statusActionDisabled || statusClickLockRef.current) return;
                statusClickLockRef.current = true;
                updateCheckUnitStatus.mutate(
                  { checkUnitId: unit.id, status },
                  {
                    onSettled: () => {
                      statusClickLockRef.current = false;
                    }
                  }
                );
              }
              return (
                <li
                  key={unit.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${isVoided ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-gray-200 bg-white'}`}
                  data-testid={`check-unit-${unit.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">יחידה #{unit.unitNumber}</span>
                    <span className="text-gray-400">·</span>
                    <span>{STATUS_LABELS[unit.status]}</span>
                  </div>
                  {interactive && (
                    <div className={`flex gap-2 mt-2 ${compact ? 'flex-wrap' : 'flex-wrap'}`}>
                      {!isVoided && unit.status !== 'checked' && unit.status !== 'returned' && (
                        <button
                          type="button"
                          onClick={() => mutateStatus('checked')}
                          disabled={statusActionDisabled}
                          className="px-3 py-1 rounded-lg bg-green-500 text-white text-sm font-bold disabled:opacity-50"
                        >
                          סמן כנבדק
                        </button>
                      )}
                      {!isVoided && unit.status === 'returned' && (
                        <button
                          type="button"
                          onClick={() => mutateStatus('checked')}
                          disabled={statusActionDisabled}
                          className="px-3 py-1 rounded-lg bg-green-500 text-white text-sm font-bold disabled:opacity-50"
                        >
                          סמן כתוקן
                        </button>
                      )}
                      {!isVoided && unit.status === 'returned' && (
                        <button
                          type="button"
                          onClick={() => mutateStatus('open')}
                          disabled={statusActionDisabled}
                          className="px-3 py-1 rounded-lg bg-amber-100 text-amber-800 text-sm font-bold disabled:opacity-50"
                        >
                          בטל תיקון
                        </button>
                      )}
                      {!isVoided && unit.status !== 'returned' && (
                        <button
                          type="button"
                          onClick={() => mutateStatus('returned')}
                          disabled={statusActionDisabled}
                          className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-sm font-bold disabled:opacity-50"
                        >
                          דורש תיקון
                        </button>
                      )}
                      {!isVoided && (
                        <button
                          type="button"
                          onClick={() => mutateStatus('voided')}
                          disabled={statusActionDisabled}
                          className="px-3 py-1 rounded-lg border border-red-300 text-red-700 text-sm font-bold disabled:opacity-50"
                        >
                          בטל יחידה
                        </button>
                      )}
                    </div>
                  )}
                  {unit.note && <p className="mt-1">הערה: {unit.note}</p>}
                  {unit.reason && <p className="mt-1">סיבה: {unit.reason}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {interactive && (
        <div className="mt-1">
          {showInteractionHint && (
            <p className="mb-2 text-sm text-amber-700" data-testid="check-units-disabled-reason">
              {disabledReason}
            </p>
          )}
          <button
            type="button"
            onClick={handleCreateCheckUnit}
            disabled={createDisabled}
            className={`w-full rounded-lg font-bold ${hasUnits ? 'h-10 bg-gray-100' : 'h-12 bg-blue-600 text-white text-base'} disabled:opacity-50`}
            data-testid="create-check-unit"
          >
            הוסף יחידת בדיקה
          </button>
        </div>
      )}
    </section>
  );
}
