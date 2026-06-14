import * as XLSX from 'xlsx';
import type { ManualShiftMonthlyParsedRow, ParseManualShiftMonthlyPreviewInput } from '@wos/domain';
import { ApiError } from '../../errors.js';

const MONTHLY_MANUAL_SHIFT_SHEET_NAME = 'יוני 26';
const REQUIRED_HEADERS = [
  'תאריך הפצה',
  'קו הפצה',
  'שם לקוח',
  'הזמנה',
  "מק''ט",
  'כמות'
] as const;

type HeaderName = typeof REQUIRED_HEADERS[number] | 'תיאור' | 'קטגוריה' | 'הערות' | 'איזור הפצה';

function ensureWorkbookBuffer(buffer: Buffer) {
  const isZipContainer = buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b;

  if (!isZipContainer) {
    throw new ApiError(400, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
  }
}

function normalizeHeader(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeStringCell(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDistributionDate(
  rawValue: unknown,
  formattedValue: unknown
): Pick<ManualShiftMonthlyParsedRow, 'distributionDateRaw' | 'distributionDateNormalized'> {
  if (rawValue instanceof Date) {
    return {
      distributionDateRaw: rawValue,
      distributionDateNormalized: rawValue.toISOString().slice(0, 10)
    };
  }

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    const parsed = XLSX.SSF.parse_date_code(rawValue);
    if (parsed) {
      const year = parsed.y.toString().padStart(4, '0');
      const month = parsed.m.toString().padStart(2, '0');
      const day = parsed.d.toString().padStart(2, '0');
      return {
        distributionDateRaw: normalizeStringCell(formattedValue) ?? String(rawValue),
        distributionDateNormalized: `${year}-${month}-${day}`
      };
    }
  }

  const normalizedRaw = normalizeStringCell(formattedValue) ?? normalizeStringCell(rawValue);
  return {
    distributionDateRaw: normalizedRaw,
    distributionDateNormalized: null
  };
}

export function parseManualShiftMonthlyImportWorkbook(input: {
  fileName: string;
  buffer: Buffer;
}): Omit<ParseManualShiftMonthlyPreviewInput, 'selectedDate'> {
  ensureWorkbookBuffer(input.buffer);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(input.buffer, {
      type: 'buffer',
      cellDates: true,
      raw: true
    });
  } catch {
    throw new ApiError(400, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
  }

  const sheetName = workbook.SheetNames.find((name) => name.trim() === MONTHLY_MANUAL_SHIFT_SHEET_NAME);
  if (!sheetName) {
    throw new ApiError(400, 'MISSING_SHEET', `Workbook is missing required sheet ${MONTHLY_MANUAL_SHIFT_SHEET_NAME}.`);
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.['!ref']) {
    throw new ApiError(400, 'INVALID_WORKBOOK', 'Uploaded workbook sheet is empty.');
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headerIndexByName = new Map<HeaderName, number>();

  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: columnIndex });
    const header = normalizeHeader(sheet[cellAddress]?.w ?? sheet[cellAddress]?.v);
    if (!header) {
      continue;
    }
    headerIndexByName.set(header as HeaderName, columnIndex);
  }

  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!headerIndexByName.has(requiredHeader)) {
      throw new ApiError(400, 'MISSING_REQUIRED_HEADER', `Workbook is missing required header ${requiredHeader}.`);
    }
  }

  const rows: ManualShiftMonthlyParsedRow[] = [];

  for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
    let hasMeaningfulCell = false;
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[cellAddress];
      const normalized = normalizeStringCell(cell?.w ?? cell?.v);
      if (normalized !== null) {
        hasMeaningfulCell = true;
        break;
      }
    }

    if (!hasMeaningfulCell) {
      continue;
    }

    const getCell = (headerName: HeaderName) => {
      const columnIndex = headerIndexByName.get(headerName);
      if (columnIndex === undefined) {
        return null;
      }

      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      return sheet[cellAddress];
    };

    const distributionDateCell = getCell('תאריך הפצה');
    const normalizedDate = normalizeDistributionDate(
      distributionDateCell?.v,
      distributionDateCell?.w ?? distributionDateCell?.v
    );

    rows.push({
      rowIndex: rowIndex + 1,
      ...normalizedDate,
      rawDistributionValue: normalizeStringCell(getCell('קו הפצה')?.w ?? getCell('קו הפצה')?.v),
      customerName: normalizeStringCell(getCell('שם לקוח')?.w ?? getCell('שם לקוח')?.v),
      orderNumber: normalizeStringCell(getCell('הזמנה')?.w ?? getCell('הזמנה')?.v),
      sku: getCell("מק''ט")?.w ?? getCell("מק''ט")?.v ?? null,
      description: normalizeStringCell(getCell('תיאור')?.w ?? getCell('תיאור')?.v),
      category: normalizeStringCell(getCell('קטגוריה')?.w ?? getCell('קטגוריה')?.v),
      quantity: getCell('כמות')?.v ?? getCell('כמות')?.w ?? null,
      notes: normalizeStringCell(getCell('הערות')?.w ?? getCell('הערות')?.v),
      zone: normalizeStringCell(getCell('איזור הפצה')?.w ?? getCell('איזור הפצה')?.v)
    });
  }

  return {
    source: {
      fileName: input.fileName,
      sheetName
    },
    rows
  };
}
