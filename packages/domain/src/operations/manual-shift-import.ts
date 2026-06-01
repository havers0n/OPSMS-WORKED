import { z } from 'zod';

export const manualShiftImportErrorCodeSchema = z.enum([
  'MISSING_SHEET',
  'MISSING_DATE',
  'INVALID_DATE',
  'EMPTY_IMPORT',
  'EMPTY_LINE_NAME',
  'EMPTY_ORDER_POINT_NAME',
  'ORPHAN_CHILD_ROW',
  'LINE_PREFIX_MISMATCH',
  'DUPLICATE_LINE',
  'DUPLICATE_CHILD_WITHIN_LINE'
]);
export type ManualShiftImportErrorCode = z.infer<typeof manualShiftImportErrorCodeSchema>;

export class ManualShiftImportError extends Error {
  readonly code: ManualShiftImportErrorCode;

  constructor(code: ManualShiftImportErrorCode, message: string) {
    super(message);
    this.name = 'ManualShiftImportError';
    this.code = code;
  }
}

export const rawManualShiftImportSchema = z.object({
  fileName: z.string().min(1),
  sheetName: z.string().min(1),
  dateRaw: z.string().nullable(),
  dateExcelSerial: z.number().finite().nullable().optional(),
  rows: z.array(z.object({
    rowIndex: z.number().int().min(1),
    value: z.string()
  }))
});
export type RawManualShiftImport = z.infer<typeof rawManualShiftImportSchema>;

export const dailyManualShiftImportPreviewSchema = z.object({
  fileName: z.string().min(1),
  sheetName: z.string().min(1),
  importDateRaw: z.string().min(1),
  importDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(z.object({
    name: z.string().min(1),
    rawLabel: z.string(),
    sourceRow: z.number().int().min(1),
    sortOrder: z.number().int().min(1),
    orders: z.array(z.object({
      pointName: z.string().min(1),
      rawLabel: z.string(),
      sourceRow: z.number().int().min(1),
      sortOrder: z.number().int().min(1)
    }))
  })),
  lineCount: z.number().int().min(0),
  orderCount: z.number().int().min(0)
});
export type DailyManualShiftImportPreview = z.infer<typeof dailyManualShiftImportPreviewSchema>;

function normalizeImportDate(dateRaw: string): string {
  const normalized = dateRaw.trim();
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/.exec(normalized);
  if (!match) {
    throw new ManualShiftImportError('INVALID_DATE', `Unsupported date format: ${dateRaw}`);
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = 2000 + Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day;

  if (!isValid) {
    throw new ManualShiftImportError('INVALID_DATE', `Invalid date value: ${dateRaw}`);
  }

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function normalizeImportDateFromExcelSerial(serial: number): string {
  if (!Number.isFinite(serial)) {
    throw new ManualShiftImportError('INVALID_DATE', `Invalid Excel date serial: ${serial}`);
  }

  const wholeDays = Math.floor(serial);
  if (wholeDays <= 0) {
    throw new ManualShiftImportError('INVALID_DATE', `Invalid Excel date serial: ${serial}`);
  }

  // Excel 1900 system serial date -> UTC date, with 1900 leap-year bug compensation for serial >= 60.
  const days = wholeDays >= 60 ? wholeDays - 1 : wholeDays;
  const epoch = Date.UTC(1899, 11, 31);
  const millis = epoch + days * 24 * 60 * 60 * 1000;
  const date = new Date(millis);

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function parseDailyManualShiftImport(rawInput: RawManualShiftImport): DailyManualShiftImportPreview {
  const raw = rawManualShiftImportSchema.parse(rawInput);
  if (raw.sheetName !== 'סכימות') {
    throw new ManualShiftImportError('MISSING_SHEET', 'Workbook is missing required sheet סכימות');
  }
  if (!raw.dateRaw || raw.dateRaw.trim().length === 0) {
    throw new ManualShiftImportError('MISSING_DATE', 'Workbook date C1 is empty');
  }

  const importDateRaw = raw.dateRaw;
  let importDate: string;
  try {
    importDate = normalizeImportDate(raw.dateRaw);
  } catch (error) {
    if (
      error instanceof ManualShiftImportError &&
      error.code === 'INVALID_DATE' &&
      raw.dateExcelSerial !== null &&
      raw.dateExcelSerial !== undefined
    ) {
      importDate = normalizeImportDateFromExcelSerial(raw.dateExcelSerial);
    } else {
      throw error;
    }
  }
  const lines: DailyManualShiftImportPreview['lines'] = [];
  const lineNameSet = new Set<string>();
  let activeLine: DailyManualShiftImportPreview['lines'][number] | null = null;
  let orderCount = 0;

  for (const row of raw.rows) {
    const label = row.value.trim();
    if (label.length === 0) {
      continue;
    }

    const slashIndex = label.indexOf('/');
    if (slashIndex < 0) {
      const lineName = label;
      if (!lineName) {
        throw new ManualShiftImportError('EMPTY_LINE_NAME', `Line name is empty at row ${row.rowIndex}`);
      }
      if (lineNameSet.has(lineName)) {
        throw new ManualShiftImportError('DUPLICATE_LINE', `Duplicate line ${lineName} at row ${row.rowIndex}`);
      }
      lineNameSet.add(lineName);
      activeLine = {
        name: lineName,
        rawLabel: row.value,
        sourceRow: row.rowIndex,
        sortOrder: lines.length + 1,
        orders: []
      };
      lines.push(activeLine);
      continue;
    }

    if (!activeLine) {
      throw new ManualShiftImportError('ORPHAN_CHILD_ROW', `Child row without active line at row ${row.rowIndex}`);
    }

    const parentPart = label.slice(0, slashIndex).trim();
    const childPart = label.slice(slashIndex + 1).trim();

    if (parentPart !== activeLine.name) {
      throw new ManualShiftImportError(
        'LINE_PREFIX_MISMATCH',
        `Child row parent ${parentPart} does not match active line ${activeLine.name} at row ${row.rowIndex}`
      );
    }
    if (!childPart) {
      throw new ManualShiftImportError('EMPTY_ORDER_POINT_NAME', `Empty order point at row ${row.rowIndex}`);
    }
    if (activeLine.orders.some((order) => order.pointName === childPart)) {
      throw new ManualShiftImportError(
        'DUPLICATE_CHILD_WITHIN_LINE',
        `Duplicate child ${childPart} in line ${activeLine.name} at row ${row.rowIndex}`
      );
    }

    activeLine.orders.push({
      pointName: childPart,
      rawLabel: row.value,
      sourceRow: row.rowIndex,
      sortOrder: activeLine.orders.length + 1
    });
    orderCount += 1;
  }

  if (lines.length === 0 || orderCount === 0) {
    throw new ManualShiftImportError('EMPTY_IMPORT', 'No importable line/order rows found');
  }

  return dailyManualShiftImportPreviewSchema.parse({
    fileName: raw.fileName,
    sheetName: raw.sheetName,
    importDateRaw,
    importDate,
    lines,
    lineCount: lines.length,
    orderCount
  });
}
