import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ManualShiftLineSummary, ManualShiftSession } from '@wos/domain';
import {
  bucketProductRollupQueryOptions,
  daySummaryQueryOptions,
  monthlyReplaceSafetyQueryOptions,
  shiftOrdersQueryOptions,
  workHierarchyQueryOptions
} from '@/entities/manual-shift/api/queries';
import {
  selectLineRouteGroupSummaries,
  selectLineSummaries,
  selectOrderDetail,
  selectRouteGroupWorkBucketSummaries,
  selectShiftSummary,
  selectWorkHierarchyAreaSummaries,
  selectWorkHierarchyLineSummaries,
  selectWorkHierarchyLineSummariesByArea,
  selectWorkHierarchyBucketSummaries
} from '@/entities/manual-shift/model/shift-selectors';
import type { RouteGroupWorkBucketSummary } from '@/entities/manual-shift/model/shift-selectors';
import type { ManualOperatorSection } from '@/shared/config/routes';
import { DesktopOperatorShell } from './desktop/desktop-operator-shell';
import { MobileOperatorShell } from './mobile-operator-shell';
import { ShiftEmptyState } from './shift-empty-state';
import { LineList } from './line-list';
import { LineDetail } from './line-detail';
import { AddLineSheet } from './add-line-sheet';
import { ImportExcelSheet } from './import-excel-sheet';
import { MonthlyImportPreviewSheet } from './monthly-import-preview-sheet';

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
  const [selectedLine, setSelectedLine] = useState<ManualShiftLineSummary | null>(null);
  const [showAddLine, setShowAddLine] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showMonthlyPreview, setShowMonthlyPreview] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedWorkBucketKey, setSelectedWorkBucketKey] = useState<string | null>(null);
  const [selectedWorkBucketName, setSelectedWorkBucketName] = useState<string | null>(null);
  const [selectedAreaKey, setSelectedAreaKey] = useState<string | null>(null);
  const [selectedRouteGroupKey, setSelectedRouteGroupKey] = useState<string | null>(null);
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

  const selectedHierarchyLine = workHierarchy?.areas
    .flatMap(a => a.lines)
    .find(l => l.lineId === selectedLineId);

  const hasRouteGroups = !!(selectedHierarchyLine?.routeGroups && selectedHierarchyLine.routeGroups.length > 0);

  const routeGroupSummaries = useMemo(
    () => hasRouteGroups && selectedLineId
      ? selectLineRouteGroupSummaries(workHierarchy, selectedLineId)
      : [],
    [hasRouteGroups, selectedLineId, workHierarchy]
  );

  const routeGroupWorkBucketSummaries = useMemo(
    () => hasRouteGroups && selectedLineId && selectedRouteGroupKey
      ? selectRouteGroupWorkBucketSummaries(workHierarchy, selectedLineId, selectedRouteGroupKey)
      : [],
    [hasRouteGroups, selectedLineId, selectedRouteGroupKey, workHierarchy]
  );

  const selectedRouteGroupWorkBucket: RouteGroupWorkBucketSummary | undefined = useMemo(
    () => {
      if (!hasRouteGroups || !selectedRouteGroupKey || !selectedWorkBucketKey) return undefined;
      return routeGroupWorkBucketSummaries.find((w) => w.workBucketKey === selectedWorkBucketKey);
    },
    [hasRouteGroups, routeGroupWorkBucketSummaries, selectedRouteGroupKey, selectedWorkBucketKey]
  );

  const workBucketSummaries = useMemo(
    () => !hasRouteGroups && selectedLineId
      ? selectWorkHierarchyBucketSummaries(workHierarchy, selectedLineId)
      : [],
    [hasRouteGroups, selectedLineId, workHierarchy]
  );

  const selectedWorkBucketRawName: string = useMemo(() => {
    if (!selectedLineId || !workHierarchy) return '';

    if (hasRouteGroups && selectedRouteGroupKey) {
      const wb = selectedRouteGroupWorkBucket;
      if (!wb || wb.orders.length === 0) return '';
      const uniquePointNames = [...new Set(wb.orders.map((o) => o.pointName).filter(Boolean))];
      if (uniquePointNames.length === 1) return uniquePointNames[0]!;
      return '';
    }

    if (!selectedWorkBucketName) return '';

    for (const area of workHierarchy.areas) {
      const line = area.lines.find((l) => l.lineId === selectedLineId);
      if (!line) continue;
      const bucket = line.buckets.find((b) => b.displayName === selectedWorkBucketName);
      if (!bucket) continue;
      return bucket.bucketName ?? '';
    }
    return '';
  }, [selectedLineId, selectedWorkBucketName, selectedWorkBucketKey, workHierarchy, hasRouteGroups, selectedRouteGroupKey, selectedRouteGroupWorkBucket]);

  const showProductRollupDeferred = !!(hasRouteGroups && selectedRouteGroupKey && !selectedWorkBucketRawName);

  const { data: productRollup, isLoading: isProductRollupLoading } = useQuery({
    ...bucketProductRollupQueryOptions(shift?.id ?? '', selectedLineId ?? '', selectedWorkBucketRawName),
    enabled: !!shift?.id && !!selectedLineId && selectedWorkBucketRawName !== '' && workBucketView === 'products'
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
  const areaLineSummaries = useMemo(
    () => selectWorkHierarchyLineSummariesByArea(workHierarchy, selectedAreaKey),
    [workHierarchy, selectedAreaKey]
  );
  function handleSelectArea(areaKey: string | null) {
    setSelectedAreaKey(areaKey);
    setSelectedRouteGroupKey(null);
    setSelectedWorkBucketKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);

    if (areaKey !== null) {
      const areaLines = selectWorkHierarchyLineSummariesByArea(workHierarchy, areaKey);
      if (areaLines.length === 1) {
        setSelectedLineId(areaLines[0].lineId);
      } else {
        setSelectedLineId(null);
      }
    } else {
      setSelectedLineId(null);
    }
  }

  function handleSelectHierarchyLine(lineId: string) {
    setSelectedLineId(lineId);
    setSelectedRouteGroupKey(null);
    setSelectedWorkBucketKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  function handleSelectHierarchyRouteGroup(routeGroupKey: string) {
    setSelectedRouteGroupKey(routeGroupKey);
    setSelectedWorkBucketKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  function handleSelectHierarchyBucket(workBucketIdentifier: string) {
    if (hasRouteGroups && selectedRouteGroupKey) {
      const bucket = routeGroupWorkBucketSummaries.find((wb) => wb.workBucketKey === workBucketIdentifier);
      setSelectedWorkBucketKey(bucket?.workBucketKey ?? workBucketIdentifier);
      setSelectedWorkBucketName(bucket?.workBucketDisplayName ?? workBucketIdentifier);
    } else {
      setSelectedWorkBucketKey(null);
      setSelectedWorkBucketName(workBucketIdentifier);
    }
    setSelectedOrderId(null);
    setWorkBucketView('products');
  }

  function handleClearArea() {
    setSelectedAreaKey(null);
    setSelectedLineId(null);
    setSelectedRouteGroupKey(null);
    setSelectedWorkBucketKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  function handleClearHierarchyLine() {
    setSelectedLineId(null);
    setSelectedRouteGroupKey(null);
    setSelectedWorkBucketKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  function handleClearHierarchyRouteGroup() {
    setSelectedRouteGroupKey(null);
    setSelectedWorkBucketKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  function handleClearHierarchyBucket() {
    setSelectedWorkBucketKey(null);
    setSelectedWorkBucketName(null);
    setSelectedOrderId(null);
  }

  useEffect(() => {
    setSelectedOrderId(null);
  }, [shift?.id, selectedAreaKey, selectedLineId, selectedRouteGroupKey, selectedWorkBucketKey]);

  if (isDesktop) {
    return (
      <DesktopOperatorShell
        shift={shift}
        isLoading={isLoading || (!!shift && isDaySummaryLoading)}
        kpi={kpi}
        orderDetail={orderDetail}
        selectedDetailType={selectedOrderId ? 'order' : null}
        selectedAreaKey={selectedAreaKey}
        selectedLineId={selectedLineId}
        selectedRouteGroupKey={selectedRouteGroupKey}
        selectedWorkBucketKey={selectedWorkBucketKey}
        selectedRouteGroupWorkBucket={selectedRouteGroupWorkBucket}
        selectedWorkBucketName={selectedWorkBucketName}
        areaSummaries={areaSummaries}
        lineHierarchySummaries={lineHierarchySummaries}
        areaLineSummaries={areaLineSummaries}
        workBucketSummaries={workBucketSummaries}
        routeGroupSummaries={routeGroupSummaries}
        routeGroupWorkBucketSummaries={routeGroupWorkBucketSummaries}
        hasRouteGroups={hasRouteGroups}
        showProductRollupDeferred={showProductRollupDeferred}
        onSelectOrder={(orderId) => setSelectedOrderId(orderId)}
        onCloseDetail={() => setSelectedOrderId(null)}
        onSelectArea={handleSelectArea}
        onSelectHierarchyLine={handleSelectHierarchyLine}
        onSelectHierarchyRouteGroup={handleSelectHierarchyRouteGroup}
        onSelectHierarchyBucket={handleSelectHierarchyBucket}
        onClearArea={handleClearArea}
        onClearHierarchyLine={handleClearHierarchyLine}
        onClearHierarchyRouteGroup={handleClearHierarchyRouteGroup}
        onClearHierarchyBucket={handleClearHierarchyBucket}
        workBucketView={workBucketView}
        productRollup={productRollup?.products}
        productRollupLoading={isProductRollupLoading}
        onSetWorkBucketView={setWorkBucketView}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onChangeDate={onChangeDate}
        onOpenDatePicker={onOpenDatePicker}
        onCreateShift={onCreateShift}
        isCreatingShift={isCreatingShift}
      />
    );
  }

  const fab =
    !isReadOnly && shift && !selectedLine && lines.length > 0
      ? { ariaLabel: 'Add line', onClick: () => setShowAddLine(true) }
      : undefined;

  return (
    <MobileOperatorShell
      activeSection="work"
      onChangeSection={onChangeSection}
      shift={shift}
      fab={fab}
      selectedDate={selectedDate}
      todayDate={todayDate}
      onOpenDatePicker={onOpenDatePicker}
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
    </MobileOperatorShell>
  );
}
