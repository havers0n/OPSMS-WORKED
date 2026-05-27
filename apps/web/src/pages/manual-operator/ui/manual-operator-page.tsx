import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ManualShiftLineSummary } from '@wos/domain';
import {
  todayShiftQueryOptions,
  daySummaryQueryOptions,
  shiftOrdersQueryOptions
} from '@/entities/manual-shift/api/queries';
import { useCreateShift } from '@/entities/manual-shift/api/mutations';
import {
  selectShiftSummary,
  selectLineSummaries,
  selectActiveOrders,
  selectPickerWorkloads,
  selectCheckQueue
} from '@/entities/manual-shift/model/shift-selectors';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { DesktopOperatorShell } from './desktop/desktop-operator-shell';
import { MobileOperatorShell, type OperatorTab } from './mobile-operator-shell';
import { ShiftEmptyState } from './shift-empty-state';
import { LineList } from './line-list';
import { LineDetail } from './line-detail';
import { AddLineSheet } from './add-line-sheet';
import { CheckTab } from './check-tab';
import { PeopleTab } from './people-tab';
import { DayTab } from './day-tab';

function MobileLoadingState() {
  return (
    <div className="flex items-center justify-center py-20" dir="rtl">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  );
}

function generateShiftName(): string {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
}

export function ManualOperatorPage() {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const [activeTab, setActiveTab] = useState<OperatorTab>('queue');
  const [showAddLine, setShowAddLine] = useState(false);
  const [selectedLine, setSelectedLine] = useState<ManualShiftLineSummary | null>(null);

  const { data: todayData, isLoading } = useQuery(todayShiftQueryOptions());
  const shift = todayData?.shift ?? null;
  const lines = todayData?.lines ?? [];

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
    () => (daySummary ? selectShiftSummary(daySummary) : undefined),
    [daySummary]
  );
  const lineSummaries = useMemo(
    () => selectLineSummaries(byLine, shiftOrders),
    [byLine, shiftOrders]
  );
  const activeOrders = useMemo(() => selectActiveOrders(shiftOrders), [shiftOrders]);
  const pickerWorkloads = useMemo(() => selectPickerWorkloads(shiftOrders), [shiftOrders]);
  const checkQueue = useMemo(() => selectCheckQueue(shiftOrders), [shiftOrders]);

  const createShift = useCreateShift();

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
        onCreateShift={() => createShift.mutate({ name: generateShiftName() })}
        isCreatingShift={createShift.isPending}
      />
    );
  }

  const fab =
    shift && activeTab === 'queue' && !selectedLine
      ? { ariaLabel: 'הוסף קו', onClick: () => setShowAddLine(true) }
      : undefined;

  function handleChangeTab(tab: OperatorTab) {
    setActiveTab(tab);
    setSelectedLine(null);
  }

  return (
    <MobileOperatorShell
      activeTab={activeTab}
      onChangeTab={handleChangeTab}
      shift={shift}
      fab={fab}
    >
      {isLoading ? (
        <MobileLoadingState />
      ) : !shift ? (
        <ShiftEmptyState
          onCreateShift={() => createShift.mutate({ name: generateShiftName() })}
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
          {activeTab === 'day' && <DayTab shiftId={shift.id} shiftName={shift.name} />}
        </>
      )}

      {showAddLine && shift && (
        <AddLineSheet shiftId={shift.id} onClose={() => setShowAddLine(false)} />
      )}
    </MobileOperatorShell>
  );
}
