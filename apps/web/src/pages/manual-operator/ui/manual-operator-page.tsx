import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ManualShiftLineSummary } from '@wos/domain';
import { shiftByDateQueryOptions } from '@/entities/manual-shift/api/queries';
import { useCreateShift } from '@/entities/manual-shift/api/mutations';
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
  const todayDate = getTodayDateIsrael();

  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<OperatorTab>('queue');
  const [showAddLine, setShowAddLine] = useState(false);
  const [selectedLine, setSelectedLine] = useState<ManualShiftLineSummary | null>(null);

  const isToday = selectedDate === todayDate;

  const { data: shiftData, isLoading } = useQuery(shiftByDateQueryOptions(selectedDate));
  const shift = shiftData?.shift ?? null;
  const lines = shiftData?.lines ?? [];

  // Read-only when viewing a past date OR the shift is closed
  const isReadOnly = !isToday || shift?.status === 'closed';

  const createShift = useCreateShift();

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
            {activeTab === 'day' && <DayTab shiftId={shift.id} shiftName={shift.name} />}
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
