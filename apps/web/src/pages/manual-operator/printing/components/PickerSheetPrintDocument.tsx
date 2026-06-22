import type { PickerSheetPrintData } from '../types/printDtos';
import { PickerSheetWorkGroupBlock } from './PickerSheetWorkGroupBlock';

interface PickerSheetPrintDocumentProps {
  data: PickerSheetPrintData;
}

export function PickerSheetPrintDocument({ data }: PickerSheetPrintDocumentProps) {
  let globalIndex = 0;

  return (
    <>
      <h1>דף ליקוט — {data.shift}</h1>
      <div className="print-meta">
        <div>תאריך: {data.shiftDate}</div>
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
