import { Send, ArrowRight, Loader2, AlertTriangle, CheckCircle, CalendarPlus, RotateCcw } from 'lucide-react';
import type {
  SourceOrder,
  SourceOrderItem,
  DemandPlanningDraftUiMode,
  DemandPlanningPublishUiMode,
} from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';

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
  onNavigateToWork?: () => void;
  hasRemainingDemand?: boolean;
  isCreatingRemainingDraft?: boolean;
  onPlanRemaining?: () => void;
  canRevert?: boolean;
  revertBlockedReason?: string | null;
  isReverting?: boolean;
  onRevert?: () => void;
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
  onNavigateToWork,
  hasRemainingDemand = false,
  isCreatingRemainingDraft = false,
  onPlanRemaining,
  canRevert = false,
  revertBlockedReason = null,
  isReverting = false,
  onRevert,
}: PublishSummaryProps) {
  const planningLines = useSchemeBuilderStore((s) => s.planningLines);
  const workGroups = useSchemeBuilderStore((s) => s.workGroups);
  const itemAllocations = useSchemeBuilderStore((s) => s.itemAllocations);

  const loadedItemRows = Object.values(orderItemMap).reduce((acc, items) => acc + items.length, 0);
  const assignedRowIds = new Set(itemAllocations.map((a) => a.itemRowId));
  const assignedCount = assignedRowIds.size;
  const loadedUnassignedCount = loadedItemRows - assignedCount;
  const totalEstimatedRows = orders.reduce((acc, o) => acc + o.itemLinesCount, 0);
  const groupCount = workGroups.length;
  const planningLineCount = planningLines.length;
  const isPublishedDraft = draftUiMode === 'publishedDraft';

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
            <span>פתח עבודה</span>
            <ArrowRight size={14} />
          </button>
        )}

        {/* Revert publication — only when eligible */}
        {canRevert && onRevert && (
          <button
            type="button"
            onClick={onRevert}
            disabled={isReverting}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {isReverting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            <span>בטל פרסום וערוך</span>
          </button>
        )}

        {/* Blocked revert — activity exists */}
        {!canRevert && revertBlockedReason === 'has_activity' && (
          <div className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">
            לא ניתן לערוך תכנון שכבר התחילה בו עבודה
          </div>
        )}

        {/* Blocked revert — old publication without lineage */}
        {!canRevert && revertBlockedReason === 'old_no_lineage' && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            טיוטה ישנה ללא מידע פרסום מלא. לא ניתן לבטל פרסום אוטומטית.
          </div>
        )}

        {hasRemainingDemand && onPlanRemaining && (
          <button
            type="button"
            onClick={onPlanRemaining}
            disabled={isCreatingRemainingDraft}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {isCreatingRemainingDraft ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
            <span>שבץ יתרה לתאריך אחר</span>
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

      {publishUiMode === 'noTargetShift' && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          בחר משמרת יעד כדי לאפשר פרסום. append/diff נשאר במסלול נפרד.
        </div>
      )}

      {canPublish && onPublish && (
        <button
          type="button"
          onClick={onPublish}
          disabled={isPublishing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isPublishing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              מפרסם...
            </>
          ) : (
            <>
              <Send size={16} />
              פרסם למשמרת
            </>
          )}
        </button>
      )}

      {publishError && (
        <div className="text-xs text-red-600 bg-red-50 rounded p-2 flex items-start gap-1">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{publishError}</span>
        </div>
      )}
    </div>
  );
}
