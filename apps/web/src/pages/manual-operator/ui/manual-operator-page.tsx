import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ManualShiftLineSummary, ManualShiftSession } from '@wos/domain';
import { shiftByDateQueryOptions } from '@/entities/manual-shift/api/queries';
import { useCreateShift } from '@/entities/manual-shift/api/mutations';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { useAuth } from '@/app/providers/auth-provider';
import {
  isManualOperatorSection,
  manualOperatorSectionPath,
  type ManualOperatorSection,
  routes
} from '@/shared/config/routes';
import { MobileOperatorShell } from './mobile-operator-shell';
import { ShiftEmptyState } from './shift-empty-state';
import { ShiftDatePicker } from './shift-date-picker';
import { CheckTab } from './check-tab';
import { PeopleTab } from './people-tab';
import { DayTab } from './day-tab';
import { ProductControlTab } from './product-control-tab';
import { ManualOperatorImportSection } from './manual-operator-import-section';
import { ManualOperatorPlaceholder } from './manual-operator-placeholder';
import { ManualOperatorWorkSection } from './manual-operator-work-section';
import { SchemeBuilder } from './scheme-builder';
import { manualOperatorSectionItems } from './manual-operator-navigation';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

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
  selectedDate,
  canMonthlyImport,
  hasExistingWork
}: {
  section: ManualOperatorSection;
  shift: ManualShiftSession | null;
  lines: ManualShiftLineSummary[];
  isReadOnly: boolean;
  selectedDate: string;
  canMonthlyImport: boolean;
  hasExistingWork: boolean;
}) {
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

  if (section === 'products') {
    return shift ? <ProductControlTab shiftId={shift.id} /> : null;
  }

  if (section === 'lines') {
    return shift ? <SchemeBuilder shiftId={shift.id} /> : null;
  }

  if (section === 'import') {
    return (
      <ManualOperatorImportSection
        shift={shift}
        selectedDate={selectedDate}
        canMonthlyImport={canMonthlyImport}
        hasExistingWork={hasExistingWork}
      />
    );
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
        {shift || section === 'import'
          ? children
          : <ShiftEmptyState onCreateShift={onCreateShift} isCreating={isCreatingShift} isToday={isToday} />}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = searchParams.get('date') ?? todayDate;
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isToday = selectedDate === todayDate;
  const { data: shiftData, isLoading } = useQuery(shiftByDateQueryOptions(selectedDate));
  const shift = shiftData?.shift ?? null;
  const lines = shiftData?.lines ?? [];
  const isReadOnly = !isToday || shift?.status === 'closed';

  const createShift = useCreateShift();
  const currentMembership = currentTenantId
    ? memberships.find((membership) => membership.tenantId === currentTenantId) ?? null
    : memberships[0] ?? null;
  const canImportExcelByRole =
    currentMembership?.role === 'tenant_admin' || currentMembership?.role === 'platform_admin';
  const canMonthlyImport = !!shift && shift.status === 'active' && canImportExcelByRole;
  const hasExistingWork = lines.length > 0;

  function handleCreateShift() {
    createShift.mutate({ name: generateShiftName(), date: selectedDate });
  }

  function handleSelectDate(date: string) {
    setSearchParams({ date });
  }

  function handleChangeSection(nextSection: ManualOperatorSection) {
    navigate(manualOperatorSectionPath(nextSection, selectedDate));
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
      selectedDate={selectedDate}
      canMonthlyImport={canMonthlyImport}
      hasExistingWork={hasExistingWork}
    />
  ) : null;
  const renderSectionWithoutShift = section === 'import';

  if (isDesktop && section === 'work') {
    return (
      <>
        <ManualOperatorWorkSection
          key={selectedDate}
          shift={shift}
          lines={lines}
          isLoading={isLoading}
          isReadOnly={isReadOnly}
          isToday={isToday}
          canMonthlyImport={canMonthlyImport}
          hasExistingWork={hasExistingWork}
          isDesktop={isDesktop}
          selectedDate={selectedDate}
          todayDate={todayDate}
          onChangeDate={handleSelectDate}
          onOpenDatePicker={() => setShowDatePicker(true)}
          onCreateShift={handleCreateShift}
          isCreatingShift={createShift.isPending}
          onChangeSection={handleChangeSection}
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
            ) : !shift && !renderSectionWithoutShift ? null : sectionContent}
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

  if (section === 'work') {
    return (
      <>
        <ManualOperatorWorkSection
          key={selectedDate}
          shift={shift}
          lines={lines}
          isLoading={isLoading}
          isReadOnly={isReadOnly}
          isToday={isToday}
          canMonthlyImport={canMonthlyImport}
          hasExistingWork={hasExistingWork}
          isDesktop={isDesktop}
          selectedDate={selectedDate}
          todayDate={todayDate}
          onChangeDate={handleSelectDate}
          onOpenDatePicker={() => setShowDatePicker(true)}
          onCreateShift={handleCreateShift}
          isCreatingShift={createShift.isPending}
          onChangeSection={handleChangeSection}
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

  return (
    <>
      <MobileOperatorShell
        activeSection={section}
        onChangeSection={handleChangeSection}
        shift={shift}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onOpenDatePicker={() => setShowDatePicker(true)}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20" dir="rtl">
            <Loader2 size={32} className="animate-spin text-gray-400" />
          </div>
        ) : !shift && !renderSectionWithoutShift ? (
          <ShiftEmptyState onCreateShift={handleCreateShift} isCreating={createShift.isPending} isToday={isToday} />
        ) : (
          sectionContent
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
