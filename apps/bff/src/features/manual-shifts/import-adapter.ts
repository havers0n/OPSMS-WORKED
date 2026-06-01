import * as XLSX from 'xlsx';
import { ApiError } from '../../errors.js';
import type { RawManualShiftImport } from '@wos/domain';

const MANUAL_SHIFT_SHEET_NAME = 'סכימות';

function normalizeCellValue(value: XLSX.CellObject['v']): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

export function parseManualShiftImportWorkbook(input: {
  fileName: string;
  buffer: Buffer;
}): RawManualShiftImport {
  const isZipContainer = input.buffer.length >= 4 &&
    input.buffer[0] === 0x50 &&
    input.buffer[1] === 0x4b;
  if (!isZipContainer) {
    throw new ApiError(400, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(input.buffer, { type: 'buffer', cellText: true });
  } catch {
    throw new ApiError(400, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
  }

  const sheet = workbook.Sheets[MANUAL_SHIFT_SHEET_NAME];
  if (!sheet) {
    throw new ApiError(400, 'MISSING_SHEET', `Workbook is missing required sheet ${MANUAL_SHIFT_SHEET_NAME}.`);
  }

  const dateCell = sheet.C1;
  const dateRaw = normalizeCellValue(dateCell?.w ?? dateCell?.v);
  const dateExcelSerial = typeof dateCell?.v === 'number' ? dateCell.v : null;
  const rows: RawManualShiftImport['rows'] = [];

  for (let rowIndex = 4; rowIndex <= 2000; rowIndex += 1) {
    const cellRef = `B${rowIndex}` as const;
    const cellValue = normalizeCellValue(sheet[cellRef]?.v);
    if (!cellValue || cellValue.trim().length === 0) {
      continue;
    }
    rows.push({
      rowIndex,
      value: cellValue
    });
  }

  return {
    fileName: input.fileName,
    sheetName: MANUAL_SHIFT_SHEET_NAME,
    dateRaw,
    dateExcelSerial,
    rows
  };
}
