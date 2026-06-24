import * as XLSX from 'xlsx';
import type { DemandImportDataSheetParsedRow } from '@wos/domain';
import { ApiError } from '../../errors.js';

const DATASHEET_SHEET_NAME = 'DataSheet';

const REQUIRED_HEADER_ALIASES: Record<string, string[]> = {
  'סוכן': ['סוכן'],
  'תאריך הזמנה': ['תאריך הזמנה'],
  'שם לקוח': ['שם לקוח'],
  'הזמנה': ['הזמנה'],
  'מק"ט': ["מק''ט", 'מק"ט', 'מק״ט', "מק'ט", 'מקט'],
  'תיאור': ['תיאור'],
  'קטגוריה': ['קטגוריה'],
  'כמות': ['כמות'],
  'שווי': ['שווי'],
  'קו הפצה': ['קו הפצה'],
  'תאריך הפצה': ['תאריך הפצה'],
  'הערות': ['הערות'],
  'איזור הפצה': ['איזור הפצה']
};

type CanonicalHeaderName = keyof typeof REQUIRED_HEADER_ALIASES;

function ensureWorkbookBuffer(buffer: Buffer) {
  const isZipContainer = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZipContainer) {
    throw new ApiError(422, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
  }
}

function normalizeHeaderForComparison(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw)
    .trim()
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[''´`׳״"]/g, '')
    .replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

function normalizeStringCell(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim();
  return normalized.length > 0 ? normalized : null;
}

function buildAliasLookup() {
  const lookup = new Map<string, CanonicalHeaderName>();
  for (const [canonical, aliases] of Object.entries(REQUIRED_HEADER_ALIASES)) {
    for (const alias of aliases) {
      const normalized = normalizeHeaderForComparison(alias);
      if (normalized) {
        lookup.set(normalized, canonical as CanonicalHeaderName);
      }
    }
  }
  return lookup;
}

const HEADER_LOOKUP = buildAliasLookup();

export function parseDemandImportDataSheetWorkbook(input: {
  fileName: string;
  buffer: Buffer;
}): {
  sourceFile: string;
  sourceSheet: 'DataSheet';
  rows: DemandImportDataSheetParsedRow[];
} {
  ensureWorkbookBuffer(input.buffer);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(input.buffer, {
      type: 'buffer',
      cellDates: true,
      raw: true
    });
  } catch {
    throw new ApiError(422, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
  }

  const sheetName = workbook.SheetNames.find((name) => name === DATASHEET_SHEET_NAME);
  if (!sheetName) {
    throw new ApiError(422, 'MISSING_SHEET', `Workbook is missing required sheet ${DATASHEET_SHEET_NAME}.`, {
      expectedSheet: DATASHEET_SHEET_NAME,
      availableSheets: workbook.SheetNames
    });
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.['!ref']) {
    throw new ApiError(422, 'EMPTY_IMPORT', 'Workbook DataSheet is empty.');
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headerIndexByName = new Map<CanonicalHeaderName, number>();
  const availableHeaders: string[] = [];

  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: columnIndex });
    const raw = sheet[cellAddress]?.w ?? sheet[cellAddress]?.v;
    if (raw === null || raw === undefined) continue;
    availableHeaders.push(String(raw));

    const normalized = normalizeHeaderForComparison(raw);
    if (!normalized) continue;
    const canonical = HEADER_LOOKUP.get(normalized);
    if (canonical && !headerIndexByName.has(canonical)) {
      headerIndexByName.set(canonical, columnIndex);
    }
  }

  const missingHeaders = (Object.keys(REQUIRED_HEADER_ALIASES) as CanonicalHeaderName[])
    .filter((header) => !headerIndexByName.has(header));

  if (missingHeaders.length > 0) {
    throw new ApiError(422, 'MISSING_REQUIRED_HEADER', `Workbook is missing required headers: ${missingHeaders.join(', ')}.`, {
      missingFields: missingHeaders,
      availableHeaders,
      expectedSheet: DATASHEET_SHEET_NAME
    });
  }

  const rows: DemandImportDataSheetParsedRow[] = [];
  for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
    let hasMeaningfulCell = false;
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[cellAddress];
      if (normalizeStringCell(cell?.w ?? cell?.v) !== null) {
        hasMeaningfulCell = true;
        break;
      }
    }

    if (!hasMeaningfulCell) continue;

    const getCell = (headerName: CanonicalHeaderName) => {
      const columnIndex = headerIndexByName.get(headerName);
      if (columnIndex === undefined) return null;
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      return sheet[cellAddress] ?? null;
    };

    rows.push({
      sourceRowNumber: rowIndex + 1,
      agent: normalizeStringCell(getCell('סוכן')?.w ?? getCell('סוכן')?.v),
      orderDateRaw: (getCell('תאריך הזמנה')?.v ?? getCell('תאריך הזמנה')?.w) as string | Date | null | undefined,
      customerName: normalizeStringCell(getCell('שם לקוח')?.w ?? getCell('שם לקוח')?.v),
      orderNumber: getCell('הזמנה')?.w ?? getCell('הזמנה')?.v ?? null,
      sku: getCell('מק"ט')?.w ?? getCell('מק"ט')?.v ?? null,
      description: normalizeStringCell(getCell('תיאור')?.w ?? getCell('תיאור')?.v),
      category: normalizeStringCell(getCell('קטגוריה')?.w ?? getCell('קטגוריה')?.v),
      quantity: getCell('כמות')?.v ?? getCell('כמות')?.w ?? null,
      cost: getCell('שווי')?.v ?? getCell('שווי')?.w ?? null,
      rawRouteLine: normalizeStringCell(getCell('קו הפצה')?.w ?? getCell('קו הפצה')?.v),
      plannedDeliveryDateRaw: ((getCell('תאריך הפצה')?.v ?? getCell('תאריך הפצה')?.w) ?? null) as string | Date | null,
      notes: normalizeStringCell(getCell('הערות')?.w ?? getCell('הערות')?.v),
      distributionArea: normalizeStringCell(getCell('איזור הפצה')?.w ?? getCell('איזור הפצה')?.v)
    });
  }

  if (rows.length === 0) {
    throw new ApiError(422, 'EMPTY_IMPORT', 'Workbook DataSheet does not contain any importable rows.');
  }

  return {
    sourceFile: input.fileName,
    sourceSheet: 'DataSheet',
    rows
  };
}
