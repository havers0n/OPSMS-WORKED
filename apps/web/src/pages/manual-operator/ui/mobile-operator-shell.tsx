import { type ReactNode } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import type { ManualShiftSession } from '@wos/domain';
import type { ManualOperatorSection } from '@/shared/config/routes';
import { manualOperatorSectionItems } from './manual-operator-navigation';

export type OperatorTab = ManualOperatorSection;

interface FabAction {
  ariaLabel: string;
  onClick: () => void;
}

interface MobileOperatorShellProps {
  children: ReactNode;
  activeSection: OperatorTab;
  onChangeSection: (section: OperatorTab) => void;
  shift: ManualShiftSession | null;
  fab?: FabAction;
  selectedDate: string;
  todayDate: string;
  onOpenDatePicker: () => void;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(y, m - 1, d));
}

export function MobileOperatorShell({
  children,
  activeSection,
  onChangeSection,
  shift,
  fab,
  selectedDate,
  todayDate,
  onOpenDatePicker
}: MobileOperatorShellProps) {
  const isToday = selectedDate === todayDate;
  const displayDate = formatDisplayDate(selectedDate);

  return (
    <div className="flex min-h-screen justify-center bg-gray-100 text-gray-900" dir="rtl">
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-white shadow-2xl">
        <header className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Artos Operator</h1>

            <button
              type="button"
              onClick={onOpenDatePicker}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors hover:bg-gray-100 active:bg-gray-200"
              aria-label="בחר תאריך"
            >
              {!isToday && (
                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-600">
                  עבר
                </span>
              )}
              <span className="text-sm font-medium text-gray-600">{displayDate}</span>
              <CalendarDays size={15} className="shrink-0 text-gray-400" />
            </button>
          </div>
          {shift && <div className="mt-1 truncate text-sm font-medium text-gray-600">{shift.name}</div>}
        </header>

        <main className="relative w-full flex-1 overflow-y-auto pb-20">
          {children}
        </main>

        {fab && (
          <button
            type="button"
            onClick={fab.onClick}
            className="absolute bottom-20 left-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition-transform active:scale-95"
            aria-label={fab.ariaLabel}
          >
            <Plus size={28} />
          </button>
        )}

        <nav className="fixed bottom-0 z-40 flex h-16 w-full max-w-[430px] items-center justify-around border-t border-gray-200 bg-white md:absolute">
          {manualOperatorSectionItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.section;
            return (
              <button
                key={item.section}
                type="button"
                onClick={() => onChangeSection(item.section)}
                className={`flex h-full w-full flex-col items-center justify-center gap-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}`}
                aria-label={item.label}
                data-testid={item.testId}
              >
                <Icon size={22} />
                <span className="text-[11px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
