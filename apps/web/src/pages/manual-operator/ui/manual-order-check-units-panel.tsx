import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orderAshlamotQueryOptions, orderCheckUnitsQueryOptions } from '@/entities/manual-shift/api/queries';
import {
  useCreateManualShiftOrderAshlama,
  useCreateManualShiftOrderCheckUnit,
  usePatchManualShiftOrderAshlama,
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

const RETURN_REASON_OPTIONS = [
  'חסר מוצר',
  'כמות לא נכונה',
  'מוצר לא נכון',
  'מוצר פגום',
  'בעיית אריזה',
  'אחר'
] as const;

interface ManualOrderCheckUnitsPanelState {
  hasUnits: boolean;
  canCloseOrder: boolean;
  checkedUnits: number;
  activeUnits: number;
  openUnits: number;
  returnedUnits: number;
  missingUnits: number;
  isLoading: boolean;
  isError: boolean;
}

interface ManualOrderCheckUnitsPanelProps {
  orderId: string;
  interactive?: boolean;
  canInteract?: boolean;
  disabledReason?: string;
  compact?: boolean;
  expectedUnitsCount?: number | null;
  detailsDefaultOpen?: boolean;
  onStateChange?: (state: ManualOrderCheckUnitsPanelState) => void;
}

export function ManualOrderCheckUnitsPanel({
  orderId,
  interactive = false,
  canInteract = true,
  disabledReason,
  compact = false,
  expectedUnitsCount = null,
  detailsDefaultOpen,
  onStateChange
}: ManualOrderCheckUnitsPanelProps) {
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createClickLockRef = useRef(false);
  const statusClickLockRef = useRef(false);
  const [isCreateCooldown, setIsCreateCooldown] = useState(false);
  const checkUnitsQuery = useQuery(orderCheckUnitsQueryOptions(orderId));
  const createCheckUnit = useCreateManualShiftOrderCheckUnit(orderId);
  const ashlamotQuery = useQuery(orderAshlamotQueryOptions(orderId));
  const createAshlama = useCreateManualShiftOrderAshlama(orderId);
  const patchAshlama = usePatchManualShiftOrderAshlama(orderId);
  const updateCheckUnitStatus = useUpdateManualShiftOrderCheckUnitStatus();
  const [reasonDraftByUnitId, setReasonDraftByUnitId] = useState<Record<string, string>>({});
  const [reasonSelectorUnitId, setReasonSelectorUnitId] = useState<string | null>(null);
  const [ashlamaDialogCheckUnitId, setAshlamaDialogCheckUnitId] = useState<string | null>(null);
  const [ashlamaDraftText, setAshlamaDraftText] = useState('');
  const checkUnits = checkUnitsQuery.data ?? [];
  const ashlamot = Array.isArray(ashlamotQuery.data) ? ashlamotQuery.data : [];
  const ashlamaByCheckUnitId = new Map(
    ashlamot
      .filter(
        (ashlama) =>
          typeof ashlama.checkUnitId === 'string' &&
          (ashlama.status === 'open' || ashlama.status === 'done' || ashlama.status === 'cancelled')
      )
      .map((ashlama) => [ashlama.checkUnitId, ashlama] as const)
  );
  const progress = summarizeManualShiftOrderCheckUnits(checkUnits);
  const hasOpenAshlama = ashlamot.some((ashlama) => ashlama.status === 'open');
  const canCloseOrder = canCloseOrderFromCheckUnits(checkUnits, expectedUnitsCount) && !hasOpenAshlama;
  const hasUnits = checkUnits.length > 0;
  const missingUnits = expectedUnitsCount != null ? Math.max(expectedUnitsCount - progress.activeUnits, 0) : 0;
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
      checkedUnits: progress.checkedUnits,
      activeUnits: progress.activeUnits,
      openUnits: progress.openUnits,
      returnedUnits: progress.returnedUnits,
      missingUnits,
      isLoading: checkUnitsQuery.isLoading,
      isError: checkUnitsQuery.isError
    });
  }, [onStateChange, hasUnits, canCloseOrder, progress.checkedUnits, progress.activeUnits, progress.openUnits, progress.returnedUnits, missingUnits, checkUnitsQuery.isLoading, checkUnitsQuery.isError]);

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
            <div className="font-semibold text-sm">
              נבדקו {progress.checkedUnits} מתוך {expectedUnitsCount ?? progress.activeUnits}
            </div>
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
              function mutateStatus(
                status: 'open' | 'checked' | 'returned' | 'voided',
                reason?: string
              ) {
                if (statusActionDisabled || statusClickLockRef.current) return;
                statusClickLockRef.current = true;
                updateCheckUnitStatus.mutate(
                  { checkUnitId: unit.id, status, reason },
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
                          onClick={() => {
                            setAshlamaDialogCheckUnitId(unit.id);
                            setAshlamaDraftText('');
                          }}
                          disabled={statusActionDisabled || createAshlama.isPending}
                          className="px-3 py-1 rounded-lg bg-blue-100 text-blue-800 text-sm font-bold disabled:opacity-50"
                          data-testid={`create-completion-${unit.id}`}
                        >
                          צור השלמה
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
                          onClick={() => setReasonSelectorUnitId(unit.id)}
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
                  {!isVoided && unit.status !== 'returned' && reasonSelectorUnitId === unit.id && (
                    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2" data-testid={`returned-reason-selector-${unit.id}`}>
                      <p className="text-xs font-semibold text-red-800">בחר סיבת תיקון לפני סימון "דורש תיקון"</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {RETURN_REASON_OPTIONS.map((reasonOption) => {
                          const isSelected = reasonDraftByUnitId[unit.id] === reasonOption;
                          return (
                            <button
                              key={reasonOption}
                              type="button"
                              onClick={() => setReasonDraftByUnitId((prev) => ({ ...prev, [unit.id]: reasonOption }))}
                              className={`px-2 py-1 rounded-md border text-xs font-bold ${
                                isSelected ? 'border-red-400 bg-red-100 text-red-800' : 'border-red-200 bg-white text-red-700'
                              }`}
                            >
                              {reasonOption}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const selectedReason = reasonDraftByUnitId[unit.id];
                            if (!selectedReason) return;
                            mutateStatus('returned', selectedReason);
                            setReasonSelectorUnitId(null);
                          }}
                          disabled={statusActionDisabled || !reasonDraftByUnitId[unit.id]}
                          className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50"
                        >
                          שמור תיקון
                        </button>
                        <button
                          type="button"
                          onClick={() => setReasonSelectorUnitId(null)}
                          className="px-3 py-1 rounded-lg bg-white border border-gray-300 text-xs font-bold"
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  )}
                  {unit.note && <p className="mt-1">הערה: {unit.note}</p>}
                  {unit.reason && <p className="mt-1">סיבת תיקון: {unit.reason}</p>}
                  {unit.status === 'returned' && (
                    <p className="mt-1 text-xs font-semibold text-blue-800">
                      {(() => {
                        const ashlama = ashlamaByCheckUnitId.get(unit.id);
                        if (!ashlama) return 'השלמה לא נפתחה';
                        if (ashlama.status === 'open') return 'השלמה פתוחה';
                        if (ashlama.status === 'done') return 'השלמה הושלמה — יש לבדוק שוב';
                        return 'השלמה בוטלה';
                      })()}
                    </p>
                  )}
                  {unit.status === 'returned' && ashlamaByCheckUnitId.get(unit.id)?.status === 'open' && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => patchAshlama.mutate({ ashlamaId: ashlamaByCheckUnitId.get(unit.id)!.id, status: 'done' })}
                        className="px-3 py-1 rounded-lg bg-green-100 text-green-800 text-xs font-bold disabled:opacity-50"
                        disabled={patchAshlama.isPending}
                      >
                        סמן השלמה כהושלמה
                      </button>
                      <button
                        type="button"
                        onClick={() => patchAshlama.mutate({ ashlamaId: ashlamaByCheckUnitId.get(unit.id)!.id, status: 'cancelled' })}
                        className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold disabled:opacity-50"
                        disabled={patchAshlama.isPending}
                      >
                        בטל השלמה
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {expectedUnitsCount != null && progress.checkedUnits < expectedUnitsCount && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="missing-check-units-message">
              חסרות יחידות בדיקה לפני סגירה כתקין
            </p>
          )}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            השלמה היא משימה נפרדת. אחרי השלמה יש לבדוק שוב.
          </p>
          {hasOpenAshlama && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="open-ashlama-block-message">
              לא ניתן לסגור כתקין כל עוד קיימת השלמה פתוחה בהזמנה.
            </p>
          )}
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
      {ashlamaDialogCheckUnitId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" data-testid="ashlama-dialog">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 text-right shadow-lg">
            <h4 className="text-lg font-bold">יצירת השלמה</h4>
            <label className="mt-3 block text-sm font-medium">מה צריך להשלים?</label>
            <textarea
              value={ashlamaDraftText}
              onChange={(event) => setAshlamaDraftText(event.target.value)}
              className="mt-1 h-28 w-full rounded-lg border border-gray-300 p-2"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = ashlamaDraftText.trim();
                  if (!text) return;
                  createAshlama.mutate(
                    { checkUnitId: ashlamaDialogCheckUnitId, text },
                    {
                      onSuccess: () => {
                        setAshlamaDialogCheckUnitId(null);
                        setAshlamaDraftText('');
                      }
                    }
                  );
                }}
                disabled={!ashlamaDraftText.trim() || createAshlama.isPending}
                className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
              >
                צור השלמה
              </button>
              <button
                type="button"
                onClick={() => {
                  setAshlamaDialogCheckUnitId(null);
                  setAshlamaDraftText('');
                }}
                className="px-3 py-1 rounded-lg border border-gray-300 bg-white text-sm font-bold"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
