import * as XLSX from 'xlsx';
import type { ManualShiftMonthlyParsedRow, ParseManualShiftMonthlyPreviewInput } from '@wos/domain';
import { ApiError } from '../../errors.js';

// ── Hebrew month names ──────────────────────────────────────────────────────────

const HEBREW_MONTH_NAMES: Record<number, string> = {
  5: 'מאי',
  6: 'יוני',
  7: 'יולי',
  8: 'אוגוסט',
};

const MONTHLY_MANUAL_SHIFT_SHEET_NAME = 'יוני 26';

// ── Header aliases ──────────────────────────────────────────────────────────────
// Canonical header → list of accepted raw variants in workbooks

const REQUIRED_HEADER_ALIASES: Record<string, string[]> = {
  'תאריך הפצה': ['תאריך הפצה'],
  'קו הפצה': ['קו הפצה'],
  'שם לקוח': ['שם לקוח'],
  'הזמנה': ['הזמנה'],
  'מק"ט': ["מק''ט", 'מק"ט', 'מק״ט', "מק'ט", 'מקט'],
  'כמות': ['כמות'],
};

const OPTIONAL_HEADER_ALIASES: Record<string, string[]> = {
  'תיאור': ['תיאור'],
  'קטגוריה': ['קטגוריה'],
  'הערות': ['הערות'],
  'איזור הפצה': ['איזור הפצה'],
};

const ALL_HEADER_ALIASES: Record<string, string[]> = {
  ...REQUIRED_HEADER_ALIASES,
  ...OPTIONAL_HEADER_ALIASES,
};

type CanonicalHeaderName = keyof typeof ALL_HEADER_ALIASES;

const REQUIRED_CANONICAL_HEADERS = Object.keys(REQUIRED_HEADER_ALIASES) as CanonicalHeaderName[];

// ── Header normalization ────────────────────────────────────────────────────────

function stripControlChars(s: string): string {
  return s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
}

function normalizeHeaderForComparison(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s.length === 0) return null;

  s = stripControlChars(s);
  // Remove all quote/geresh/gershayim variants for comparison matching
  s = s.replace(/[''´`׳״""]/g, '');
  s = s.replace(/\s+/g, ' ').trim();

  return s.length > 0 ? s : null;
}

function normalizeStringCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

// ── Alias lookup ────────────────────────────────────────────────────────────────

function buildAliasLookup(): Map<string, CanonicalHeaderName> {
  const lookup = new Map<string, CanonicalHeaderName>();
  for (const [canonical, aliases] of Object.entries(ALL_HEADER_ALIASES)) {
    for (const alias of aliases) {
      const normalized = normalizeHeaderForComparison(alias);
      if (normalized && !lookup.has(normalized)) {
        lookup.set(normalized, canonical as CanonicalHeaderName);
      }
    }
  }
  return lookup;
}

const ALIAS_LOOKUP = buildAliasLookup();

// ── Sheet selection ─────────────────────────────────────────────────────────────

function deriveExpectedSheetName(selectedDate: string): string | null {
  const date = new Date(selectedDate + 'T00:00:00Z');
  if (isNaN(date.getTime())) return null;
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear() % 100;
  const hebrewName = HEBREW_MONTH_NAMES[month];
  if (!hebrewName) return null;
  return `${hebrewName} ${year}`;
}

function selectMonthlySheet(
  sheetNames: string[],
  selectedDate: string | undefined,
): { sheetName: string; matchStrategy: 'date-derived' | 'exact-canonical' | 'single-sheet' | 'month-fuzzy' } | null {
  if (sheetNames.length === 0) return null;

  if (selectedDate) {
    const expected = deriveExpectedSheetName(selectedDate);
    if (expected) {
      const match = sheetNames.find(name => name.trim() === expected);
      if (match) return { sheetName: match, matchStrategy: 'date-derived' };
    }
  }

  const exactMatch = sheetNames.find(name => name.trim() === MONTHLY_MANUAL_SHIFT_SHEET_NAME);
  if (exactMatch) return { sheetName: exactMatch, matchStrategy: 'exact-canonical' };

  if (sheetNames.length === 1) return { sheetName: sheetNames[0], matchStrategy: 'single-sheet' };

  const hebrewMonths = Object.values(HEBREW_MONTH_NAMES);
  const monthMatch = sheetNames.find(name => {
    const trimmed = name.trim();
    return hebrewMonths.some(month => trimmed.startsWith(month) && /\s+\d{1,2}$/.test(trimmed));
  });
  if (monthMatch) return { sheetName: monthMatch, matchStrategy: 'month-fuzzy' };

  return null;
}

type ImportLogger = {
  info: (data: Record<string, unknown>, message?: string) => void;
  warn?: (data: Record<string, unknown>, message?: string) => void;
  error?: (data: Record<string, unknown>, message?: string) => void;
};

// ── Error helpers ───────────────────────────────────────────────────────────────

function failMissingSheet(
  input: { fileName: string; selectedDate?: string; logger?: ImportLogger },
  sheetNames: string[],
): never {
  let expectedSheet: string | null = null;
  if (input.selectedDate) {
    expectedSheet = deriveExpectedSheetName(input.selectedDate);
  }
  expectedSheet ??= MONTHLY_MANUAL_SHIFT_SHEET_NAME;

  const details = {
    expectedSheet,
    availableSheets: sheetNames,
    importKind: 'monthly' as const,
    selectedDate: input.selectedDate ?? null,
  };

  input.logger?.warn?.(
    { fileName: input.fileName, ...details },
    'monthly manual shift workbook sheet missing'
  );

  throw new ApiError(
    422,
    'MISSING_SHEET',
    `Workbook is missing required monthly sheet. Expected "${expectedSheet}". Available: ${sheetNames.join(', ') || '(none)'}.`,
    details
  );
}

function ensureWorkbookBuffer(buffer: Buffer) {
  const isZipContainer = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZipContainer) {
    throw new ApiError(422, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
  }
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
  selectedDate?: string;
  logger?: ImportLogger;
}): Omit<ParseManualShiftMonthlyPreviewInput, 'selectedDate'> {
  input.logger?.info(
    {
      fileName: input.fileName,
      bufferLength: input.buffer.length,
    },
    'monthly manual shift workbook parse started'
  );

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

  // ── Sheet selection ────────────────────────────────────────────────────────────
  const sheetSelection = selectMonthlySheet(workbook.SheetNames, input.selectedDate);
  if (!sheetSelection) {
    failMissingSheet(input, workbook.SheetNames);
  }

  const { sheetName, matchStrategy } = sheetSelection;
  const isExactSheetMatch = matchStrategy === 'date-derived' || matchStrategy === 'exact-canonical';

  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.['!ref']) {
    failMissingSheet(input, workbook.SheetNames);
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  if (!isExactSheetMatch && range.e.c - range.s.c + 1 < 2) {
    failMissingSheet(input, workbook.SheetNames);
  }

  input.logger?.info(
    { fileName: input.fileName, sheetName, matchStrategy },
    'monthly manual shift workbook sheet selected'
  );

  // ── Header scanning ────────────────────────────────────────────────────────────
  const headerIndexByName = new Map<CanonicalHeaderName, number>();
  const rawHeadersFound: string[] = [];

  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: columnIndex });
    const raw = sheet[cellAddress]?.w ?? sheet[cellAddress]?.v;
    if (raw === null || raw === undefined) continue;

    rawHeadersFound.push(String(raw));

    const normalizedKey = normalizeHeaderForComparison(raw);
    if (!normalizedKey) continue;

    const canonical = ALIAS_LOOKUP.get(normalizedKey);
    if (canonical && !headerIndexByName.has(canonical)) {
      headerIndexByName.set(canonical, columnIndex);
    }
  }

  // ── Required header check ──────────────────────────────────────────────────────
  const missingHeaders = REQUIRED_CANONICAL_HEADERS.filter(h => !headerIndexByName.has(h));

  if (missingHeaders.length > 0) {
    const details = {
      missingFields: missingHeaders,
      acceptedAliases: Object.fromEntries(
        missingHeaders.map(h => [h, REQUIRED_HEADER_ALIASES[h] ?? [h]])
      ),
      availableHeaders: rawHeadersFound,
      sheetName,
    };

    input.logger?.warn?.(
      { fileName: input.fileName, ...details },
      'monthly manual shift workbook missing required headers'
    );

    throw new ApiError(
      422,
      'MISSING_REQUIRED_HEADER',
      `Workbook is missing required headers: ${missingHeaders.map(h => `"${h}"`).join(', ')}. ` +
      `Available headers: ${rawHeadersFound.join(', ') || '(none detected)'}.`,
      details
    );
  }

  // ── Row parsing ────────────────────────────────────────────────────────────────
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

    const getCell = (headerName: CanonicalHeaderName) => {
      const columnIndex = headerIndexByName.get(headerName);
      if (columnIndex === undefined) return null;
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
      sku: getCell('מק"ט')?.w ?? getCell('מק"ט')?.v ?? null,
      description: normalizeStringCell(getCell('תיאור')?.w ?? getCell('תיאור')?.v),
      category: normalizeStringCell(getCell('קטגוריה')?.w ?? getCell('קטגוריה')?.v),
      quantity: getCell('כמות')?.v ?? getCell('כמות')?.w ?? null,
      notes: normalizeStringCell(getCell('הערות')?.w ?? getCell('הערות')?.v),
      zone: normalizeStringCell(getCell('איזור הפצה')?.w ?? getCell('איזור הפצה')?.v)
    });
  }

  if (rows.length === 0) {
    throw new ApiError(422, 'EMPTY_IMPORT', 'Workbook does not contain any importable monthly rows.');
  }

  input.logger?.info(
    { fileName: input.fileName, sheetName, rowCount: rows.length },
    'monthly manual shift workbook parse done'
  );

  return {
    source: { fileName: input.fileName, sheetName },
    rows
  };
}
