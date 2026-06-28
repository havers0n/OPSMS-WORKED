import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ManualShiftLineSummary, ManualShiftSession, ManualShiftWorkHierarchyResponse } from '@wos/domain';
import {
  bucketProductRollupQueryOptions,
  daySummaryQueryOptions,
  monthlyReplaceSafetyQueryOptions,
  shiftOrdersQueryOptions,
  workHierarchyQueryOptions
} from '@/entities/manual-shift/api/queries';
import {
  NO_DISTRIBUTION_AREA_KEY,
  selectLineDistributionGroupSummaries,
  selectLineSummaries,
  selectOrderDetail,
  selectDistributionGroupWorkGroupSummaries,
  selectShiftSummary,
  selectWorkHierarchyAreaSummaries,
  selectWorkHierarchyLineSummaries,
  selectWorkHierarchyLineSummariesByArea,
  selectWorkHierarchyBucketSummaries
} from '@/entities/manual-shift/model/shift-selectors';
import type { RouteGroupWorkBucketSummary } from '@/entities/manual-shift/model/shift-selectors';
import type { ManualOperatorSection } from '@/shared/config/routes';
import { DesktopOperatorShell } from './desktop/desktop-operator-shell';
import { DesktopKpiRow } from './desktop/desktop-kpi-row';
import { ManualOperatorShell } from './manual-operator-shell';
import { ManualWorkAreaFilters } from './manual-work-area-filters';
import { ShiftEmptyState } from './shift-empty-state';
import { LineList } from './line-list';
import { LineDetail } from './line-detail';
import { AddLineSheet } from './add-line-sheet';
import { ImportExcelSheet } from './import-excel-sheet';
import { MonthlyImportPreviewSheet } from './monthly-import-preview-sheet';
import { BondedImportSheet } from './bonded-import-sheet';

const CHITA_LABEL = "צ'יטה";

function normalizeUiLabel(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function isChitaSpecialArea(area: ManualShiftWorkHierarchyResponse['areas'][number]): boolean {
  if (normalizeUiLabel(area.areaName) === CHITA_LABEL || normalizeUiLabel(area.displayName) === CHITA_LABEL) {
    return true;
  }

  return area.lines.some((line) => {
    if (line.lineKind !== 'delivery_channel') return false;
    return normalizeUiLabel(line.lineGroupName) === CHITA_LABEL;
  });
}

interface ManualOperatorWorkSectionProps {
  shift: ManualShiftSession | null;
  lines: ManualShiftLineSummary[];
  isLoading: boolean;
  isReadOnly: boolean;
  isToday: boolean;
  canMonthlyImport: boolean;
  hasExistingWork: boolean;
  isDesktop: boolean;
  selectedDate: string;
  todayDate: string;
  onChangeDate: (date: string) => void;
  onOpenDatePicker: () => void;
  onCreateShift: () => void;
  isCreatingShift: boolean;
  onChangeSection: (section: ManualOperatorSection) => void;
}

function MobileLoadingState() {
  return (
    <div className="flex items-center justify-center py-20" dir="rtl">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  );
}

export function ManualOperatorWorkSection({
  shift,
  lines,
  isLoading,
  isReadOnly,
  isToday,
  canMonthlyImport,
  hasExistingWork,
  isDesktop,
  selectedDate,
  todayDate,
  onChangeDate,
  onOpenDatePicker,
  onCreateShift,
  isCreatingShift,
  onChangeSection
}: ManualOperatorWorkSectionProps) {
  const navigate = useNavigate();
  const [selectedLine, setSelectedLine] = useState<ManualShiftLineSummary | null>(null);
  const [showAddLine, setShowAddLine] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showMonthlyPreview, setShowMonthlyPreview] = useState(false);
  const [showBondedImport, setShowBondedImport] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedAreaLineKey, setSelectedAreaLineKey] = useState<string | null>(null);
  const [selectedWorkGroupKey, setSelectedWorkGroupKey] = useState<string | null>(null);
  const [selectedWorkBucketName, setSelectedWorkBucketName] = useState<string | null>(null);
  const [selectedAreaKey, setSelectedAreaKey] = useState<string | null>(null);
  const [selectedDistributionGroupKey, setSelectedDistributionGroupKey] = useState<string | null>(null);
  const [workBucketView, setWorkBucketView] = useState<'products' | 'orders'>('products');

  const { data: daySummary, isLoading: isDaySummaryLoading } = useQuery({
    ...daySummaryQueryOptions(shift?.id ?? ''),
    enabled: !!shift?.id && isDesktop
  });
  const { data: shiftOrders = [] } = useQuery({
    ...shiftOrdersQueryOptions(shift?.id ?? ''),
    enabled: !!shift?.id && isDesktop
  });
  const { data: workHierarchy } = useQuery({
    ...workHierarchyQueryOptions(shift?.id ?? ''),
    enabled: !!shift?.id && isDesktop
  });

  const selectedArea = useMemo(
    () => workHierarchy?.areas.find((area) => (area.areaName === null ? NO_DISTRIBUTION_AREA_KEY : area.areaName) === selectedAreaKey),
    [selectedAreaKey, workHierarchy]
  );

  const selectedHierarchyLine = useMemo(
    () => selectedArea?.lines.find((line) => (line.areaLineKey ?? line.lineId) === selectedAreaLineKey),
    [selectedArea, selectedAreaLineKey]
  );

  const selectedLineId = selectedHierarchyLine?.lineId ?? null;

  const hasDistributionGroups = !!(selectedHierarchyLine?.routeGroups && selectedHierarchyLine.routeGroups.length > 0);

  const distributionGroupSummaries = useMemo(
    () => hasDistributionGroups && selectedAreaLineKey
      ? selectLineDistributionGroupSummaries(workHierarchy, selectedAreaKey, selectedAreaLineKey)
      : [],
    [hasDistributionGroups, selectedAreaKey, selectedAreaLineKey, workHierarchy]
  );

  const distributionGroupWorkGroupSummaries = useMemo(
    () => hasDistributionGroups && selectedAreaLineKey && selectedDistributionGroupKey
      ? selectDistributionGroupWorkGroupSummaries(workHierarchy, selectedAreaKey, selectedAreaLineKey, selectedDistributionGroupKey)
      : [],
    [hasDistributionGroups, selectedAreaKey, selectedAreaLineKey, selectedDistributionGroupKey, workHierarchy]
  );

  const selectedDistributionGroupWorkGroup: RouteGroupWorkBucketSummary | undefined = useMemo(
    () => {
      if (!hasDistributionGroups || !selectedDistributionGroupKey || !selectedWorkGroupKey) return undefined;
      return distributionGroupWorkGroupSummaries.find((w) => w.workBucketKey === selectedWorkGroupKey);
    },
    [hasDistributionGroups, distributionGroupWorkGroupSummaries, selectedDistributionGroupKey, selectedWorkGroupKey]
  );

  const workGroupSummaries = useMemo(
    () => !hasDistributionGroups && selectedAreaLineKey
      ? selectWorkHierarchyBucketSummaries(workHierarchy, selectedAreaKey, selectedAreaLineKey)
      : [],
    [hasDistributionGroups, selectedAreaKey, selectedAreaLineKey, workHierarchy]
  );

  const selectedSourceZone: string | undefined = useMemo(() => {
    if (!selectedHierarchyLine) return undefined;
    if (selectedHierarchyLine.lineKind === 'delivery_channel' && selectedWorkBucketName) {
      const selectedBucket = selectedHierarchyLine.buckets.find(
        (bucket) => bucket.displayName === selectedWorkBucketName || bucket.bucketName === selectedWorkBucketName
      );
      const bucketSourceZone = selectedBucket?.orders[0]?.sourceZone ?? selectedBucket?.bucketName ?? null;
      return bucketSourceZone ?? '';
    }

    return selectedHierarchyLine.sourceZone ?? '';
  }, [selectedHierarchyLine, selectedWorkBucketName]);

  const selectedProductRollupScope = useMemo(() => {
    if (!selectedHierarchyLine) return null;

    if (hasDistributionGroups && selectedDistributionGroupKey && selectedDistributionGroupWorkGroup) {
      return {
        bucketName: selectedDistributionGroupWorkGroup.workBucketDisplayName,
        distributionArea: selectedHierarchyLine.distributionArea ?? undefined,
        workBucketName: selectedDistributionGroupWorkGroup.workBucketName ?? undefined,
        sourceLineName: selectedHierarchyLine.lineGroupName,
        sourceZone: selectedSourceZone
      };
    }

    if (!selectedWorkBucketName) return null;

    const bucket = selectedHierarchyLine.buckets.find((entry) => entry.displayName === selectedWorkBucketName);
    return {
      bucketName: bucket?.displayName ?? selectedWorkBucketName,
      distributionArea: selectedHierarchyLine.distributionArea ?? undefined,
      workBucketName: bucket?.bucketName ?? undefined,
      sourceLineName: selectedHierarchyLine.lineGroupName,
      sourceZone: selectedSourceZone
    };
  }, [
    hasDistributionGroups,
    selectedHierarchyLine,
    selectedDistributionGroupKey,
    selectedDistributionGroupWorkGroup,
    selectedSourceZone,
    selectedWorkBucketName
  ]);

  const showProductRollupDeferred = false;

  const { data: productRollup, isLoading: isProductRollupLoading } = useQuery({
    ...bucketProductRollupQueryOptions(
      shift?.id ?? '',
      selectedLineId ?? '',
      selectedProductRollupScope?.bucketName ?? '',
      selectedProductRollupScope?.distributionArea,
      selectedProductRollupScope?.sourceZone,
      selectedProductRollupScope?.workBucketName,
      selectedProductRollupScope?.sourceLineName
    ),
    enabled: !!shift?.id && !!selectedLineId && !!selectedProductRollupScope && workBucketView === 'products'
  });

  const canFetchReplaceSafety = canMonthlyImport && hasExistingWork && !!shift?.id;
  const { data: replaceSafety } = useQuery({
    ...monthlyReplaceSafetyQueryOptions(shift?.id ?? ''),
    enabled: canFetchReplaceSafety
  });

  const byLine = daySummary?.byLine ?? lines;
  const kpi = useMemo(
    () => (daySummary ? selectShiftSummary(daySummary, shiftOrders) : undefined),
    [daySummary, shiftOrders]
  );
  const lineSummaries = useMemo(
    () => selectLineSummaries(byLine, shiftOrders),
    [byLine, shiftOrders]
  );
  const orderDetail = useMemo(() => {
    if (!selectedOrderId) return null;
    return selectOrderDetail(selectedOrderId, shiftOrders, lineSummaries);
  }, [selectedOrderId, shiftOrders, lineSummaries]);
  const lineHierarchySummaries = useMemo(
    () => selectWorkHierarchyLineSummaries(workHierarchy),
    [workHierarchy]
  );
  const areaSummaries = useMemo(
    () => selectWorkHierarchyAreaSummaries(workHierarchy),
    [workHierarchy]
  );
  const specialAreaSummaryKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const area of workHierarchy?.areas ?? []) {
      if (isChitaSpecialArea(area)) {
        keys.add(area.areaName === null ? NO_DISTRIBUTION_AREA_KEY : area.areaName);
      }
    }

    for (const area of areaSummaries) {
      if (normalizeUiLabel(area.areaName) === CHITA_LABEL || normalizeUiLabel(area.displayName) === CHITA_LABEL) {
        keys.add(area.areaKey);
      }
    }

    return keys;
  }, [areaSummaries, workHierarchy]);
  const specialAreaSummaries = useMemo(
    () => areaSummaries.filter((area) => specialAreaSummaryKeys.has(area.areaKey)),
    [areaSummaries, specialAreaSummaryKeys]
  );
  const areaLineSummaries = useMemo(
    () => selectWorkHierarchyLineSummariesByArea(workHierarchy, selectedAreaKey),
    [workHierarchy, selectedAreaKey]
  );
  function handleSelectArea(areaKey: string | null) {
    setSelectedAreaKey(areaKey);
    setSelectedDistributionGroupKey(null);
    setSelectedWorkGroupKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);

    if (areaKey !== null) {
      const areaLines = selectWorkHierarchyLineSummariesByArea(workHierarchy, areaKey);
      if (areaLines.length === 1) {
        setSelectedAreaLineKey(areaLines[0].areaLineKey ?? areaLines[0].lineId);
      } else {
        setSelectedAreaLineKey(null);
      }
    } else {
      setSelectedAreaLineKey(null);
    }
  }

  function handleSelectHierarchyLine(areaLineKey: string) {
    setSelectedAreaLineKey(areaLineKey);
    setSelectedDistributionGroupKey(null);
    setSelectedWorkGroupKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  function handleSelectHierarchyDistributionGroup(distributionGroupKey: string) {
    setSelectedDistributionGroupKey(distributionGroupKey);
    setSelectedWorkGroupKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  function handleSelectHierarchyBucket(workBucketIdentifier: string) {
    if (hasDistributionGroups && selectedDistributionGroupKey) {
      const bucket = distributionGroupWorkGroupSummaries.find((wb) => wb.workBucketKey === workBucketIdentifier);
      setSelectedWorkGroupKey(bucket?.workBucketKey ?? workBucketIdentifier);
      setSelectedWorkBucketName(bucket?.workBucketDisplayName ?? workBucketIdentifier);
    } else {
      setSelectedWorkGroupKey(null);
      setSelectedWorkBucketName(workBucketIdentifier);
    }
    setSelectedOrderId(null);
    setWorkBucketView('products');
  }

  function handleClearArea() {
    setSelectedAreaKey(null);
    setSelectedAreaLineKey(null);
    setSelectedDistributionGroupKey(null);
    setSelectedWorkGroupKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  function handleClearHierarchyLine() {
    setSelectedAreaLineKey(null);
    setSelectedDistributionGroupKey(null);
    setSelectedWorkGroupKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  function handleClearHierarchyDistributionGroup() {
    setSelectedDistributionGroupKey(null);
    setSelectedWorkGroupKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  function handleClearHierarchyBucket() {
    setSelectedWorkGroupKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  useEffect(() => {
    setSelectedOrderId(null);
  }, [shift?.id, selectedAreaKey, selectedAreaLineKey, selectedDistributionGroupKey, selectedWorkGroupKey]);

  if (isDesktop) {
    return (
      <>
        <ManualOperatorShell
          activeSection="work"
          onChangeSection={onChangeSection}
          shift={shift}
          selectedDate={selectedDate}
          todayDate={todayDate}
          onOpenDatePicker={onOpenDatePicker}
          onChangeDate={onChangeDate}
          isDesktop
          headerActions={
            shift && shift.status === 'active' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBondedImport(true)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  aria-label="טעינת קובץ בונדד"
                >
                  בונדד
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/operator/manual/lines?mode=demand&intent=append-current-shift&targetShiftId=${shift.id}`)}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  aria-label="הוסף הזמנות למשמרת"
                >
                  <Plus size={14} className="inline -ms-0.5 me-0.5" />
                  הוסף הזמנות למשמרת
                </button>
              </div>
            ) : undefined
          }
          contextualRow={
            <ManualWorkAreaFilters
              areas={areaSummaries}
              selectedAreaKey={selectedAreaKey}
              onSelectArea={handleSelectArea}
            />
          }
          headerMeta={
            kpi ? (
              <DesktopKpiRow summary={kpi} />
            ) : (
              <div className="flex gap-2 animate-pulse">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-10 w-12 rounded-lg bg-gray-200" />
                ))}
              </div>
            )
          }
          contentClassName="overflow-hidden"
        >
          <DesktopOperatorShell
            shift={shift}
            isLoading={isLoading || (!!shift && isDaySummaryLoading)}
            kpi={kpi}
            orderDetail={orderDetail}
            selectedDetailType={selectedOrderId ? 'order' : null}
            selectedAreaKey={selectedAreaKey}
            selectedAreaLineKey={selectedAreaLineKey}
            selectedDistributionGroupKey={selectedDistributionGroupKey}
            selectedWorkGroupKey={selectedWorkGroupKey}
            selectedDistributionGroupWorkGroup={selectedDistributionGroupWorkGroup}
            selectedWorkBucketName={selectedWorkBucketName}
            areaSummaries={areaSummaries}
            specialAreaSummaries={specialAreaSummaries}
            lineHierarchySummaries={lineHierarchySummaries}
            areaLineSummaries={areaLineSummaries}
            workGroupSummaries={workGroupSummaries}
            distributionGroupSummaries={distributionGroupSummaries}
            distributionGroupWorkGroupSummaries={distributionGroupWorkGroupSummaries}
            hasDistributionGroups={hasDistributionGroups}
            showProductRollupDeferred={showProductRollupDeferred}
            onSelectOrder={(orderId) => setSelectedOrderId(orderId)}
            onCloseDetail={() => setSelectedOrderId(null)}
            onSelectArea={handleSelectArea}
            onSelectHierarchyLine={handleSelectHierarchyLine}
            onSelectHierarchyDistributionGroup={handleSelectHierarchyDistributionGroup}
            onSelectHierarchyBucket={handleSelectHierarchyBucket}
            onClearArea={handleClearArea}
            onClearHierarchyLine={handleClearHierarchyLine}
            onClearHierarchyDistributionGroup={handleClearHierarchyDistributionGroup}
            onClearHierarchyBucket={handleClearHierarchyBucket}
            workBucketView={workBucketView}
            productRollup={productRollup?.products}
            productRollupLoading={isProductRollupLoading}
            onSetWorkBucketView={setWorkBucketView}
            onCreateShift={onCreateShift}
            isCreatingShift={isCreatingShift}
          />
        </ManualOperatorShell>
        {showBondedImport && (
          <BondedImportSheet
            shiftId={shift?.id ?? null}
            selectedDate={selectedDate}
            onClose={() => setShowBondedImport(false)}
          />
        )}
      </>
    );
  }

  const fab =
    !isReadOnly && shift && !selectedLine && lines.length > 0
      ? { ariaLabel: 'Add line', onClick: () => setShowAddLine(true) }
      : undefined;

  return (
    <ManualOperatorShell
      activeSection="work"
      onChangeSection={onChangeSection}
      shift={shift}
      fab={fab}
      selectedDate={selectedDate}
      todayDate={todayDate}
      onOpenDatePicker={onOpenDatePicker}
      isDesktop={false}
    >
      {isLoading ? (
        <MobileLoadingState />
      ) : !shift ? (
        <ShiftEmptyState onCreateShift={onCreateShift} isCreating={isCreatingShift} isToday={isToday} />
      ) : (
        <>
          {importSuccessMessage && (
            <div className="mx-4 mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {importSuccessMessage}
            </div>
          )}
          <LineList
            lines={lines}
            onSelectLine={setSelectedLine}
            canImport={canMonthlyImport && !hasExistingWork}
            canPreviewMonthly={canMonthlyImport}
            canAddManual={!isReadOnly}
            canReImportMonthly={canMonthlyImport && hasExistingWork}
            replaceSafety={replaceSafety ?? null}
            showNoShiftHint={!shift}
            onImportExcel={() => setShowImportExcel(true)}
            onPreviewMonthly={() => setShowMonthlyPreview(true)}
            onAddLineManually={() => setShowAddLine(true)}
          />
          {selectedLine && <LineDetail summary={selectedLine} onBack={() => setSelectedLine(null)} />}
        </>
      )}

      {showAddLine && shift && !isReadOnly && (
        <AddLineSheet shiftId={shift.id} onClose={() => setShowAddLine(false)} />
      )}
          {shift && shift.status === 'active' && (
            <div className="mx-4 space-y-3">
              <button
                type="button"
                onClick={() => navigate(`/operator/manual/lines?mode=demand&intent=append-current-shift&targetShiftId=${shift.id}`)}
                className="w-full border border-blue-200 bg-blue-50 text-blue-700 font-medium py-3 rounded-xl text-sm"
              >
                <Plus size={16} className="inline -ms-0.5 me-0.5" />
                הוסף הזמנות למשמרת
              </button>
            </div>
          )}
          {shift && (
            <div className="mx-4 mt-3">
              <button
                type="button"
                onClick={() => setShowBondedImport(true)}
                className="w-full border border-gray-300 text-gray-800 font-medium py-3 rounded-xl text-sm"
              >
                טעינת קובץ בונדד
              </button>
            </div>
          )}
          {showImportExcel && shift && canMonthlyImport && !hasExistingWork && (
        <ImportExcelSheet
          shiftId={shift.id}
          selectedDate={selectedDate}
          onClose={() => setShowImportExcel(false)}
          onSuccess={({ linesCreated, ordersCreated }) => {
            setShowImportExcel(false);
            setImportSuccessMessage(`יובאו: ${linesCreated} קווים, ${ordersCreated} הזמנות`);
          }}
        />
      )}
      {showBondedImport && (
        <BondedImportSheet
          shiftId={shift?.id ?? null}
          selectedDate={selectedDate}
          onClose={() => setShowBondedImport(false)}
        />
      )}
      {showMonthlyPreview && shift && canMonthlyImport && (
        <MonthlyImportPreviewSheet
          shiftId={shift.id}
          selectedDate={selectedDate}
          hasExistingWork={hasExistingWork}
          replaceSafety={replaceSafety ?? null}
          onClose={() => setShowMonthlyPreview(false)}
          onSuccess={({ linesCreated, ordersCreated, orderItemsCreated }) => {
            setImportSuccessMessage(
              `ייבוא חודשי הושלם: ${linesCreated} קווים, ${ordersCreated} הזמנות, ${orderItemsCreated} פריטים`
            );
          }}
        />
      )}
    </ManualOperatorShell>
  );
}
