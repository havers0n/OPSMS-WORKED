import { useEffect, useState } from 'react';
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
import { ShiftEmptyState } from './shift-empty-state';
import { ShiftDatePicker } from './shift-date-picker';
import { CheckTab } from './check-tab';
import { PeopleTab } from './people-tab';
import { DayTab } from './day-tab';
import { ProductControlTab } from './product-control-tab';
import { ManualOperatorImportSection } from './manual-operator-import-section';
import { ManualOperatorPlaceholder } from './manual-operator-placeholder';
import { ManualOperatorShell } from './manual-operator-shell';
import { ManualOperatorWorkSection } from './manual-operator-work-section';
import { SchemeBuilder } from './scheme-builder';
import { AppendModePanel } from './scheme-builder/append-mode-panel';
import { PrintingHomePage } from '../printing/routes/PrintingHomePage';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const LAST_SECTION_PATH_PREFIX = 'manual-operator:last-section:';

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

function getStoredSectionPath(section: ManualOperatorSection) {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(`${LAST_SECTION_PATH_PREFIX}${section}`);
}

function ManualOperatorSectionContent({
  section,
  shift,
  lines,
  isReadOnly,
  selectedDate,
  canMonthlyImport,
  hasExistingWork,
  batchId,
  draftId,
  mode,
  shiftIdFromParams
}: {
  section: ManualOperatorSection;
  shift: ManualShiftSession | null;
  lines: ManualShiftLineSummary[];
  isReadOnly: boolean;
  selectedDate: string;
  canMonthlyImport: boolean;
  hasExistingWork: boolean;
  batchId: string | null;
  draftId: string | null;
  mode: string | null;
  shiftIdFromParams: string | null;
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
    return shift ? <ProductControlTab shiftId={shift.id} planningDate={selectedDate} /> : null;
  }

  if (section === 'lines') {
    if (mode === 'append' && shiftIdFromParams && batchId) {
      return <AppendModePanel shiftId={shiftIdFromParams} batchId={batchId} />;
    }
    if (batchId && draftId) {
      return <SchemeBuilder mode="demand" batchId={batchId} draftId={draftId} />;
    }
    if (batchId && !draftId) {
      return (
        <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-bold">שגיאה: חסר מזהה תכנון (draftId)</p>
            <p className="mt-1">נמצא batchId אך לא draftId. יש לחזור לייבוא DataSchema וליצור תכנון מחדש.</p>
          </div>
        </div>
      );
    }
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

  if (section === 'printing') {
    return <PrintingHomePage shiftId={shift?.id} />;
  }

  return (
    <ManualOperatorPlaceholder
      testId={`manual-placeholder-${section}`}
      title={section}
      description="המסך הזה עדיין לא מחובר. השארנו אותו כמציין מקום בטוח כדי לא לשנות התנהגות קיימת."
    />
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
  const batchId = searchParams.get('batchId');
  const draftId = searchParams.get('draftId');
  const mode = searchParams.get('mode');
  const shiftIdFromParams = searchParams.get('shiftId');

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

  useEffect(() => {
    if (!section || typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      `${LAST_SECTION_PATH_PREFIX}${section}`,
      `${location.pathname}${location.search}`
    );
  }, [location.pathname, location.search, section]);

  function handleCreateShift() {
    createShift.mutate({ name: generateShiftName(), date: selectedDate });
  }

  function handleSelectDate(date: string) {
    setSearchParams({ date });
  }

  function handleChangeSection(nextSection: ManualOperatorSection) {
    navigate(getStoredSectionPath(nextSection) ?? manualOperatorSectionPath(nextSection, selectedDate));
  }

  if (section === null) {
    return <Navigate to={routes.operatorManualWork} replace />;
  }

  const sectionContent = (
    <ManualOperatorSectionContent
      section={section}
      shift={shift}
      lines={lines}
      isReadOnly={isReadOnly}
      selectedDate={selectedDate}
      canMonthlyImport={canMonthlyImport}
      hasExistingWork={hasExistingWork}
      batchId={batchId}
      draftId={draftId}
      mode={mode}
      shiftIdFromParams={shiftIdFromParams}
    />
  );
  const renderSectionWithoutShift = section === 'import' || section === 'printing' || (section === 'lines' && !!batchId && !!draftId) || (section === 'lines' && mode === 'append' && !!shiftIdFromParams);

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
      <ManualOperatorShell
        activeSection={section}
        onChangeSection={handleChangeSection}
        shift={shift}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onOpenDatePicker={() => setShowDatePicker(true)}
        isDesktop={isDesktop}
        contentClassName={isDesktop && section === 'lines' ? 'overflow-hidden' : undefined}
        headerActions={
          isDesktop && section === 'lines' && mode === 'append' && shiftIdFromParams && batchId ? (
            <span className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              הוספת ביקוש גולמי לקווים קיימים
            </span>
          ) : isDesktop && section === 'lines' && !batchId && !draftId ? (
            <span className="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              טיוטה מקומית בלבד
            </span>
          ) : isDesktop && section === 'lines' && batchId && draftId ? (
            <span className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              תכנון ביקוש גולמי
            </span>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20" dir="rtl">
            <Loader2 size={32} className="animate-spin text-gray-400" />
          </div>
        ) : !shift && !renderSectionWithoutShift ? (
          <ShiftEmptyState onCreateShift={handleCreateShift} isCreating={createShift.isPending} isToday={isToday} />
        ) : isDesktop && section !== 'lines' && section !== 'products' ? (
          <div className="mx-auto max-w-4xl px-4 py-6">
            {sectionContent}
          </div>
        ) : (
          sectionContent
        )}
      </ManualOperatorShell>
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
