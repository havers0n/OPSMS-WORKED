import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ManualShiftLineSummary, ManualShiftSession } from '@wos/domain';
import {
  daySummaryQueryOptions,
  shiftByDateQueryOptions,
  shiftOrdersQueryOptions
} from '@/entities/manual-shift/api/queries';
import { useCreateShift } from '@/entities/manual-shift/api/mutations';
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
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { useAuth } from '@/app/providers/auth-provider';
import {
  isManualOperatorSection,
  manualOperatorSectionPath,
  type ManualOperatorSection,
  routes
} from '@/shared/config/routes';
import { DesktopOperatorShell } from './desktop/desktop-operator-shell';
import { MobileOperatorShell } from './mobile-operator-shell';
import { ShiftEmptyState } from './shift-empty-state';
import { ShiftDatePicker } from './shift-date-picker';
import { LineList } from './line-list';
import { LineDetail } from './line-detail';
import { AddLineSheet } from './add-line-sheet';
import { CheckTab } from './check-tab';
import { PeopleTab } from './people-tab';
import { DayTab } from './day-tab';
import { ImportExcelSheet } from './import-excel-sheet';
import { MonthlyImportPreviewSheet } from './monthly-import-preview-sheet';
import { ManualOperatorPlaceholder } from './manual-operator-placeholder';
import { manualOperatorSectionItems } from './manual-operator-navigation';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

function getTodayDateIsrael(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function generateShiftName(): string {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
}

function MobileLoadingState() {
  return (
    <div className="flex items-center justify-center py-20" dir="rtl">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  );
}

function getSectionFromPathname(pathname: string): ManualOperatorSection | null {
  if (pathname === routes.operatorManual) return 'work';
  if (!pathname.startsWith(`${routes.operatorManual}/`)) return null;
  const section = pathname.slice(routes.operatorManual.length + 1).split('/')[0];
  return isManualOperatorSection(section) ? section : null;
}

function ManualOperatorSectionContent({
  section,
  shift,
  lines,
  isReadOnly,
  canMonthlyImport,
  activeTabState,
  onSelectLine,
  onOpenImportExcel,
  onOpenMonthlyPreview,
  onOpenAddLine,
  selectedLine
}: {
  section: ManualOperatorSection;
  shift: ManualShiftSession | null;
  lines: ManualShiftLineSummary[];
  isReadOnly: boolean;
  canMonthlyImport: boolean;
  activeTabState: {
    selectedLine: ManualShiftLineSummary | null;
    setSelectedLine: (line: ManualShiftLineSummary | null) => void;
    showAddLine: boolean;
    setShowAddLine: (value: boolean) => void;
    showImportExcel: boolean;
    setShowImportExcel: (value: boolean) => void;
    showMonthlyPreview: boolean;
    setShowMonthlyPreview: (value: boolean) => void;
    importSuccessMessage: string | null;
    setImportSuccessMessage: (value: string | null) => void;
  };
  onSelectLine: (line: ManualShiftLineSummary) => void;
  onOpenImportExcel: () => void;
  onOpenMonthlyPreview: () => void;
  onOpenAddLine: () => void;
  selectedLine: ManualShiftLineSummary | null;
}) {
  if (section === 'work') {
    return (
      <>
        {activeTabState.importSuccessMessage && (
          <div className="mx-4 mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {activeTabState.importSuccessMessage}
          </div>
        )}
        <LineList
          lines={lines}
          onSelectLine={onSelectLine}
          canImport={canMonthlyImport}
          canPreviewMonthly={canMonthlyImport}
          canAddManual={!isReadOnly}
          showNoShiftHint={!shift}
          onImportExcel={onOpenImportExcel}
          onPreviewMonthly={onOpenMonthlyPreview}
          onAddLineManually={onOpenAddLine}
        />
        {selectedLine && <LineDetail summary={selectedLine} onBack={() => activeTabState.setSelectedLine(null)} />}
      </>
    );
  }

  if (section === 'summary') {
    return shift ? (
      <DayTab shiftId={shift.id} shiftName={shift.name} canInteract={!isReadOnly} />
    ) : null;
  }

  if (section === 'check') {
    return shift ? <CheckTab shiftId={shift.id} lines={lines} /> : null;
  }

  if (section === 'people') {
    return shift ? <PeopleTab shiftId={shift.id} /> : null;
  }

  return (
    <ManualOperatorPlaceholder
      testId={`manual-placeholder-${section}`}
      title={section}
      description="המסך הזה עדיין לא מחובר. השארנו אותו כמציין מקום בטוח כדי לא לשנות התנהגות קיימת."
    />
  );
}

function DesktopSectionFrame({
  section,
  shift,
  selectedDate,
  onChangeSection,
  onOpenDatePicker,
  children,
  isToday,
  onCreateShift,
  isCreatingShift
}: {
  section: ManualOperatorSection;
  shift: ManualShiftSession | null;
  selectedDate: string;
  onChangeSection: (section: ManualOperatorSection) => void;
  onOpenDatePicker: () => void;
  children: ReactNode;
  isToday: boolean;
  onCreateShift: () => void;
  isCreatingShift: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-100" dir="rtl">
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 h-14 shrink-0">
        <button
          type="button"
          onClick={onOpenDatePicker}
          className="shrink-0 rounded-md px-1 py-0.5 text-right hover:bg-gray-50"
          aria-label="פתח לוח שנה"
        >
          <p className="text-sm font-bold leading-tight text-gray-900">{shift?.name ?? 'אין משמרת פעילה'}</p>
          <p className="text-xs text-gray-500">{selectedDate}{isToday ? '' : ' • עבר'}</p>
        </button>
        <div className="h-8 w-px shrink-0 bg-gray-200" />
        <nav className="flex items-center gap-2 overflow-x-auto">
          {manualOperatorSectionItems.map((item) => {
            const isActive = item.section === section;
            return (
              <button
                key={item.section}
                type="button"
                onClick={() => onChangeSection(item.section)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {!isToday && (
            <button
              type="button"
              onClick={onCreateShift}
              disabled={isCreatingShift}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              היום
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-gray-50">
        {shift ? children : <ShiftEmptyState onCreateShift={onCreateShift} isCreating={isCreatingShift} isToday={isToday} />}
      </main>
    </div>
  );
}

export function ManualOperatorPage() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { currentTenantId, memberships } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const section = getSectionFromPathname(location.pathname);

  const todayDate = getTodayDateIsrael();
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showMonthlyPreview, setShowMonthlyPreview] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<ManualShiftLineSummary | null>(null);
  const [selectedDesktopDetail, setSelectedDesktopDetail] = useState<
    | { type: 'picker'; pickerKey: string }
    | { type: 'order'; orderId: string }
    | null
  >(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedPointName, setSelectedPointName] = useState<string | null>(null);

  const isToday = selectedDate === todayDate;
  const { data: shiftData, isLoading } = useQuery(shiftByDateQueryOptions(selectedDate));
  const shift = shiftData?.shift ?? null;
  const lines = shiftData?.lines ?? [];
  const isReadOnly = !isToday || shift?.status === 'closed';

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

  const createShift = useCreateShift();
  const currentMembership = currentTenantId
    ? memberships.find((membership) => membership.tenantId === currentTenantId) ?? null
    : memberships[0] ?? null;
  const canImportExcelByRole =
    currentMembership?.role === 'tenant_admin' || currentMembership?.role === 'platform_admin';
  const canMonthlyImport = !!shift && shift.status === 'active' && lines.length === 0 && canImportExcelByRole;

  function handleCreateShift() {
    createShift.mutate({ name: generateShiftName(), date: selectedDate });
  }

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setSelectedLine(null);
    setSelectedDesktopDetail(null);
    setSelectedLineId(null);
    setSelectedPointName(null);
    setShowMonthlyPreview(false);
    setShowImportExcel(false);
    setImportSuccessMessage(null);
  }

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

  function handleChangeSection(nextSection: ManualOperatorSection) {
    if (nextSection !== 'work') {
      setSelectedLine(null);
      setShowAddLine(false);
      setShowImportExcel(false);
      setShowMonthlyPreview(false);
    }
    navigate(manualOperatorSectionPath(nextSection));
  }

  if (section === null) {
    return <Navigate to={routes.operatorManualWork} replace />;
  }

  const sectionContent = section ? (
    <ManualOperatorSectionContent
      section={section}
      shift={shift}
      lines={lines}
      isReadOnly={isReadOnly}
      canMonthlyImport={canMonthlyImport}
      activeTabState={{
        selectedLine,
        setSelectedLine,
        showAddLine,
        setShowAddLine,
        showImportExcel,
        setShowImportExcel,
        showMonthlyPreview,
        setShowMonthlyPreview,
        importSuccessMessage,
        setImportSuccessMessage
      }}
      onSelectLine={setSelectedLine}
      onOpenImportExcel={() => setShowImportExcel(true)}
      onOpenMonthlyPreview={() => setShowMonthlyPreview(true)}
      onOpenAddLine={() => setShowAddLine(true)}
      selectedLine={selectedLine}
    />
  ) : null;

  if (isDesktop && section && section !== 'work') {
    return (
      <>
        <DesktopSectionFrame
          section={section}
          shift={shift}
          selectedDate={selectedDate}
          onChangeSection={handleChangeSection}
          onOpenDatePicker={() => setShowDatePicker(true)}
          isToday={isToday}
          onCreateShift={handleCreateShift}
          isCreatingShift={createShift.isPending}
        >
          <div className="mx-auto max-w-4xl px-4 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-gray-400" />
              </div>
            ) : !shift ? null : sectionContent}
          </div>
        </DesktopSectionFrame>
        {showDatePicker && (
          <ShiftDatePicker
            selectedDate={selectedDate}
            todayDate={todayDate}
            onSelect={handleSelectDate}
            onClose={() => setShowDatePicker(false)}
          />
        )}
      </>
    );
  }

  if (isDesktop && section === 'work') {
    return (
      <>
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
          onChangeDate={handleSelectDate}
          onOpenDatePicker={() => setShowDatePicker(true)}
          canInteract={!isReadOnly}
          onCreateShift={handleCreateShift}
          isCreatingShift={createShift.isPending}
        />
        {showDatePicker && (
          <ShiftDatePicker
            selectedDate={selectedDate}
            todayDate={todayDate}
            onSelect={handleSelectDate}
            onClose={() => setShowDatePicker(false)}
          />
        )}
      </>
    );
  }

  const fab =
    section === 'work' && !isReadOnly && shift && !selectedLine && lines.length > 0
      ? { ariaLabel: 'Add line', onClick: () => setShowAddLine(true) }
      : undefined;

  return (
    <>
      <MobileOperatorShell
        activeSection={section}
        onChangeSection={handleChangeSection}
        shift={shift}
        fab={fab}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onOpenDatePicker={() => setShowDatePicker(true)}
      >
        {isLoading ? (
          <MobileLoadingState />
        ) : !shift ? (
          <ShiftEmptyState onCreateShift={handleCreateShift} isCreating={createShift.isPending} isToday={isToday} />
        ) : (
          sectionContent
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

      {showDatePicker && (
        <ShiftDatePicker
          selectedDate={selectedDate}
          todayDate={todayDate}
          onSelect={handleSelectDate}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </>
  );
}
