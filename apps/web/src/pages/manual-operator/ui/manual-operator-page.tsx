import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { todayShiftQueryOptions } from '@/entities/manual-shift/api/queries';
import { useCreateShift } from '@/entities/manual-shift/api/mutations';
import { MobileOperatorShell, type OperatorTab } from './mobile-operator-shell';
import { ShiftEmptyState } from './shift-empty-state';
import { LineList } from './line-list';
import { AddLineSheet } from './add-line-sheet';

function MobileLoadingState() {
  return (
    <div className="flex items-center justify-center py-20" dir="rtl">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-3" dir="rtl">
      <p className="text-gray-400 font-medium text-base">לשונית {label} בפיתוח</p>
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

  const { data: todayData, isLoading } = useQuery(todayShiftQueryOptions());
  const shift = todayData?.shift ?? null;
  const lines = todayData?.lines ?? [];

  const createShift = useCreateShift();

  return (
    <MobileOperatorShell
      activeTab={activeTab}
      onChangeTab={setActiveTab}
      shift={shift}
      onAddLine={shift && activeTab === 'queue' ? () => setShowAddLine(true) : undefined}
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
          {activeTab === 'queue' && <LineList lines={lines} />}
          {activeTab === 'check' && <PlaceholderTab label="בדיקה" />}
          {activeTab === 'people' && <PlaceholderTab label="עובדים" />}
          {activeTab === 'day' && <PlaceholderTab label="יום" />}
        </>
      )}

      {showAddLine && shift && (
        <AddLineSheet shiftId={shift.id} onClose={() => setShowAddLine(false)} />
      )}
    </MobileOperatorShell>
  );
}
