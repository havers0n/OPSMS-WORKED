import type { ManualShiftOrder } from '@wos/domain';

const STATUS_LABELS: Record<string, string> = {
  queued: 'בתור',
  picking: 'בליקוט',
  waiting_check: 'ממתין לבדיקה',
  returned: 'הוחזר לתיקון',
  done: 'הסתיים'
};

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportShiftOrdersCSV(
  orders: ManualShiftOrder[],
  lineNameMap: Map<string, string>,
  shiftName: string
): void {
  const headers = ['קו', 'נקודה', 'קוד', 'מלקט', 'מספר שורות', 'מספר משטחים', 'גודל', 'סטטוס', 'הערה'];

  const rows = orders.map(o =>
    [
      escapeCsvCell(lineNameMap.get(o.lineId) ?? ''),
      escapeCsvCell(o.pointName),
      escapeCsvCell(o.orderNumber),
      escapeCsvCell(o.pickerName),
      escapeCsvCell(o.lineCount),
      escapeCsvCell(o.palletCount),
      escapeCsvCell(o.size === 'unknown' ? '' : o.size),
      escapeCsvCell(STATUS_LABELS[o.status] ?? o.status),
      escapeCsvCell(o.comment)
    ].join(',')
  );

  const content = [headers.join(','), ...rows].join('\n');
  const bom = '﻿'; // UTF-8 BOM for Excel Hebrew support
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${shiftName || 'shift'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
