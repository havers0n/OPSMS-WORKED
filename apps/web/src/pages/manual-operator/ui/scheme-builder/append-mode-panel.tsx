import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { workHierarchyQueryOptions } from '@/entities/manual-shift/api/queries';
import { demandImportAppendDiffQueryOptions, demandPlanningPreviewQueryOptions } from '@/entities/demand/api/queries';
import { adaptWorkHierarchyToSource } from './source-data-adapter';
import { useSchemeBuilderStore } from './scheme-store';
import { AreaOverview } from './area-overview';
import { WorkGroupWorkspace } from './work-group-workspace';
import { AppendDiffSummaryCard } from './append-diff-summary-card';
import type { SchemeBuilderCapabilities } from './scheme-types';

const APPEND_CAPABILITIES: SchemeBuilderCapabilities = {
  canCreatePlanningLines: false,
  canCreateWorkGroups: false,
  canAssignOrders: false,
  canMoveOrders: false,
  canSaveDraft: false,
  canPublishToShift: false,
  canWriteManualShift: false,
  canPrint: false,
};
import { AppendBacklogSection } from './append-backlog-section';
import type { DemandImportAppendClassification } from '@wos/domain';

interface AppendModePanelProps {
  shiftId: string;
  batchId: string;
}

const SUMMARY_CLASSIFICATIONS: DemandImportAppendClassification[] = [
  'new',
  'already_exists',
  'quantity_changed',
  'duplicate',
  'special_flow',
  'requires_review'
];

export function AppendModePanel({ shiftId, batchId }: AppendModePanelProps) {
  const {
    data: hierarchy,
    isLoading: hierarchyLoading,
    error: hierarchyError
  } = useQuery({
    ...workHierarchyQueryOptions(shiftId),
    enabled: !!shiftId
  });

  const {
    data: appendDiff,
    isLoading: appendDiffLoading,
    error: appendDiffError
  } = useQuery({
    ...demandImportAppendDiffQueryOptions(batchId, shiftId),
    enabled: !!batchId && !!shiftId
  });

  const {
    data: planningPreview,
    isLoading: previewLoading
  } = useQuery({
    ...demandPlanningPreviewQueryOptions(batchId),
    enabled: !!batchId
  });

  const shiftSource = useMemo(() => {
    if (!hierarchy) return null;
    return adaptWorkHierarchyToSource(hierarchy);
  }, [hierarchy]);

  const selectedAreaName = useSchemeBuilderStore((s) => s.selectedAreaName);
  const setSelectedArea = useSchemeBuilderStore((s) => s.setSelectedArea);

  const isLoading = hierarchyLoading || appendDiffLoading || previewLoading;
  const error = hierarchyError || appendDiffError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500" dir="rtl">
        <Loader2 size={24} className="animate-spin text-gray-400 ml-2" />
        טוען נתוני הוספה...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center" dir="rtl">
        <AlertCircle size={32} className="text-red-400 mb-3" />
        <p className="text-sm font-medium text-red-800">שגיאה בטעינת נתונים</p>
        <p className="text-xs text-red-600 mt-1">{error.message}</p>
      </div>
    );
  }

  if (!appendDiff) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500" dir="rtl">
        לא התקבלו נתוני הוספה
      </div>
    );
  }

  if (!shiftSource) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center" dir="rtl">
        <p className="text-sm font-medium text-gray-800">לא נמצאה משמרת</p>
        <p className="text-xs text-gray-600 mt-1">לא ניתן למצוא משמרת למזהה שצוין</p>
      </div>
    );
  }

  const batchInfo = planningPreview?.batch;

  return (
    <div className="flex-1 flex flex-col bg-gray-50" dir="rtl">
      <div className="shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm">
        <p className="font-bold text-blue-900">הוספת ביקוש גולמי לקווים קיימים</p>
        {batchInfo && (
          <p className="text-xs text-blue-700 mt-0.5">
            מקור: {batchInfo.sourceFile} ← {batchInfo.sourceSheet} | סטטוס: {batchInfo.status}
          </p>
        )}
      </div>

      <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-2">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SUMMARY_CLASSIFICATIONS.map((cls) => {
            const count = getCountForClassification(appendDiff, cls);
            return (
              <AppendDiffSummaryCard key={cls} classification={cls} count={count} />
            );
          })}
        </div>
      </div>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-64 shrink-0 border-e border-gray-200 bg-gray-50 p-2 overflow-y-auto">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm space-y-1">
            <p className="font-bold text-blue-800">קווים קיימים</p>
            <p className="text-xs text-blue-700">
              אזורים: {shiftSource.areas.length} | הזמנות: {shiftSource.orders.length}
            </p>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-3">
            {selectedAreaName ? (
              <WorkGroupWorkspace
                selectedAreaName={selectedAreaName}
                orderItemMap={{}}
                onStartAssign={() => {}}
                capabilities={APPEND_CAPABILITIES}
              />
            ) : (
              <div className="bg-white border border-dashed border-gray-300 rounded-lg p-6 text-center">
                <h2 className="text-sm font-bold text-gray-800 mb-1">בחר איזור הפצה</h2>
                <p className="text-xs text-gray-500">
                  בחר איזור הפצה מהרשימה כדי לראות את הקווים הקיימים
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-gray-200 bg-white p-3">
            <AreaOverview
              areas={shiftSource.areas}
              selectedAreaName={selectedAreaName}
              onSelectArea={setSelectedArea}
            />
          </div>
        </div>

        <aside className="w-80 shrink-0 border-s border-gray-200 bg-gray-50 p-2 overflow-y-auto">
          <div className="space-y-3">
            <AppendBacklogSection
              title="תוספות חדשות"
              classification="new"
              orders={appendDiff.newOrders}
              defaultExpanded={true}
            />
            <AppendBacklogSection
              title="כבר קיים"
              classification="already_exists"
              orders={appendDiff.alreadyExistsOrders}
            />
            <AppendBacklogSection
              title="כמות השתנתה"
              classification="quantity_changed"
              orders={appendDiff.quantityChangedOrders}
            />
            <AppendBacklogSection
              title="כפול"
              classification="duplicate"
              orders={appendDiff.duplicateOrders}
            />
            <AppendBacklogSection
              title="Special Flow"
              classification="special_flow"
              orders={appendDiff.specialFlowOrders}
            />
            <AppendBacklogSection
              title="דורש בדיקה"
              classification="requires_review"
              orders={appendDiff.requiresReviewOrders}
            />

            {appendDiff.newOrders.length === 0 &&
              appendDiff.alreadyExistsOrders.length === 0 &&
              appendDiff.quantityChangedOrders.length === 0 &&
              appendDiff.duplicateOrders.length === 0 &&
              appendDiff.specialFlowOrders.length === 0 &&
              appendDiff.requiresReviewOrders.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-500">
                אין שורות חדשות להוספה
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function getCountForClassification(
  appendDiff: { summary: { newRows: number; alreadyExistsRows: number; quantityChangedRows: number; duplicateRows: number; specialFlowRows: number; requiresReviewRows: number } },
  classification: DemandImportAppendClassification
): number {
  switch (classification) {
    case 'new':
      return appendDiff.summary.newRows;
    case 'already_exists':
      return appendDiff.summary.alreadyExistsRows;
    case 'quantity_changed':
      return appendDiff.summary.quantityChangedRows;
    case 'duplicate':
      return appendDiff.summary.duplicateRows;
    case 'special_flow':
      return appendDiff.summary.specialFlowRows;
    case 'requires_review':
      return appendDiff.summary.requiresReviewRows;
    default:
      return 0;
  }
}
