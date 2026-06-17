import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ManualShiftLineSummary, ManualShiftSession } from '@wos/domain';
import {
  daySummaryQueryOptions,
  shiftOrdersQueryOptions
} from '@/entities/manual-shift/api/queries';
import {
  selectActiveOrders,
  selectCheckQueue,
  selectLineHierarchySummaries,
  selectLineSummaries,
  selectOrderDetail,
  selectPickerDetail,
  selectPickerWorkloads,
  selectPointSummaries,
  selectShiftSummary,
  type ShiftListOrder
} from '@/entities/manual-shift/model/shift-selectors';
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
  const [selectedDesktopDetail, setSelectedDesktopDetail] = useState<
    | { type: 'picker'; pickerKey: string }
    | { type: 'order'; orderId: string }
    | null
  >(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedPointName, setSelectedPointName] = useState<string | null>(null);

  const { data: daySummary, isLoading: isDaySummaryLoading } = useQuery({
    ...daySummaryQueryOptions(shift?.id ?? ''),
    enabled: !!shift?.id && isDesktop
  });
  const { data: shiftOrders = [] } = useQuery({
    ...shiftOrdersQueryOptions(shift?.id ?? ''),
    enabled: !!shift?.id && isDesktop
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
  const activeOrders = useMemo(() => selectActiveOrders(shiftOrders), [shiftOrders]);
  const pickerWorkloads = useMemo(() => selectPickerWorkloads(shiftOrders), [shiftOrders]);
  const checkQueue = useMemo(() => selectCheckQueue(shiftOrders), [shiftOrders]);
  const pickerDetail = useMemo(() => {
    if (!selectedDesktopDetail || selectedDesktopDetail.type !== 'picker') return null;
    return selectPickerDetail(
      selectedDesktopDetail.pickerKey,
      pickerWorkloads,
      shiftOrders,
      lineSummaries
    );
  }, [selectedDesktopDetail, pickerWorkloads, shiftOrders, lineSummaries]);
  const orderDetail = useMemo(() => {
    if (!selectedDesktopDetail || selectedDesktopDetail.type !== 'order') return null;
    return selectOrderDetail(selectedDesktopDetail.orderId, shiftOrders, lineSummaries);
  }, [selectedDesktopDetail, shiftOrders, lineSummaries]);
  const shiftListOrders = shiftOrders as ShiftListOrder[];
  const lineHierarchySummaries = useMemo(
    () => selectLineHierarchySummaries(lineSummaries, shiftListOrders),
    [lineSummaries, shiftListOrders]
  );
  const pointSummaries = useMemo(
    () => (selectedLineId ? selectPointSummaries(selectedLineId, shiftListOrders) : []),
    [selectedLineId, shiftListOrders]
  );

  function handleSelectHierarchyLine(lineId: string) {
    setSelectedLineId(lineId);
    setSelectedPointName(null);
  }

  function handleSelectHierarchyPoint(pointName: string) {
    setSelectedPointName(pointName);
  }

  function handleClearHierarchyLine() {
    setSelectedLineId(null);
    setSelectedPointName(null);
  }

  function handleClearHierarchyPoint() {
    setSelectedPointName(null);
  }

  if (isDesktop) {
    return (
      <DesktopOperatorShell
        shift={shift}
        isLoading={isLoading || (!!shift && isDaySummaryLoading)}
        kpi={kpi}
        lineSummaries={lineSummaries}
        activeOrders={activeOrders}
        pickerWorkloads={pickerWorkloads}
        checkQueue={checkQueue}
        pickerDetail={pickerDetail}
        orderDetail={orderDetail}
        selectedDetailType={selectedDesktopDetail?.type ?? null}
        selectedLineId={selectedLineId}
        selectedPointName={selectedPointName}
        lineHierarchySummaries={lineHierarchySummaries}
        pointSummaries={pointSummaries}
        onSelectPicker={(pickerKey) => setSelectedDesktopDetail({ type: 'picker', pickerKey })}
        onSelectOrder={(orderId) => setSelectedDesktopDetail({ type: 'order', orderId })}
        onCloseDetail={() => setSelectedDesktopDetail(null)}
        onSelectHierarchyLine={handleSelectHierarchyLine}
        onSelectHierarchyPoint={handleSelectHierarchyPoint}
        onClearHierarchyLine={handleClearHierarchyLine}
        onClearHierarchyPoint={handleClearHierarchyPoint}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onChangeDate={onChangeDate}
        onOpenDatePicker={onOpenDatePicker}
        canInteract={!isReadOnly}
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
            canImport={canMonthlyImport}
            canPreviewMonthly={canMonthlyImport}
            canAddManual={!isReadOnly}
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
      {showImportExcel && shift && canMonthlyImport && (
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