import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ManualShiftSession } from '@wos/domain';
import { monthlyReplaceSafetyQueryOptions } from '@/entities/manual-shift/api/queries';
import { BondedImportPanel } from './bonded-import-panel';
import { BondedImportSheet } from './bonded-import-sheet';
import { WarehouseStockImportPanel } from './warehouse-stock-import-panel';
import { WarehouseStockImportSheet } from './warehouse-stock-import-sheet';
import { ImportExcelSheet } from './import-excel-sheet';
import { MonthlyImportPreviewSheet } from './monthly-import-preview-sheet';

interface ManualOperatorImportSectionProps {
  shift: ManualShiftSession | null;
  selectedDate: string;
  canMonthlyImport: boolean;
  hasExistingWork: boolean;
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
  hasExistingWork
}: ManualOperatorImportSectionProps) {
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
            title={hasExistingWork ? 'ייבוא חודשי והחלפת עבודה קיימת' : 'תצוגה מקדימה חודשית'}
            description="בדיקת קובץ אקסל חודשי לפני ייבוא או החלפת עבודה קיימת."
            actionLabel={hasExistingWork ? 'פתיחת החלפה חודשית' : 'פתיחת תצוגה חודשית'}
            disabled={!canMonthlyImport}
            disabledMessage="נדרשת משמרת פעילה עם הרשאת ייבוא כדי לבצע ייבוא חודשי."
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
          onSuccess={({ linesCreated, ordersCreated, orderItemsCreated }) => {
            setImportSuccessMessage(
              `ייבוא חודשי הושלם: ${linesCreated} קווים, ${ordersCreated} הזמנות, ${orderItemsCreated} פריטים`
            );
          }}
        />
      ) : null}
    </>
  );
}
