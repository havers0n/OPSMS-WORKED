import { type ReactNode } from 'react';
import { Calendar, CheckSquare, ListTodo, Plus, Users } from 'lucide-react';
import type { ManualShiftSession } from '@wos/domain';

export type OperatorTab = 'queue' | 'check' | 'people' | 'day';

interface MobileOperatorShellProps {
  children: ReactNode;
  activeTab: OperatorTab;
  onChangeTab: (tab: OperatorTab) => void;
  shift: ManualShiftSession | null;
  onAddLine?: () => void;
}

export function MobileOperatorShell({
  children,
  activeTab,
  onChangeTab,
  shift,
  onAddLine
}: MobileOperatorShellProps) {
  const todayStr = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center text-gray-900" dir="rtl">
      <div className="w-full max-w-[430px] h-[100dvh] bg-white flex flex-col relative shadow-2xl overflow-hidden">

        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="font-semibold text-lg tracking-tight">Artos Operator</h1>
            <span className="text-sm text-gray-500 font-medium">{todayStr}</span>
          </div>
          {shift && (
            <div className="mt-1 text-sm text-gray-600 font-medium truncate">{shift.name}</div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto w-full relative pb-20">
          {children}
        </main>

        {/* Floating Action Button */}
        {onAddLine && (
          <button
            onClick={onAddLine}
            className="absolute bottom-20 left-4 w-14 h-14 bg-gray-900 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-30"
            aria-label="הוסף קו"
          >
            <Plus size={28} />
          </button>
        )}

        {/* Bottom Nav */}
        <nav className="fixed md:absolute bottom-0 w-full max-w-[430px] bg-white border-t border-gray-200 flex justify-around items-center h-16 shrink-0 z-40">
          <button
            onClick={() => onChangeTab('queue')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'queue' ? 'text-blue-600' : 'text-gray-500'}`}
            aria-label="תור"
          >
            <ListTodo size={24} />
            <span className="text-[11px] font-medium">תור</span>
          </button>

          <button
            onClick={() => onChangeTab('check')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'check' ? 'text-blue-600' : 'text-gray-500'}`}
            aria-label="בדיקה"
          >
            <CheckSquare size={24} />
            <span className="text-[11px] font-medium">בדיקה</span>
          </button>

          <button
            onClick={() => onChangeTab('people')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'people' ? 'text-blue-600' : 'text-gray-500'}`}
            aria-label="עובדים"
          >
            <Users size={24} />
            <span className="text-[11px] font-medium">עובדים</span>
          </button>

          <button
            onClick={() => onChangeTab('day')}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'day' ? 'text-blue-600' : 'text-gray-500'}`}
            aria-label="יום"
          >
            <Calendar size={24} />
            <span className="text-[11px] font-medium">יום</span>
          </button>
        </nav>

      </div>
    </div>
  );
}
