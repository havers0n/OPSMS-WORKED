import { Send, ArrowRight, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type {
  SourceOrder,
  SourceOrderItem,
  DemandPlanningDraftUiMode,
  DemandPlanningPublishUiMode,
  RollingPublishConflict,
} from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';
import { getVisiblePlanningLines, getVisibleWorkGroups } from './scheme-display-utils';
import { getPlanReadiness } from './scheme-readiness';

const CONFLICT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  stale: { label: 'לא עדכני', className: 'text-red-700 bg-red-50' },
  insufficient_quantity: { label: 'כמות לא מספיקה', className: 'text-red-700 bg-red-50' },
  duplicate_conflict: { label: 'כפילות בביקוש', className: 'text-amber-700 bg-amber-50' },
  available: { label: 'זמין', className: 'text-green-700 bg-green-50' },
};

interface PublishSummaryProps {
  orders: SourceOrder[];
  orderItemMap: Record<string, SourceOrderItem[]>;
  draftUiMode?: DemandPlanningDraftUiMode;
  publishUiMode?: DemandPlanningPublishUiMode;
  canPublish?: boolean;
  isPublishing?: boolean;
  onPublish?: () => void;
  publishResult?: { createdLines: number; createdOrders: number; createdItems: number; skippedRows: number; warnings: string[] } | null;
  publishError?: string | null;
  publishConflicts?: RollingPublishConflict[] | null;
  onNavigateToWork?: () => void;
  hasRemainingDemand?: boolean;
  isCreatingRemainingDraft?: boolean;
  onPlanRemaining?: () => void;
  canRevert?: boolean;
  revertBlockedReason?: string | null;
  isReverting?: boolean;
  onRevert?: () => void;
  intent?: 'plan-for-date' | 'append-current-shift';
}

export function PublishSummary({
  orders,
  orderItemMap,
  draftUiMode = 'planningDraft',
  publishUiMode = 'noTargetShift',
  canPublish = false,
  isPublishing = false,
  onPublish,
  publishResult,
  publishError,
  publishConflicts,
  onNavigateToWork,
  hasRemainingDemand: _hasRemainingDemand = false,
  isCreatingRemainingDraft: _isCreatingRemainingDraft = false,
  onPlanRemaining: _onPlanRemaining,
  canRevert: _canRevert = false,
  revertBlockedReason: _revertBlockedReason = null,
  isReverting: _isReverting = false,
  onRevert: _onRevert,
  intent,
}: PublishSummaryProps) {
  const planningLines = useSchemeBuilderStore((s) => s.planningLines);
  const workGroups = useSchemeBuilderStore((s) => s.workGroups);
  const itemAllocations = useSchemeBuilderStore((s) => s.itemAllocations);

  const readiness = getPlanReadiness({
    orders,
    orderItemMap,
    planningLines,
    workGroups,
    itemAllocations,
    publishUiMode,
  });

  const loadedItemRows = Object.values(orderItemMap).reduce((acc, items) => acc + items.length, 0);
  const assignedRowIds = new Set(itemAllocations.map((a) => a.itemRowId));
  const assignedCount = assignedRowIds.size;
  const loadedUnassignedCount = loadedItemRows - assignedCount;
  const totalEstimatedRows = orders.reduce((acc, o) => acc + o.itemLinesCount, 0);
  const groupCount = getVisibleWorkGroups(workGroups).length;
  const planningLineCount = getVisiblePlanningLines(planningLines).length;
  const isPlanForDate = intent === 'plan-for-date';
  const isAppendCurrentShift = intent === 'append-current-shift';
  const isPublishedDraft = draftUiMode === 'publishedDraft';

  const publishLabel = isAppendCurrentShift ? 'הוסף למשמרת' : 'פרסם לעבודה';
  const publishingLabel = 'מפרסם...';
  const successLabel = isPlanForDate ? 'עבור לעבודה' : 'חזרה לעבודה';

  if (publishResult || isPublishedDraft) {
    return (
      <div className="bg-white border border-green-200 rounded-lg p-4 space-y-3" dir="rtl">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-green-600" />
          <h3 className="text-sm font-bold text-green-800">פורסם למשמרת</h3>
        </div>

        {publishResult ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-green-50 rounded p-2 text-center">
              <div className="font-bold text-green-900 text-lg">{publishResult.createdLines}</div>
              <div className="text-xs text-green-700">קווים חדשים</div>
            </div>
            <div className="bg-green-50 rounded p-2 text-center">
              <div className="font-bold text-green-900 text-lg">{publishResult.createdOrders}</div>
              <div className="text-xs text-green-700">הזמנות חדשות</div>
            </div>
            <div className="bg-green-50 rounded p-2 text-center">
              <div className="font-bold text-green-900 text-lg">{publishResult.createdItems}</div>
              <div className="text-xs text-green-700">שורות פריטים</div>
            </div>
            <div className="bg-green-50 rounded p-2 text-center">
              <div className="font-bold text-green-900 text-lg">{publishResult.skippedRows}</div>
              <div className="text-xs text-green-700">שורות שדולגו</div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
            טיוטה זו כבר פורסמה למשמרת ונעולה לעריכה.
          </div>
        )}

        {publishResult && publishResult.warnings.length > 0 && (
          <div className="space-y-1">
            {publishResult.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1 text-xs text-amber-700 bg-amber-50 rounded p-1.5">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {onNavigateToWork && (
          <button
            type="button"
            onClick={onNavigateToWork}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <span>{successLabel}</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3" dir="rtl">
      <h3 className="text-sm font-bold text-gray-700">סיכום תכנון</h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-50 rounded p-2.5 text-center">
          <div className="font-bold text-gray-900 text-lg">{planningLineCount}</div>
          <div className="text-xs text-gray-500">קווי עבודה</div>
        </div>
        <div className="bg-gray-50 rounded p-2.5 text-center">
          <div className="font-bold text-gray-900 text-lg">{groupCount}</div>
          <div className="text-xs text-gray-500">קבוצות עבודה</div>
        </div>
        <div className="bg-gray-50 rounded p-2.5 text-center">
          <div className="font-bold text-gray-900 text-lg">{orders.length}</div>
          <div className="text-xs text-gray-500">הזמנות</div>
        </div>
        <div className="bg-gray-50 rounded p-2.5 text-center">
          <div className="font-bold text-gray-900 text-lg">{assignedCount}</div>
          <div className="text-xs text-gray-500">שורות משויכות</div>
        </div>
        <div className="bg-gray-50 rounded p-2.5 text-center">
          <div className={`font-bold text-lg ${loadedUnassignedCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>{loadedUnassignedCount}</div>
          <div className="text-xs text-gray-500">שורות שנטענו ולא שויכו</div>
        </div>
        <div className="bg-gray-50 rounded p-2.5 text-center">
          <div className="font-bold text-lg text-gray-900">{totalEstimatedRows}</div>
          <div className="text-xs text-gray-500">סה"כ שורות משוער</div>
        </div>
      </div>

      {readiness.status === 'empty' && (
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          אין הזמנות לתכנון
        </div>
      )}

      {readiness.status === 'blocked' && (
        <div className="space-y-1">
          <div className="rounded-lg px-3 py-2 text-xs font-bold bg-red-50 text-red-800">
            התוכנית חסומה לפרסום
          </div>
          {readiness.blockers.map((b, i) => (
            <div key={i} className="flex items-start gap-1 text-xs text-red-700 bg-red-50 rounded p-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}

      {readiness.status === 'partial' && (
        <div className="space-y-1">
          <div className="rounded-lg px-3 py-2 text-xs font-bold bg-amber-50 text-amber-800">
            ניתן לפרסם חלקית
          </div>
          {readiness.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1 text-xs text-amber-700 bg-amber-50 rounded p-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {readiness.status === 'ready' && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800 flex items-center gap-1">
          <CheckCircle size={12} />
          <span>כל השורות שויכו — ניתן לפרסם למשמרת</span>
        </div>
      )}

      {publishUiMode === 'noTargetShift' && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          בחר משמרת יעד כדי לאפשר פרסום. append/diff נשאר במסלול נפרד.
        </div>
      )}

      {canPublish && onPublish && (
        <button
          type="button"
          onClick={onPublish}
          disabled={isPublishing || !readiness.canPublish}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isPublishing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {publishingLabel}
            </>
          ) : (
            <>
              <Send size={16} />
              {publishLabel}
            </>
          )}
        </button>
      )}

      {publishError && (
        <div className="space-y-2">
          <div className="text-xs text-red-600 bg-red-50 rounded p-2 flex items-start gap-1">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>{publishError}</span>
          </div>

          {publishConflicts && publishConflicts.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 overflow-hidden">
              <div className="bg-red-100 px-2 py-1.5 border-b border-red-200">
                <p className="text-xs font-bold text-red-900">
                  <XCircle size={12} className="inline ml-1" />
                  {publishConflicts.length} שורות לא ניתן לפרסם בגלל שינוי בביקוש הזמין
                </p>
                <p className="text-[10px] text-red-700 mt-0.5">
                  חלק מהשורות כבר אינן זמינות לפרסום. יש לרענן את הטיוטה או לשנות את השיוך.
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-red-200">
                {publishConflicts.map((conflict, i) => {
                  const statusConfig = CONFLICT_STATUS_CONFIG[conflict.status] ?? { label: conflict.status, className: 'text-gray-700 bg-gray-50' };
                  return (
                    <div key={conflict.allocationId ?? i} className="px-2 py-1.5 text-[11px] space-y-0.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-mono text-gray-500 truncate max-w-[80px]" title={conflict.sku ?? ''}>{conflict.sku ?? '—'}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-700 truncate max-w-[80px]" title={conflict.orderNumber ?? ''}>{conflict.orderNumber ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-600">
                        <span>בטיוטה: {conflict.requestedQuantity}</span>
                        <span>זמין: {conflict.availableQuantity}</span>
                        <span className={`inline-flex items-center rounded px-1 py-0.5 font-medium ${statusConfig.className}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      {conflict.reason && (
                        <p className="text-[10px] text-gray-500 truncate" title={conflict.reason}>{conflict.reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
