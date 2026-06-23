import type { ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { ManualShiftSession } from '@wos/domain';
import type { ManualOperatorSection } from '@/shared/config/routes';
import { ManualSectionSwitcher } from './manual-section-switcher';

interface FabAction {
  ariaLabel: string;
  onClick: () => void;
}

interface ManualOperatorShellProps {
  children: ReactNode;
  activeSection: ManualOperatorSection;
  onChangeSection: (section: ManualOperatorSection) => void;
  shift: ManualShiftSession | null;
  selectedDate: string;
  todayDate: string;
  onOpenDatePicker: () => void;
  isDesktop: boolean;
  onChangeDate?: (date: string) => void;
  headerActions?: ReactNode;
  headerMeta?: ReactNode;
  contextualRow?: ReactNode;
  fab?: FabAction;
  contentClassName?: string;
}

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(year, month - 1, day));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem'
  }).format(new Date(value));
}

function shiftDate(base: string, offsetDays: number): string {
  const [year, month, day] = base.split('-').map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + offsetDays);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function ManualOperatorShell({
  children,
  activeSection,
  onChangeSection,
  shift,
  selectedDate,
  todayDate,
  onOpenDatePicker,
  isDesktop,
  onChangeDate,
  headerActions,
  headerMeta,
  contextualRow,
  fab,
  contentClassName
}: ManualOperatorShellProps) {
  const isToday = selectedDate === todayDate;
  const displayDate = formatDisplayDate(selectedDate);

  if (isDesktop) {
    const headerTitle = shift?.name ?? 'אין משמרת פעילה';
    const headerTimeLabel = shift ? formatTime(shift.createdAt) : null;
    const normalizedTitle = headerTitle.replace(/\s+/g, ' ').trim();
    const normalizedDate = displayDate.replace(/\s+/g, ' ').trim();
    const titleContainsDate = normalizedTitle.includes(normalizedDate);
    const headerSubtitle =
      !shift ? displayDate : titleContainsDate ? headerTimeLabel : `${displayDate} · ${headerTimeLabel}`;

    return (
      <div className="flex min-h-screen flex-col bg-gray-100 text-gray-900" dir="rtl">
        <header className="shrink-0 border-b border-gray-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={onOpenDatePicker}
              className="rounded-md px-1 py-0.5 text-right transition-colors hover:bg-gray-50"
              aria-label="פתח לוח שנה"
            >
              <p className="text-sm font-bold leading-tight text-gray-900">{headerTitle}</p>
              <p className="text-xs text-gray-500">{headerSubtitle}</p>
            </button>

            {onChangeDate && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChangeDate(shiftDate(selectedDate, -1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50"
                  aria-label="תאריך קודם"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onChangeDate(shiftDate(selectedDate, 1))}
                  disabled={isToday}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="תאריך הבא"
                >
                  <ChevronRight size={16} />
                </button>
                {!isToday && (
                  <button
                    type="button"
                    onClick={() => onChangeDate(todayDate)}
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    היום
                  </button>
                )}
              </div>
            )}

            <ManualSectionSwitcher
              activeSection={activeSection}
              onSelectSection={onChangeSection}
            />

            {headerActions && <div className="ms-auto flex items-center gap-2">{headerActions}</div>}
          </div>

          {contextualRow && (
            <div className="border-t border-gray-100 px-4 py-2.5">
              {contextualRow}
            </div>
          )}

          {headerMeta && (
            <div className="border-t border-gray-100 px-4 py-3">
              {headerMeta}
            </div>
          )}
        </header>

        <main className={joinClassNames('flex-1 overflow-hidden bg-gray-50', contentClassName)}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center bg-gray-100 text-gray-900" dir="rtl">
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-white shadow-2xl">
        <header className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={onOpenDatePicker}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200"
                aria-label="בחר תאריך"
              >
                {!isToday && (
                  <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-600">
                    עבר
                  </span>
                )}
                <span>{displayDate}</span>
                <CalendarDays size={15} className="shrink-0 text-gray-400" />
              </button>
              {shift && <div className="mt-1 truncate text-sm font-medium text-gray-700">{shift.name}</div>}
            </div>

            <ManualSectionSwitcher
              activeSection={activeSection}
              onSelectSection={onChangeSection}
            />
          </div>

          {contextualRow && (
            <div className="border-t border-gray-100 px-4 py-2.5">
              {contextualRow}
            </div>
          )}
        </header>

        <main className={joinClassNames('relative w-full flex-1 overflow-y-auto', fab && 'pb-20', contentClassName)}>
          {children}
        </main>

        {fab && (
          <button
            type="button"
            onClick={fab.onClick}
            className="absolute bottom-4 left-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition-transform active:scale-95"
            aria-label={fab.ariaLabel}
          >
            <Plus size={28} />
          </button>
        )}
      </div>
    </div>
  );
}
