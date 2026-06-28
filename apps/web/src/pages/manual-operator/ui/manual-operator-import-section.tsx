import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ManualShiftSession } from '@wos/domain';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { monthlyReplaceSafetyQueryOptions } from '@/entities/manual-shift/api/queries';
import { BondedImportPanel } from './bonded-import-panel';
import { BondedImportSheet } from './bonded-import-sheet';
import { WarehouseStockImportPanel } from './warehouse-stock-import-panel';
import { WarehouseStockImportSheet } from './warehouse-stock-import-sheet';
import { ImportExcelSheet } from './import-excel-sheet';
import { MonthlyImportPreviewSheet } from './monthly-import-preview-sheet';
import { DatasheetImportPanel } from './datasheet-import-panel';

interface ManualOperatorImportSectionProps {
  shift: ManualShiftSession | null;
  selectedDate: string;
  canMonthlyImport: boolean;
  hasExistingWork: boolean;
  isLoading: boolean;
  canImportExcelByRole: boolean;
  mode: string | null;
  targetShiftId: string | null;
  targetDate: string | null;
}

function ImportEntryCard({
  title,
  description,
  actionLabel,
  disabled = false,
  disabledMessage,
  onClick
}: {
  title: string;
  description: string;
  actionLabel: string;
  disabled?: boolean;
  disabledMessage?: string;
  onClick: () => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
        {disabled && disabledMessage ? <p className="text-xs text-amber-700">{disabledMessage}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="mt-4 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {actionLabel}
      </button>
    </section>
  );
}

export function ManualOperatorImportSection({
  shift,
  selectedDate,
  canMonthlyImport,
  hasExistingWork,
  isLoading,
  canImportExcelByRole,
  mode,
  targetShiftId,
  targetDate,
}: ManualOperatorImportSectionProps) {
  const navigate = useNavigate();
  const isAppendDemandMode = mode === 'append-demand';
  const [showBondedSheet, setShowBondedSheet] = useState(false);
  const [showWarehouseStockSheet, setShowWarehouseStockSheet] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showMonthlyPreview, setShowMonthlyPreview] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  const canFetchReplaceSafety = canMonthlyImport && hasExistingWork && !!shift?.id;
  const { data: replaceSafety } = useQuery({
    ...monthlyReplaceSafetyQueryOptions(shift?.id ?? ''),
    enabled: canFetchReplaceSafety
  });

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6" dir="rtl" data-testid="manual-import-section">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">ייבוא נתונים</h1>
              <p className="text-sm text-gray-600">
                זהו המקום הקנוני לכלי הייבוא של המפעיל. הייבוא היומי והחודשי נשארים זמינים כאן, ובנוסף מוצג בלוק בונדד מלא.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBondedSheet(true)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800"
              data-testid="open-bonded-import-sheet"
            >
              פתיחה במסך מלא
            </button>
          </div>
        </section>

        {isAppendDemandMode && shift?.status === 'active' && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-blue-900">הוספת הזמנות למשמרת נוכחית</h2>
                <p className="text-sm text-blue-700">
                  בחר קובץ DataSheet ליצירת תכנון ביקוש חדש. לאחר הפרסום, ההזמנות החדשות ייכנסו למשמרת הנוכחית
                  מבלי לפגוע בהזמנות קיימות.
                </p>
              </div>
              {targetShiftId && (
                <button
                  type="button"
                  onClick={() => navigate(`/operator/manual/work?shiftId=${targetShiftId}`)}
                  className="flex items-center gap-1 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                >
                  <ArrowRight size={14} />
                  חזרה לעבודה
                </button>
              )}
            </div>
          </section>
        )}

        {isAppendDemandMode && shift && shift.status !== 'active' && (
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
            <p className="text-sm text-gray-600">לא ניתן להוסיף הזמנות למשמרת סגורה</p>
          </section>
        )}

        {importSuccessMessage ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {importSuccessMessage}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <ImportEntryCard
            title="ייבוא יומי קיים"
            description="פתיחת גיליון הייבוא היומי עבור המשמרת והתאריך שנבחרו."
            actionLabel="פתיחת ייבוא יומי"
            disabled={!canMonthlyImport}
            disabledMessage="נדרשת משמרת פעילה עם הרשאת ייבוא כדי לבצע ייבוא יומי."
            onClick={() => setShowImportExcel(true)}
          />
          <ImportEntryCard
            title={hasExistingWork ? 'ייבוא הזמנות לתאריך נבחר - החלפת עבודה קיימת' : 'ייבוא הזמנות לתאריך נבחר'}
            description="בדיקת קובץ אקסל חודשי לפי תאריך נבחר לפני ייבוא."
            actionLabel={hasExistingWork ? 'פתיחת החלפת ייבוא לפי תאריך' : 'פתיחת ייבוא הזמנות לתאריך נבחר'}
            disabled={!canMonthlyImport}
            disabledMessage="נדרשת משמרת פעילה עם הרשאת ייבוא כדי לבצע ייבוא הזמנות."
            onClick={() => setShowMonthlyPreview(true)}
          />
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">טעינת קובץ בונדד</h2>
            <p className="text-sm text-gray-600">
              קובץ הבונדד אינו כולל תאריך, לכן הבלוק הזה כולל בחירת תאריך עבודה, העלאת קובץ, תצוגה מקדימה, פרסום ורשימת snapshots אחרונים.
            </p>
          </div>
          <BondedImportPanel shiftId={shift?.id ?? null} selectedDate={selectedDate} />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">ייבוא מלאי מחסן</h2>
            <p className="text-sm text-gray-600">
              העלאת קובץ אקסל עם גיליון מלאי, בדיקת נתונים, פרסום snapshot ורשימת snapshots אחרונים.
            </p>
          </div>
          <WarehouseStockImportPanel shiftId={shift?.id ?? null} selectedDate={selectedDate} />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" data-testid="datasheet-import-section">
          <div className="mb-4 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">ייבוא ביקוש גולמי מ-DataSheet</h2>
            <p className="text-sm text-gray-600">
              הנתונים יישמרו לתכנון לפי אזור הפצה ולא ייכנסו עדיין למשמרת
            </p>
          </div>
          <DatasheetImportPanel shiftId={shift?.id ?? null} appendTargetDate={isAppendDemandMode ? targetDate ?? null : null} />
        </section>
      </div>

      {showBondedSheet ? (
        <BondedImportSheet
          shiftId={shift?.id ?? null}
          selectedDate={selectedDate}
          onClose={() => setShowBondedSheet(false)}
        />
      ) : null}

      {showWarehouseStockSheet ? (
        <WarehouseStockImportSheet
          shiftId={shift?.id ?? null}
          selectedDate={selectedDate}
          onClose={() => setShowWarehouseStockSheet(false)}
        />
      ) : null}

      {showImportExcel && shift ? (
        <ImportExcelSheet
          shiftId={shift.id}
          selectedDate={selectedDate}
          onClose={() => setShowImportExcel(false)}
          onSuccess={({ linesCreated, ordersCreated }) => {
            setShowImportExcel(false);
            setImportSuccessMessage(`יובאו: ${linesCreated} קווים, ${ordersCreated} הזמנות`);
          }}
        />
      ) : null}

      {showMonthlyPreview && shift ? (
        <MonthlyImportPreviewSheet
          shiftId={shift.id}
          selectedDate={selectedDate}
          hasExistingWork={hasExistingWork}
          replaceSafety={replaceSafety ?? null}
          onClose={() => setShowMonthlyPreview(false)}
          onSuccess={({ linesCreated, ordersCreated, orderItemsCreated, excludedRowsCount }) => {
            const excluded = excludedRowsCount ? ` (${excludedRowsCount} שורות לא יובאו)` : '';
            setImportSuccessMessage(
              `ייבוא הזמנות הושלם: ${linesCreated} קווים, ${ordersCreated} הזמנות, ${orderItemsCreated} פריטים${excluded}`
            );
          }}
        />
      ) : null}
    </>
  );
}
