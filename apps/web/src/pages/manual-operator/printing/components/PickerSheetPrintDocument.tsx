import type { PickerSheetPrintData } from '../types/printDtos';
import { PickerSheetWorkGroupBlock } from './PickerSheetWorkGroupBlock';

interface PickerSheetPrintDocumentProps {
  data: PickerSheetPrintData;
}

const PIKER_SHEET_DATE_FORMATTER = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'Asia/Jerusalem',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

function parsePlanningDate(value: string): Date | null {
  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/;
  const slashDateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/;

  const isoParts = value.match(isoDateMatch);
  if (isoParts) {
    const parsed = new Date(`${isoParts[1]}-${isoParts[2]}-${isoParts[3]}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const slashParts = value.match(slashDateMatch);
  if (slashParts) {
    const parsed = new Date(`${slashParts[3]}-${slashParts[2]}-${slashParts[1]}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPlanningDate(value: string): string {
  const parsed = parsePlanningDate(value);
  return parsed ? PIKER_SHEET_DATE_FORMATTER.format(parsed) : value;
}

export function PickerSheetPrintDocument({ data }: PickerSheetPrintDocumentProps) {
  let globalIndex = 0;
  const planningDate = formatPlanningDate(data.shiftDate);

  return (
    <>
      <h1>דף ליקוט — {planningDate}</h1>
      <div className="print-meta">
        <div>תאריך: {planningDate}</div>
        <div>אזור הפצה: {data.distributionArea}</div>
        <div>נוצר בתאריך: {data.generatedAt}</div>
        <div>טווח: {data.scope === 'area' ? 'אזור' : data.scope === 'line' ? 'קו' : 'קבוצת עבודה'}</div>
      </div>

      {data.planningLines.map((line, li) => (
        line.workGroups.map((wg, wgi) => {
          const isFirst = globalIndex === 0;
          globalIndex++;
          return (
            <PickerSheetWorkGroupBlock
              key={`${li}-${wgi}`}
              workGroup={wg}
              scope={data.scope}
              lineName={line.name}
              isFirst={isFirst}
            />
          );
        })
      ))}
    </>
  );
}
