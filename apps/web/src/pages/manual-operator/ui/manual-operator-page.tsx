import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ManualShiftLineSummary } from '@wos/domain';
import { todayShiftQueryOptions } from '@/entities/manual-shift/api/queries';
import { useCreateShift } from '@/entities/manual-shift/api/mutations';
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
  const [activeTab, setActiveTab] = useState<OperatorTab>('queue');
  const [showAddLine, setShowAddLine] = useState(false);
  const [selectedLine, setSelectedLine] = useState<ManualShiftLineSummary | null>(null);

  const { data: todayData, isLoading } = useQuery(todayShiftQueryOptions());
  const shift = todayData?.shift ?? null;
  const lines = todayData?.lines ?? [];

  const createShift = useCreateShift();

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
