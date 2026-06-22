import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PickerSheetPrintDocument } from './PickerSheetPrintDocument';
import type { PickerSheetPrintData } from '../types/printDtos';

function formatPlanningDate(value: string): string {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/;
  const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  let parsed = new Date(value);

  const isoParts = value.match(isoMatch);
  if (isoParts) {
    parsed = new Date(`${isoParts[1]}-${isoParts[2]}-${isoParts[3]}T00:00:00.000Z`);
  } else {
    const slashParts = value.match(slashMatch);
    if (slashParts) {
      parsed = new Date(`${slashParts[3]}-${slashParts[2]}-${slashParts[1]}T00:00:00.000Z`);
    }
  }

  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(parsed);
}

function makeData(shiftDate: string): PickerSheetPrintData {
  return {
    shift: 'Morning Shift',
    scope: 'workGroup',
    shiftDate,
    distributionArea: 'גליל',
    generatedAt: '2026-06-22T10:00:00.000Z',
    totals: { lines: 1, workGroups: 1, items: 1 },
    planningLines: [
      {
        name: 'קו גליל',
        workGroups: [
          {
            name: 'כללי',
            items: [
              {
                sku: 'SKU-1',
                displaySku: 'SKU-1',
                description: 'מוצר',
                quantity: 1
              }
            ]
          }
        ]
      }
    ]
  };
}

describe('PickerSheetPrintDocument', () => {
  it('renders the same planning date in the title and meta for ISO dates', () => {
    const data = makeData('2026-06-11');
    const expectedDate = formatPlanningDate(data.shiftDate);

    render(<PickerSheetPrintDocument data={data} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`דף ליקוט — ${expectedDate}`);
    expect(screen.getByText(`תאריך: ${expectedDate}`)).toBeTruthy();
  });

  it('renders the same planning date in the title and meta for legacy slash dates', () => {
    const data = makeData('22/06/2026');
    const expectedDate = formatPlanningDate(data.shiftDate);

    render(<PickerSheetPrintDocument data={data} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`דף ליקוט — ${expectedDate}`);
    expect(screen.getByText(`תאריך: ${expectedDate}`)).toBeTruthy();
  });
});
