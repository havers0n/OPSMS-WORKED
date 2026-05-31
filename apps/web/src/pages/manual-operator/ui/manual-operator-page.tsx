import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ManualShiftLineSummary } from '@wos/domain';
import {
  shiftByDateQueryOptions,
  daySummaryQueryOptions,
  shiftOrdersQueryOptions
} from '@/entities/manual-shift/api/queries';
import { useCreateShift } from '@/entities/manual-shift/api/mutations';
import {
  selectShiftSummary,
  selectLineSummaries,
  selectActiveOrders,
  selectPickerWorkloads,
  selectCheckQueue,
  selectLineDetail,
  selectPickerDetail,
  selectOrderDetail
} from '@/entities/manual-shift/model/shift-selectors';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { DesktopOperatorShell } from './desktop/desktop-operator-shell';
import { MobileOperatorShell, type OperatorTab } from './mobile-operator-shell';
import { ShiftEmptyState } from './shift-empty-state';
import { ShiftDatePicker } from './shift-date-picker';
import { LineList } from './line-list';
import { LineDetail } from './line-detail';
import { AddLineSheet } from './add-line-sheet';
import { CheckTab } from './check-tab';
import { PeopleTab } from './people-tab';
import { DayTab } from './day-tab';

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

export function ManualOperatorPage() {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const todayDate = getTodayDateIsrael();

  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [activeTab, setActiveTab] = useState<OperatorTab>('queue');
  const [showAddLine, setShowAddLine] = useState(false);
  const [selectedLine, setSelectedLine] = useState<ManualShiftLineSummary | null>(null);
  const [selectedDesktopDetail, setSelectedDesktopDetail] = useState<
    | { type: 'line'; lineId: string }
    | { type: 'picker'; pickerKey: string }
    | { type: 'order'; orderId: string }
    | null
  >(null);

  const isToday = selectedDate === todayDate;

  const { data: shiftData, isLoading } = useQuery(shiftByDateQueryOptions(selectedDate));
  const shift = shiftData?.shift ?? null;
  const lines = shiftData?.lines ?? [];

  // Read-only when viewing a past date OR the shift is closed
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
  const lineDetail = useMemo(() => {
    if (!selectedDesktopDetail || selectedDesktopDetail.type !== 'line') return null;
    return selectLineDetail(selectedDesktopDetail.lineId, lineSummaries, shiftOrders);
  }, [selectedDesktopDetail, lineSummaries, shiftOrders]);
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

  const createShift = useCreateShift();

  if (isDesktop) {
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
          lineDetail={lineDetail}
          pickerDetail={pickerDetail}
          orderDetail={orderDetail}
          selectedDetailType={selectedDesktopDetail?.type ?? null}
          onSelectLine={(lineId) => setSelectedDesktopDetail({ type: 'line', lineId })}
          onSelectPicker={(pickerKey) => setSelectedDesktopDetail({ type: 'picker', pickerKey })}
          onSelectOrder={(orderId) => setSelectedDesktopDetail({ type: 'order', orderId })}
          onCloseDetail={() => setSelectedDesktopDetail(null)}
          onCreateShift={() => createShift.mutate({ name: generateShiftName() })}
          isCreatingShift={createShift.isPending}
          selectedDate={selectedDate}
          todayDate={todayDate}
          onChangeDate={handleSelectDate}
          onOpenDatePicker={() => setShowDatePicker(true)}
          canInteract={!isReadOnly}
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
    !isReadOnly && shift && activeTab === 'queue' && !selectedLine
      ? { ariaLabel: 'הוסף קו', onClick: () => setShowAddLine(true) }
      : undefined;

  function handleChangeTab(tab: OperatorTab) {
    setActiveTab(tab);
    setSelectedLine(null);
  }

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setActiveTab('queue');
    setSelectedLine(null);
    setSelectedDesktopDetail(null);
  }

  return (
    <>
      <MobileOperatorShell
        activeTab={activeTab}
        onChangeTab={handleChangeTab}
        shift={shift}
        fab={fab}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onOpenDatePicker={() => setShowDatePicker(true)}
      >
        {isLoading ? (
          <MobileLoadingState />
        ) : !shift ? (
          <ShiftEmptyState
            onCreateShift={isToday ? () => createShift.mutate({ name: generateShiftName() }) : undefined}
            isCreating={createShift.isPending}
          />
        ) : (
          <>
            {activeTab === 'queue' && (
              <>
                <LineList lines={lines} onSelectLine={setSelectedLine} />
                {selectedLine && (
                  <LineDetail summary={selectedLine} onBack={() => setSelectedLine(null)} />
                )}
              </>
            )}
            {activeTab === 'check' && <CheckTab shiftId={shift.id} lines={lines} />}
            {activeTab === 'people' && <PeopleTab shiftId={shift.id} />}
            {activeTab === 'day' && <DayTab shiftId={shift.id} shiftName={shift.name} canInteract={!isReadOnly} />}
          </>
        )}

        {showAddLine && shift && !isReadOnly && (
          <AddLineSheet shiftId={shift.id} onClose={() => setShowAddLine(false)} />
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
