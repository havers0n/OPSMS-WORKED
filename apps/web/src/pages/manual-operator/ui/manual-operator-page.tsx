import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ManualShiftLineSummary, ManualShiftSession } from '@wos/domain';
import { shiftByDateQueryOptions, shiftByIdQueryOptions } from '@/entities/manual-shift/api/queries';
import { useCreateShift } from '@/entities/manual-shift/api/mutations';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { useAuth } from '@/app/providers/auth-provider';
import {
  isManualOperatorSection,
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
import { AppendCurrentShiftFlow } from './append-current-shift-flow';
import { DemandTargetDateSelector } from './demand-target-date-selector';
import { LinesLanding } from './lines-landing';
import { PlanForDateFlow } from './plan-for-date-flow';
import { DemandBacklogPanel } from './demand-backlog-panel';
import { PrintingHomePage } from '../printing/routes/PrintingHomePage';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { saveDemandLastContext } from '@/entities/demand/lib/last-context';
import { demandPlanningDraftQueryOptions } from '@/entities/demand/api/queries';

const LAST_SECTION_PATH_PREFIX = 'manual-operator:last-section:';

function getTodayDateIsrael(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function generateShiftName(dateStr?: string): string {
  const date = dateStr
    ? new Date(Number(dateStr.slice(0, 4)), Number(dateStr.slice(5, 7)) - 1, Number(dateStr.slice(8, 10)))
    : new Date();
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
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
  intent,
  shiftIdFromParams,
  targetShiftIdParam,
  targetDate,
  targetShift,
  isLoading,
  canImportExcelByRole,
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
  intent: string | null;
  shiftIdFromParams: string | null;
  targetShiftIdParam: string | null;
  targetDate: string | null;
  targetShift: ManualShiftSession | null;
  isLoading: boolean;
  canImportExcelByRole: boolean;
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
    if (mode === 'demand' && intent === 'backlog') {
      return <DemandBacklogPanel />;
    }
    const isPlanForDateIntent = mode === 'demand' && intent === 'plan-for-date';
    const isPlanForDatePreStep = intent === 'plan-for-date' && !batchId && !draftId;
    const isAppendCurrentShift = mode === 'demand' && intent === 'append-current-shift';
    const isDemandPlanForDate = isPlanForDateIntent && !!batchId && !!draftId;

    if (isPlanForDatePreStep) {
      return <PlanForDateFlow />;
    }

    if (isDemandPlanForDate) {
      return <SchemeBuilder mode="demand" batchId={batchId} draftId={draftId} targetDate={targetDate} targetShiftId={targetShift?.id ?? targetShiftIdParam ?? undefined} intent="plan-for-date" />;
    }

    if (isAppendCurrentShift) {
      const resolvedTargetShiftId = targetShiftIdParam ?? shiftIdFromParams ?? '';
      if (!resolvedTargetShiftId) {
        return (
          <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-bold">שגיאה: חסר מזהה משמרת יעד (targetShiftId)</p>
              <p className="mt-1">מסלול הוספה למשמרת קיימת דורש targetShiftId. יש להגיע ממסך העבודה.</p>
            </div>
          </div>
        );
      }
      return (
        <AppendCurrentShiftFlow
          targetShiftId={resolvedTargetShiftId}
          batchId={batchId}
          draftId={draftId}
        />
      );
    }

    if (mode === 'append' && shiftIdFromParams && batchId) {
      return <AppendModePanel shiftId={shiftIdFromParams} batchId={batchId} />;
    }
    if (mode === 'demand' && !!batchId && !!draftId) {
      return <SchemeBuilder mode="demand" batchId={batchId} draftId={draftId} targetDate={targetDate} targetShiftId={targetShift?.id ?? targetShiftIdParam ?? undefined} />
    }

    if (mode === 'demand' && !batchId && !draftId && !intent) {
      return (
        <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-bold">שגיאה: mode=demand ללא batchId/draftId</p>
            <p className="mt-1">מצב demand דורש batchId ו-draftId או intent תקין.</p>
          </div>
        </div>
      );
    }

    if (batchId && !draftId && mode !== 'append') {
      return (
        <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-bold">שגיאה: חסר מזהה תכנון (draftId)</p>
            <p className="mt-1">נמצא batchId אך לא draftId. יש לחזור לייבוא DataSchema וליצור תכנון מחדש.</p>
          </div>
        </div>
      );
    }

    if (draftId && !batchId) {
      return (
        <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-bold">שגיאה: draftId ללא batchId</p>
            <p className="mt-1">draftId דורש batchId תואם.</p>
          </div>
        </div>
      );
    }

    if (intent === 'append-current-shift' && mode !== 'demand') {
      return (
        <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-bold">שגיאה: intent=append-current-shift ללא mode=demand</p>
            <p className="mt-1">intent=append-current-shift דורש mode=demand.</p>
          </div>
        </div>
      );
    }

    if (intent && intent !== 'plan-for-date' && intent !== 'append-current-shift' && intent !== 'backlog') {
      return (
        <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-bold">שגיאה: intent לא מזוהה</p>
            <p className="mt-1">intent={intent} אינו נתמך. intent נתמכים: plan-for-date, append-current-shift.</p>
          </div>
        </div>
      );
    }

    return <LinesLanding />;
  }

  if (section === 'import') {
    return (
      <ManualOperatorImportSection
        shift={shift}
        selectedDate={selectedDate}
        canMonthlyImport={canMonthlyImport}
        hasExistingWork={hasExistingWork}
        isLoading={isLoading}
        canImportExcelByRole={canImportExcelByRole}
        mode={mode}
        targetShiftId={shiftIdFromParams}
        targetDate={targetDate}
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
  const intent = searchParams.get('intent');
  const shiftIdFromParams = searchParams.get('shiftId');
  const targetDate = searchParams.get('targetDate');
  const targetShiftIdParam = searchParams.get('targetShiftId');
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false);
  const targetMaxDate = addDays(todayDate, 90);

  const isDemandPlanningRoute = section === 'lines' && mode === 'demand' && !!batchId && !!draftId;
  const isAppendRoute = section === 'lines' && mode === 'append' && !!shiftIdFromParams && !!batchId;
  const isAppendCurrentShiftRoute = section === 'lines' && mode === 'demand' && intent === 'append-current-shift';
  const hasShiftIdParam = (!!shiftIdFromParams && !isDemandPlanningRoute) || (isAppendCurrentShiftRoute && !!targetShiftIdParam);

  const effectiveShiftIdParam = isAppendCurrentShiftRoute ? targetShiftIdParam : shiftIdFromParams;
  const byDateQuery = useQuery(
    shiftByDateQueryOptions(hasShiftIdParam ? '' : selectedDate)
  );
  const byIdQuery = useQuery(
    shiftByIdQueryOptions(effectiveShiftIdParam ?? '')
  );
  const { data: shiftData, isLoading } = hasShiftIdParam ? byIdQuery : byDateQuery;
  const resolvedShift = shiftData?.shift ?? null;
  const resolvedLines = shiftData?.lines ?? [];
  const effectiveDate = resolvedShift?.date ?? selectedDate;
  const effectiveToday = effectiveDate === todayDate;
  const isReadOnly = !effectiveToday || resolvedShift?.status === 'closed';
  const hasExistingWork = resolvedLines.length > 0;

  const { data: demandDraftData } = useQuery({
    ...demandPlanningDraftQueryOptions(draftId ?? ''),
    enabled: isDemandPlanningRoute,
  });
  const isAppliedDemandDraft = demandDraftData?.draft?.status === 'applied';

  const { data: targetShiftData, isLoading: isTargetShiftLoading } = useQuery({
    ...shiftByDateQueryOptions(targetDate ?? ''),
    enabled: mode === 'demand' && !!targetDate,
  });
  const targetShift = targetShiftData?.shift ?? null;

  const createShift = useCreateShift();
  const currentMembership = currentTenantId
    ? memberships.find((membership) => membership.tenantId === currentTenantId) ?? null
    : memberships[0] ?? null;
  const canImportExcelByRole =
    currentMembership?.role === 'tenant_admin' || currentMembership?.role === 'platform_admin';
  const canMonthlyImport = !!resolvedShift && resolvedShift.status === 'active' && canImportExcelByRole;

  useEffect(() => {
    if (!section || typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      `${LAST_SECTION_PATH_PREFIX}${section}`,
      `${location.pathname}${location.search}`
    );
  }, [location.pathname, location.search, section]);

  useEffect(() => {
    if (mode !== 'demand' || !batchId || !draftId || typeof window === 'undefined') return;
    const saved = localStorage.getItem('wos:demand-planning:last-context');
    if (!saved) return;
    try {
      const ctx = JSON.parse(saved);
      if (ctx.mode === 'demand' && ctx.batchId === batchId && ctx.draftId === draftId) {
        saveDemandLastContext({
          ...ctx,
          url: `${location.pathname}${location.search}`,
          targetDate: targetDate ?? ctx.targetDate,
          savedAt: new Date().toISOString(),
        });
      }
    } catch {
      // ignore parse errors
    }
  }, [targetDate, mode, batchId, draftId, location.pathname, location.search]);

  function handleCreateShift() {
    const date = effectiveDate;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('date', date);
      next.delete('shiftId');
      return next;
    });
    createShift.mutate({ name: generateShiftName(date), date });
  }

  function handleSelectTargetDate(date: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('targetDate', date);
      return next;
    });
  }

  function handleSelectDate(date: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('date', date);
      next.delete('shiftId');
      return next;
    });
  }

  function handleCreateTargetShift() {
    if (!targetDate) return;
    createShift.mutate(
      { name: generateShiftName(targetDate), date: targetDate },
      {
        onSuccess: () => {
          // Shift created; targetDate shift query auto-refetches via invalidation in useCreateShift
        },
      }
    );
  }

  function handleChangeSection(nextSection: ManualOperatorSection) {
    if (nextSection === 'lines') {
      navigate('/operator/manual/lines');
      return;
    }
    const stored = getStoredSectionPath(nextSection);
    if (stored) {
      navigate(stored);
      return;
    }
    const base = `/operator/manual/${nextSection}`;
    const params = new URLSearchParams();
    if (selectedDate) params.set('date', effectiveDate);
    if (shiftIdFromParams && !isDemandPlanningRoute) params.set('shiftId', shiftIdFromParams);
    if (batchId) params.set('batchId', batchId);
    if (draftId) params.set('draftId', draftId);
    if (mode) params.set('mode', mode);
    if (targetDate) params.set('targetDate', targetDate);
    const qs = params.toString();
    navigate(qs ? `${base}?${qs}` : base);
  }

  if (section === null) {
    return <Navigate to={routes.operatorManualWork} replace />;
  }

  const sectionContent = (
    <ManualOperatorSectionContent
      section={section}
      shift={resolvedShift}
      lines={resolvedLines}
      isReadOnly={isReadOnly}
      selectedDate={selectedDate}
      canMonthlyImport={canMonthlyImport}
      hasExistingWork={hasExistingWork}
      batchId={batchId}
      draftId={draftId}
      mode={mode}
      intent={intent}
      shiftIdFromParams={shiftIdFromParams}
      targetShiftIdParam={targetShiftIdParam}
      targetDate={targetDate}
      targetShift={targetShift}
      isLoading={isLoading}
      canImportExcelByRole={canImportExcelByRole}
    />
  );
  const renderSectionWithoutShift = section === 'import' || section === 'printing' || section === 'lines' || isDemandPlanningRoute || isAppendRoute || isAppendCurrentShiftRoute;

  if (section === 'work') {
    return (
      <>
        <ManualOperatorWorkSection
          key={selectedDate}
          shift={resolvedShift}
          lines={resolvedLines}
          isLoading={isLoading}
          isReadOnly={isReadOnly}
          isToday={effectiveToday}
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
        shift={resolvedShift}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onOpenDatePicker={() => setShowDatePicker(true)}
        isDesktop={isDesktop}
        contentClassName={isDesktop && section === 'lines' ? 'overflow-hidden' : undefined}
        headerActions={
          isDesktop && section === 'lines' && mode === 'append' && shiftIdFromParams && batchId ? (
            <span className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              הוספת ביקוש גולמי לקווים קיימים (אבחון)
            </span>
          ) : isDesktop && section === 'lines' && isAppendCurrentShiftRoute ? (
            <span className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              הוספת הזמנות למשמרת קיימת
            </span>
          ) : isDesktop && section === 'lines' && (intent === 'plan-for-date' || (mode === 'demand' && intent === 'plan-for-date')) ? (
            <span className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              תכנון עבודה לתאריך
            </span>
          ) : isDesktop && section === 'lines' && mode === 'demand' && batchId && draftId && !isAppliedDemandDraft && !isAppendCurrentShiftRoute && intent !== 'plan-for-date' ? (
            <DemandTargetDateSelector
              targetDate={targetDate}
              targetShift={targetShift}
              isTargetShiftLoading={isTargetShiftLoading}
              onSelectTargetDate={() => setShowTargetDatePicker(true)}
              onCreateTargetShift={handleCreateTargetShift}
              isCreatingShift={createShift.isPending}
              onNavigateToAppend={(shiftId) =>
                navigate(`/operator/manual/lines?shiftId=${shiftId}&batchId=${batchId}&mode=append`)
              }
            />
          ) : isDesktop && section === 'lines' && mode === 'demand' && batchId && draftId && !isAppendCurrentShiftRoute ? (
            <span className="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              תכנון ביקוש
            </span>
          ) : undefined
        }
        contextualRow={undefined}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20" dir="rtl">
            <Loader2 size={32} className="animate-spin text-gray-400" />
          </div>
        ) : !resolvedShift && !renderSectionWithoutShift ? (
          <ShiftEmptyState onCreateShift={handleCreateShift} isCreating={createShift.isPending} isToday={effectiveToday} />
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
      {showTargetDatePicker && (
        <ShiftDatePicker
          selectedDate={targetDate ?? todayDate}
          todayDate={todayDate}
          maxSelectableDate={targetMaxDate}
          onSelect={handleSelectTargetDate}
          onClose={() => setShowTargetDatePicker(false)}
        />
      )}
    </>
  );
}
