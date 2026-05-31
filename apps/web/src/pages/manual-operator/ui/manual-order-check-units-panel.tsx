import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orderAshlamotQueryOptions, orderCheckUnitsQueryOptions } from '@/entities/manual-shift/api/queries';
import {
  useCreateManualShiftOrderAshlama,
  useCreateManualShiftOrderCheckUnit,
  useUpdateManualShiftOrderCheckUnitStatus
} from '@/entities/manual-shift/api/mutations';
import {
  canCloseOrderFromCheckUnits,
  summarizeManualShiftOrderCheckUnits
} from '@/entities/manual-shift/model/shift-selectors';

const RETURN_REASON_OPTIONS = [
  'שכח לשים',
  'מוצר אזל',
  'כמות לא נכונה',
  'מוצר לא נכון',
  'מוצר פגום',
  'בעיית אריזה',
  'אחר'
] as const;

type UnitPrimaryAction = 'mark_checked' | 'mark_open' | 'create_completion' | null;
type UnitSecondaryAction = 'mark_returned' | 'mark_checked' | 'status_open_completion' | 'status_done_completion';
type UnitOverflowAction = 'mark_open' | 'mark_voided';
type UnitCompletionSubstate = 'none' | 'open' | 'done' | 'cancelled';
type StockoutFlowStep = 'choose-outcome' | 'report-only' | 'create-ashlama';

interface CheckUnitUiState {
  badgeLabel: string;
  badgeSeverity: 'neutral' | 'success' | 'danger';
  primaryAction: UnitPrimaryAction;
  secondaryActions: UnitSecondaryAction[];
  overflowActions: UnitOverflowAction[];
  completionSubstate: UnitCompletionSubstate;
  canCreateCompletion: boolean;
}

function getCheckUnitUiState(input: {
  status: 'open' | 'checked' | 'returned' | 'voided';
  reason?: string | null;
  completionStatus?: UnitCompletionSubstate;
}): CheckUnitUiState {
  const completionSubstate = input.completionStatus ?? 'none';
  const canCreateCompletion = false;
  if (input.status === 'voided') {
    return {
      badgeLabel: 'בוטל',
      badgeSeverity: 'neutral',
      primaryAction: null,
      secondaryActions: [],
      overflowActions: [],
      completionSubstate,
      canCreateCompletion: false
    };
  }
  if (input.status === 'open') {
    return {
      badgeLabel: 'פתוח',
      badgeSeverity: 'neutral',
      primaryAction: 'mark_checked',
      secondaryActions: ['mark_returned'],
      overflowActions: ['mark_voided'],
      completionSubstate,
      canCreateCompletion: false
    };
  }
  if (input.status === 'checked') {
    const isAzalLog = (input.reason ?? '').trim() === 'מוצר אזל';
    return {
      badgeLabel: isAzalLog ? 'מוצר אזל' : 'תקין',
      badgeSeverity: isAzalLog ? 'neutral' : 'success',
      primaryAction: null,
      secondaryActions: isAzalLog ? [] : ['mark_returned'],
      overflowActions: ['mark_voided'],
      completionSubstate,
      canCreateCompletion: false
    };
  }
  if (completionSubstate === 'open') {
    return {
      badgeLabel: 'דורש תיקון',
      badgeSeverity: 'danger',
      primaryAction: null,
      secondaryActions: ['status_open_completion'],
      overflowActions: ['mark_open', 'mark_voided'],
      completionSubstate,
      canCreateCompletion
    };
  }
  if (completionSubstate === 'done') {
    return {
      badgeLabel: 'דורש תיקון',
      badgeSeverity: 'danger',
      primaryAction: 'mark_checked',
      secondaryActions: ['status_done_completion'],
      overflowActions: ['mark_open', 'mark_voided'],
      completionSubstate,
      canCreateCompletion
    };
  }
  return {
    badgeLabel: 'דורש תיקון',
    badgeSeverity: 'danger',
    primaryAction: canCreateCompletion ? 'create_completion' : 'mark_checked',
    secondaryActions: canCreateCompletion ? ['mark_checked'] : [],
    overflowActions: ['mark_open', 'mark_voided'],
    completionSubstate,
    canCreateCompletion
  };
}

interface ManualOrderCheckUnitsPanelState {
  hasUnits: boolean;
  canCloseOrder: boolean;
  blockingReason: string | null;
  hasOpenAshlama: boolean;
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
  const updateCheckUnitStatus = useUpdateManualShiftOrderCheckUnitStatus();
  const [reasonDraftByUnitId, setReasonDraftByUnitId] = useState<Record<string, string>>({});
  const [stockoutStepByUnitId, setStockoutStepByUnitId] = useState<Record<string, StockoutFlowStep | undefined>>({});
  const [reasonSelectorUnitId, setReasonSelectorUnitId] = useState<string | null>(null);
  const [azalNoteDraft, setAzalNoteDraft] = useState('');
  const [azalAshlamaText, setAzalAshlamaText] = useState('');
  const [isAshlamaDialogOpen, setIsAshlamaDialogOpen] = useState(false);
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
  const blockingReason =
    hasOpenAshlama
      ? 'לא ניתן לסגור: יש השלמה פתוחה'
      : expectedUnitsCount != null && progress.checkedUnits < expectedUnitsCount
        ? 'לא ניתן לסגור: חסרים משטחים לבדיקה'
        : null;
  const hasUnits = checkUnits.length > 0;
  const missingUnits = expectedUnitsCount != null ? Math.max(expectedUnitsCount - progress.activeUnits, 0) : 0;
  const batchCreateCount = progress.activeUnits === 0 && missingUnits > 1 ? missingUnits : 1;
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
      blockingReason,
      hasOpenAshlama,
      checkedUnits: progress.checkedUnits,
      activeUnits: progress.activeUnits,
      openUnits: progress.openUnits,
      returnedUnits: progress.returnedUnits,
      missingUnits,
      isLoading: checkUnitsQuery.isLoading,
      isError: checkUnitsQuery.isError
    });
  }, [onStateChange, hasUnits, canCloseOrder, blockingReason, hasOpenAshlama, progress.checkedUnits, progress.activeUnits, progress.openUnits, progress.returnedUnits, missingUnits, checkUnitsQuery.isLoading, checkUnitsQuery.isError]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const bulkAllOkLockRef = useRef(false);
  const canBulkApprove =
    canPerformActions &&
    progress.openUnits > 1 &&
    progress.returnedUnits === 0 &&
    !updateCheckUnitStatus.isPending &&
    !bulkAllOkLockRef.current;

  async function handleBulkApprove() {
    if (!canBulkApprove || bulkAllOkLockRef.current) return;
    bulkAllOkLockRef.current = true;
    const openUnits = checkUnits.filter((u) => u.status === 'open');
    try {
      for (const unit of openUnits) {
        await updateCheckUnitStatus.mutateAsync({ checkUnitId: unit.id, status: 'checked' });
      }
    } finally {
      bulkAllOkLockRef.current = false;
    }
  }

  async function handleCreateCheckUnit() {
    if (createDisabled || createClickLockRef.current) return;
    createClickLockRef.current = true;
    try {
      for (let i = 0; i < batchCreateCount; i++) {
        await createCheckUnit.mutateAsync({});
      }
      setIsCreateCooldown(true);
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = setTimeout(() => {
        setIsCreateCooldown(false);
        createClickLockRef.current = false;
        cooldownTimerRef.current = null;
      }, 800);
    } catch {
      createClickLockRef.current = false;
    }
  }

  return (
    <section className={`bg-white border border-gray-200 rounded-2xl ${compact ? 'p-3' : 'p-4'} flex flex-col gap-3 text-right`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={`${compact ? 'text-base' : 'text-lg'} font-bold`}>משטחים</h3>
        {interactive && (
          <button
            type="button"
            onClick={() => {
              setIsAshlamaDialogOpen(true);
              setAshlamaDialogCheckUnitId(null);
              setAshlamaDraftText('');
            }}
            disabled={!canPerformActions || createAshlama.isPending}
            className="h-9 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 disabled:opacity-50"
            data-testid="add-order-ashlama"
          >
            + השלמה
          </button>
        )}
      </div>

      {checkUnitsQuery.isLoading && (
        <p className="text-sm text-gray-500" data-testid="check-units-loading">
          טוען משטחים...
        </p>
      )}
      {checkUnitsQuery.isError && (
        <p className="text-sm text-red-600" data-testid="check-units-error">
          שגיאה בטעינת משטחים
        </p>
      )}
      {!checkUnitsQuery.isLoading && !checkUnitsQuery.isError && checkUnits.length === 0 && (
        <p className="text-sm text-gray-500" data-testid="check-units-empty">
          עדיין לא נוספו משטחים
        </p>
      )}
      {!checkUnitsQuery.isLoading && !checkUnitsQuery.isError && checkUnits.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold" data-testid="check-units-summary">
            <span>נבדקו {progress.checkedUnits} מתוך {expectedUnitsCount ?? progress.activeUnits}</span>
            <span className="text-gray-400">·</span>
            <span>פתוחות {progress.openUnits}</span>
            <span className="text-gray-400">·</span>
            <span>תיקון {progress.returnedUnits}</span>
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
            className="text-sm"
            open={detailsDefaultOpen ?? false}
            data-testid="check-units-details"
          >
            <summary className="cursor-pointer font-medium select-none text-gray-600">פרטים</summary>
            <div className="mt-2 flex flex-col gap-1 text-gray-600">
              <div>בוטלו: {progress.voidedUnits}</div>
              <div>חסרים משטחים: {missingUnits}</div>
            </div>
          </details>

          <ul className="divide-y divide-gray-100 border-y border-gray-100" data-testid="check-units-list">
            {checkUnits.filter((unit) => unit.status !== 'voided').map((unit) => {
              const isProblemUnit = unit.status === 'returned';
              const statusActionDisabled = !canPerformActions || updateCheckUnitStatus.isPending;
              const completionStatus = ashlamaByCheckUnitId.get(unit.id)?.status ?? 'none';
              const unitUiState = getCheckUnitUiState({
                status: unit.status,
                reason: unit.reason,
                completionStatus
              });
              function mutateStatus(
                status: 'open' | 'checked' | 'returned' | 'voided',
                reason?: string,
                note?: string
              ) {
                if (statusActionDisabled || statusClickLockRef.current) return;
                statusClickLockRef.current = true;
                updateCheckUnitStatus.mutate(
                  { checkUnitId: unit.id, status, reason, note },
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
                  className="px-1 py-2 text-sm text-gray-800"
                  data-testid={`check-unit-${unit.id}`}
                >
                  <div className={`flex items-center justify-between gap-2 ${isProblemUnit ? 'mb-2' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">#{unit.unitNumber}</span>
                      <span className="text-gray-400">·</span>
                      <span>{unitUiState.badgeLabel}</span>
                    </div>
                    {unitUiState.badgeSeverity === 'danger' && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                        דורש תיקון
                      </span>
                    )}
                  </div>
                  {interactive && (
                    <div className={`flex flex-wrap items-center gap-2 ${isProblemUnit ? '' : 'mt-1'}`}>
                      {unitUiState.primaryAction === 'mark_checked' && (
                        <button
                          type="button"
                          onClick={() => mutateStatus('checked')}
                          disabled={statusActionDisabled}
                          className="h-9 rounded-lg bg-green-500 px-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                          משטח תקין
                        </button>
                      )}
                      {unitUiState.secondaryActions.includes('mark_checked') && (
                        <button
                          type="button"
                          onClick={() => mutateStatus('checked')}
                          disabled={statusActionDisabled}
                          className="h-9 rounded-lg border border-green-300 bg-white px-3 text-sm font-bold text-green-700 disabled:opacity-50"
                        >
                          משטח תקין
                        </button>
                      )}
                      {unitUiState.secondaryActions.includes('mark_returned') && (
                        <button
                          type="button"
                          onClick={() => {
                            setReasonSelectorUnitId(unit.id);
                            setReasonDraftByUnitId((prev) => ({ ...prev, [unit.id]: '' }));
                            setStockoutStepByUnitId((prev) => ({ ...prev, [unit.id]: undefined }));
                          }}
                          disabled={statusActionDisabled}
                          className="h-9 rounded-lg bg-red-100 px-3 text-sm font-bold text-red-700 disabled:opacity-50"
                        >
                          תקלה
                        </button>
                      )}
                      {unitUiState.secondaryActions.includes('status_open_completion') && (
                        <p className="px-2 py-1 text-xs font-semibold text-amber-700">יש השלמה פתוחה. השלם ואז סמן משטח תקין</p>
                      )}
                      {unitUiState.secondaryActions.includes('status_done_completion') && (
                        <p className="px-2 py-1 text-xs font-semibold text-green-700">ההשלמה מוכנה לבדיקה חוזרת</p>
                      )}
                      {unitUiState.overflowActions.length > 0 && (
                        <details className="relative" data-testid={`overflow-menu-${unit.id}`}>
                          <summary className="list-none cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-700">
                            עוד
                          </summary>
                          <div className="absolute end-0 z-10 mt-1 min-w-36 rounded-lg border border-gray-200 bg-white p-1 shadow-md">
                            {unitUiState.overflowActions.includes('mark_open') && (
                              <button
                                type="button"
                                onClick={() => mutateStatus('open')}
                                disabled={statusActionDisabled}
                                className="w-full rounded-md px-2 py-1 text-right text-sm font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                              >
                                החזר לבדיקה
                              </button>
                            )}
                            {unitUiState.overflowActions.includes('mark_voided') && (
                              <button
                                type="button"
                                onClick={() => mutateStatus('voided')}
                                disabled={statusActionDisabled}
                                className="w-full rounded-md px-2 py-1 text-right text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                בטל יחידה
                              </button>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                  {unit.status !== 'returned' && reasonSelectorUnitId === unit.id && (
                    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2" data-testid={`returned-reason-selector-${unit.id}`}>
                      {reasonDraftByUnitId[unit.id] !== 'מוצר אזל' && (
                        <>
                          <p className="text-xs font-semibold text-red-800 mb-2">בחר סיבת תיקון</p>
                          <div className="flex flex-wrap gap-2">
                            {RETURN_REASON_OPTIONS.map((reasonOption) => {
                              const isSelected = reasonDraftByUnitId[unit.id] === reasonOption;
                              return (
                                <button
                                  key={reasonOption}
                                  type="button"
                                  onClick={() => {
                                    setReasonDraftByUnitId((prev) => ({ ...prev, [unit.id]: reasonOption }));
                                    setAzalNoteDraft('');
                                    setAzalAshlamaText('');
                                    if (reasonOption === 'מוצר אזל') {
                                      setStockoutStepByUnitId((prev) => ({ ...prev, [unit.id]: 'choose-outcome' }));
                                    } else {
                                      setStockoutStepByUnitId((prev) => ({ ...prev, [unit.id]: undefined }));
                                    }
                                  }}
                                  className={`px-2 py-1 rounded-md border text-xs font-bold ${
                                    isSelected ? 'border-red-400 bg-red-100 text-red-800' : 'border-red-200 bg-white text-red-700'
                                  }`}
                                >
                                  {reasonOption}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {reasonDraftByUnitId[unit.id] === 'מוצר אזל' ? (
                        <div className="mt-2 flex flex-col gap-2">
                          {stockoutStepByUnitId[unit.id] === 'choose-outcome' && (
                            <div className="flex flex-col gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
                              <p className="text-sm font-bold text-orange-800">המוצר אזל</p>
                              <p className="text-xs font-semibold text-orange-700 mb-1">מה צריך לעשות?</p>
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => setStockoutStepByUnitId((prev) => ({ ...prev, [unit.id]: 'report-only' }))}
                                  className="flex flex-col items-center justify-center rounded-xl border border-orange-200 bg-white p-3 text-center"
                                >
                                  <span className="text-sm font-bold text-orange-800">דיווח בלבד</span>
                                  <span className="text-[10px] text-orange-600">המוצר נגמר במלאי</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStockoutStepByUnitId((prev) => ({ ...prev, [unit.id]: 'create-ashlama' }))}
                                  className="flex flex-col items-center justify-center rounded-xl border border-blue-200 bg-white p-3 text-center"
                                >
                                  <span className="text-sm font-bold text-blue-800">צור השלמה</span>
                                  <span className="text-[10px] text-blue-600">צריך להשלים את ההזמנה</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReasonDraftByUnitId((prev) => ({ ...prev, [unit.id]: '' }));
                                    setStockoutStepByUnitId((prev) => ({ ...prev, [unit.id]: undefined }));
                                  }}
                                  className="mt-1 text-xs font-bold text-gray-500 underline"
                                >
                                  חזרה לסיבות
                                </button>
                              </div>
                            </div>
                          )}

                          {stockoutStepByUnitId[unit.id] === 'report-only' && (
                            <div className="rounded-lg border border-orange-200 bg-white p-3">
                              <p className="text-xs font-bold text-orange-700 mb-1.5">איזה מוצר אזל?</p>
                              <textarea
                                value={azalNoteDraft}
                                onChange={(e) => setAzalNoteDraft(e.target.value)}
                                placeholder="מה המוצר? (אופציונלי)"
                                rows={2}
                                className="w-full text-xs border border-orange-200 rounded p-1.5 bg-orange-50 resize-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  mutateStatus('checked', 'מוצר אזל', azalNoteDraft.trim() || undefined);
                                  setReasonSelectorUnitId(null);
                                  setAzalNoteDraft('');
                                  setStockoutStepByUnitId((prev) => ({ ...prev, [unit.id]: undefined }));
                                }}
                                disabled={statusActionDisabled}
                                className="mt-2 w-full h-8 rounded-lg bg-orange-600 text-white text-xs font-bold disabled:opacity-50"
                              >
                                דווח על מוצר שאזל
                              </button>
                              <button
                                type="button"
                                onClick={() => setStockoutStepByUnitId((prev) => ({ ...prev, [unit.id]: 'choose-outcome' }))}
                                className="mt-2 w-full h-8 rounded-lg bg-white border border-gray-300 text-xs font-bold"
                              >
                                חזרה
                              </button>
                            </div>
                          )}

                          {stockoutStepByUnitId[unit.id] === 'create-ashlama' && (
                            <div className="rounded-lg border border-blue-200 bg-white p-3">
                              <p className="text-xs font-bold text-blue-700 mb-1.5">מה צריך להשלים?</p>
                              <textarea
                                value={azalAshlamaText}
                                onChange={(e) => setAzalAshlamaText(e.target.value)}
                                placeholder="מה צריך להביא? (חובה)"
                                rows={2}
                                className="w-full text-xs border border-blue-200 rounded p-1.5 bg-blue-50 resize-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  mutateStatus('checked', 'מוצר אזל');
                                  createAshlama.mutate({ checkUnitId: unit.id, text: azalAshlamaText.trim() });
                                  setReasonSelectorUnitId(null);
                                  setAzalAshlamaText('');
                                  setStockoutStepByUnitId((prev) => ({ ...prev, [unit.id]: undefined }));
                                }}
                                disabled={statusActionDisabled || !azalAshlamaText.trim() || createAshlama.isPending}
                                className="mt-2 w-full h-8 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50"
                              >
                                צור השלמה
                              </button>
                              <button
                                type="button"
                                onClick={() => setStockoutStepByUnitId((prev) => ({ ...prev, [unit.id]: 'choose-outcome' }))}
                                className="mt-2 w-full h-8 rounded-lg bg-white border border-gray-300 text-xs font-bold"
                              >
                                חזרה
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
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
                      )}
                    </div>
                  )}
                  {isProblemUnit && (
                    <div className="rounded-lg bg-red-50 px-2 py-2">
                      {unit.reason && <p className="text-xs text-red-800">סיבת תיקון: {unit.reason}</p>}
                      {unit.note && <p className="mt-1 text-xs text-red-800">הערה: {unit.note}</p>}
                      {unit.status === 'returned' && unitUiState.completionSubstate === 'none' && unitUiState.canCreateCompletion && (
                        <p className="mt-1 text-xs font-semibold text-blue-800">אפשר לפתוח השלמה</p>
                      )}
                    </div>
                  )}
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
          {canBulkApprove && (
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={updateCheckUnitStatus.isPending}
              className="w-full h-12 rounded-lg bg-green-600 text-white font-bold text-base disabled:opacity-50"
              data-testid="bulk-approve-units"
            >
              כל המשטחים תקינים
            </button>
          )}
          <button
            type="button"
            onClick={handleCreateCheckUnit}
            disabled={createDisabled}
            className={`w-full rounded-lg font-bold ${hasUnits ? 'h-10 bg-gray-100' : 'h-12 bg-blue-600 text-white text-base'} disabled:opacity-50`}
            data-testid="create-check-unit"
          >
            {batchCreateCount > 1 ? `הוסף ${batchCreateCount} משטחים` : 'הוסף משטח'}
          </button>
        </div>
      )}
      {isAshlamaDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" data-testid="ashlama-dialog">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 text-right shadow-lg">
            <h4 className="text-lg font-bold">יצירת השלמה</h4>
            <label className="mt-3 block text-sm font-medium">מה צריך להשלים?</label>
            <textarea
              value={ashlamaDraftText}
              onChange={(event) => setAshlamaDraftText(event.target.value)}
              className="mt-1 h-28 w-full rounded-lg border border-gray-300 p-2"
              placeholder="מה צריך להשלים?"
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
                        setIsAshlamaDialogOpen(false);
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
                  setIsAshlamaDialogOpen(false);
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
