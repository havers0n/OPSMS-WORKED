import { useEffect } from 'react';
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
  compact?: boolean;
  onStateChange?: (state: ManualOrderCheckUnitsPanelState) => void;
}

export function ManualOrderCheckUnitsPanel({
  orderId,
  interactive = false,
  compact = false,
  onStateChange
}: ManualOrderCheckUnitsPanelProps) {
  const checkUnitsQuery = useQuery(orderCheckUnitsQueryOptions(orderId));
  const createCheckUnit = useCreateManualShiftOrderCheckUnit(orderId);
  const updateCheckUnitStatus = useUpdateManualShiftOrderCheckUnitStatus();
  const checkUnits = checkUnitsQuery.data ?? [];
  const progress = summarizeManualShiftOrderCheckUnits(checkUnits);
  const canCloseOrder = canCloseOrderFromCheckUnits(checkUnits);
  const hasUnits = checkUnits.length > 0;

  useEffect(() => {
    onStateChange?.({
      hasUnits,
      canCloseOrder,
      isLoading: checkUnitsQuery.isLoading,
      isError: checkUnitsQuery.isError
    });
  }, [onStateChange, hasUnits, canCloseOrder, checkUnitsQuery.isLoading, checkUnitsQuery.isError]);

  return (
    <section className={`bg-white border border-gray-200 rounded-2xl ${compact ? 'p-3' : 'p-5'} flex flex-col gap-3 text-right`}>
      <h3 className={`${compact ? 'text-base' : 'text-lg'} font-bold`}>יחידות בדיקה</h3>

      {checkUnitsQuery.isLoading && (
        <p className="text-sm text-gray-500" data-testid="check-units-loading">
          Loading check units...
        </p>
      )}
      {checkUnitsQuery.isError && (
        <p className="text-sm text-red-600" data-testid="check-units-error">
          Failed to load check units.
        </p>
      )}
      {!checkUnitsQuery.isLoading && !checkUnitsQuery.isError && checkUnits.length === 0 && (
        <p className="text-sm text-gray-500" data-testid="check-units-empty">
          No check units recorded yet.
        </p>
      )}
      {!checkUnitsQuery.isLoading && !checkUnitsQuery.isError && checkUnits.length > 0 && (
        <>
          <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2'} gap-2 text-sm`} data-testid="check-units-summary">
            <div className="rounded-lg border border-gray-200 px-3 py-2">
              Checked / active: {progress.checkedUnits} / {progress.activeUnits}
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2">Open: {progress.openUnits}</div>
            <div className="rounded-lg border border-gray-200 px-3 py-2">
              Returned: {progress.returnedUnits}
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2 text-gray-500">
              Voided: {progress.voidedUnits}
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2">
              Partially checked: {progress.partiallyChecked ? 'Yes' : 'No'}
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2">
              Physically checked: {progress.physicallyChecked ? 'Yes' : 'No'}
            </div>
          </div>
          <ul className="flex flex-col gap-2" data-testid="check-units-list">
            {checkUnits.map((unit) => {
              const isVoided = unit.status === 'voided';
              return (
                <li
                  key={unit.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${isVoided ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-gray-200 bg-white'}`}
                  data-testid={`check-unit-${unit.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Unit #{unit.unitNumber}</span>
                    <span>{STATUS_LABELS[unit.status]}</span>
                  </div>
                  {interactive && (
                    <div className="flex items-center gap-2 mt-2">
                      {!isVoided && unit.status !== 'checked' && (
                        <button
                          type="button"
                          onClick={() => updateCheckUnitStatus.mutate({ checkUnitId: unit.id, status: 'checked' })}
                          className="px-3 py-1 rounded-lg bg-green-500 text-white text-sm font-bold"
                        >
                          Mark checked
                        </button>
                      )}
                      {!isVoided && unit.status !== 'returned' && (
                        <button
                          type="button"
                          onClick={() => updateCheckUnitStatus.mutate({ checkUnitId: unit.id, status: 'returned' })}
                          className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-sm font-bold"
                        >
                          Needs fix
                        </button>
                      )}
                      {!isVoided && (
                        <button
                          type="button"
                          onClick={() => updateCheckUnitStatus.mutate({ checkUnitId: unit.id, status: 'voided' })}
                          className="px-3 py-1 rounded-lg border border-red-300 text-red-700 text-sm font-bold"
                        >
                          Void
                        </button>
                      )}
                    </div>
                  )}
                  {unit.note && <p className="mt-1">Note: {unit.note}</p>}
                  {unit.reason && <p className="mt-1">Reason: {unit.reason}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {interactive && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => createCheckUnit.mutate()}
            className="w-full h-10 rounded-lg bg-gray-100 font-bold"
            data-testid="create-check-unit"
          >
            הוסף יחידת בדיקה
          </button>
        </div>
      )}
    </section>
  );
}

