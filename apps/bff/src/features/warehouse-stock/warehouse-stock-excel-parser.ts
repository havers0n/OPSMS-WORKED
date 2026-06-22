import * as XLSX from 'xlsx';
import {
  buildWarehouseStockPreview,
  type WarehouseStockSourceRow,
  type WarehouseStockSnapshotPreview
} from '@wos/domain';
import { ApiError } from '../../errors.js';

// ── Constants ─────────────────────────────────────────────────────────────

const WAREHOUSE_SHEET_NAME = 'מלאי';
const PIVOT_SHEET_NAME = 'PIVOT!';

// ── Header mapping ────────────────────────────────────────────────────────

const HEADER_ALIASES: Record<string, string[]> = {
  'מספר פריט': ['מספר פריט'],
  'תאור פריט': ['תאור פריט'],
  'קטגוריית מגוון': ['קטגוריית מגוון'],
  'כמות בהזמנה': ['כמות בהזמנה'],
  'כמות במחסן': ['כמות במחסן']
};

const ALL_CANONICAL_HEADERS = Object.keys(HEADER_ALIASES);
type CanonicalHeader = keyof typeof HEADER_ALIASES;

const REQUIRED_HEADERS: CanonicalHeader[] = ['מספר פריט', 'כמות במחסן'];

// ── Header normalization ──────────────────────────────────────────────────

function stripControlChars(s: string): string {
  return s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
}

function normalizeHeader(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s.length === 0) return null;
  s = stripControlChars(s);
  s = s.replace(/[''´`׳״""]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > 0 ? s : null;
}

function buildAliasLookup(): Map<string, CanonicalHeader> {
  const lookup = new Map<string, CanonicalHeader>();
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const norm = normalizeHeader(alias);
      if (norm && !lookup.has(norm)) {
        lookup.set(norm, canonical as CanonicalHeader);
      }
    }
  }
  return lookup;
}

const ALIAS_LOOKUP = buildAliasLookup();

// ── Cell readers ──────────────────────────────────────────────────────────

function readCellValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell) return undefined;
  return cell.v;
}

function readCellString(sheet: XLSX.WorkSheet, row: number, col: number): string | null {
  const raw = readCellValue(sheet, row, col);
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function readCellNumber(sheet: XLSX.WorkSheet, row: number, col: number): number | null {
  const raw = readCellValue(sheet, row, col);
  if (typeof raw === 'number' && isFinite(raw)) return raw;
  return null;
}

// ── Workbook validation ───────────────────────────────────────────────────

function ensureWorkbookBuffer(buffer: Buffer): void {
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) {
    throw new ApiError(422, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
  }
}

// ── Sheet selection ───────────────────────────────────────────────────────

function selectWarehouseSheet(workbook: XLSX.WorkBook): {
  sheetName: string;
  pivotSheetFound: boolean;
} {
  const sheetNames = workbook.SheetNames;
  const warehouseSheet = sheetNames.find(name => name.trim() === WAREHOUSE_SHEET_NAME);
  const pivotFound = sheetNames.some(name => name.trim() === PIVOT_SHEET_NAME);

  if (!warehouseSheet) {
    throw new ApiError(
      422,
      'MISSING_SHEET',
      `Workbook is missing required sheet "${WAREHOUSE_SHEET_NAME}". Available: ${sheetNames.join(', ') || '(none)'}.`,
      { expectedSheet: WAREHOUSE_SHEET_NAME, availableSheets: sheetNames }
    );
  }

  return { sheetName: warehouseSheet, pivotSheetFound: pivotFound };
}

// ── Header scanning ───────────────────────────────────────────────────────

function scanHeaders(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range
): Map<CanonicalHeader, number> {
  const headerIndexByName = new Map<CanonicalHeader, number>();

  for (let c = range.s.c; c <= range.e.c; c++) {
    const raw = readCellString(sheet, range.s.r, c);
    if (!raw) continue;

    const norm = normalizeHeader(raw);
    if (!norm) continue;

    const canonical = ALIAS_LOOKUP.get(norm);
    if (canonical && !headerIndexByName.has(canonical)) {
      headerIndexByName.set(canonical, c);
    }
  }

  const missing = REQUIRED_HEADERS.filter(h => !headerIndexByName.has(h));
  if (missing.length > 0) {
    throw new ApiError(
      422,
      'MISSING_REQUIRED_HEADER',
      `Workbook is missing required headers: ${missing.map(h => `"${h}"`).join(', ')}.`,
      { missingFields: missing }
    );
  }

  return headerIndexByName;
}

// ── Row parsing ───────────────────────────────────────────────────────────

function parseSourceRows(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range,
  headers: Map<CanonicalHeader, number>
): WarehouseStockSourceRow[] {
  const rows: WarehouseStockSourceRow[] = [];
  const h = (name: CanonicalHeader) => headers.get(name)!;

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const sku = readCellString(sheet, r, h('מספר פריט'));
    const description = readCellString(sheet, r, h('תאור פריט'));
    const category = readCellString(sheet, r, h('קטגוריית מגוון'));
    const warehouseQtyRaw = readCellNumber(sheet, r, h('כמות במחסן'));
    const sourceDemandQty = readCellNumber(sheet, r, h('כמות בהזמנה'));

    // Skip completely empty rows
    if (!sku && !description && !category && warehouseQtyRaw === null && sourceDemandQty === null) {
      continue;
    }

    rows.push({
      rowNumber: r + 1,
      sku,
      description,
      category,
      warehouseQtyRaw,
      sourceDemandQty
    });
  }

  return rows;
}

// ── Public API ─────────────────────────────────────────────────────────────

type ImportLogger = {
  info?: (data: Record<string, unknown>, message?: string) => void;
  warn?: (data: Record<string, unknown>, message?: string) => void;
  error?: (data: Record<string, unknown>, message?: string) => void;
};

export function parseWarehouseStockWorkbook(input: {
  fileName: string;
  buffer: Buffer;
  logger?: ImportLogger;
}): { preview: WarehouseStockSnapshotPreview; fileName: string; pivotSheetFound: boolean } {
  input.logger?.info?.(
    { fileName: input.fileName, bufferLength: input.buffer.length },
    'warehouse stock workbook parse started'
  );

  ensureWorkbookBuffer(input.buffer);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(input.buffer, {
      type: 'buffer',
      cellFormula: true,
      cellText: true,
      raw: false
    });
  } catch {
    throw new ApiError(422, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
  }

  // Sheet selection
  const { sheetName, pivotSheetFound } = selectWarehouseSheet(workbook);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.['!ref']) {
    throw new ApiError(422, 'EMPTY_SHEET', `Sheet "${sheetName}" contains no data.`);
  }

  input.logger?.info?.(
    { fileName: input.fileName, sheetName, pivotSheetFound },
    'warehouse stock workbook sheet selected'
  );

  const range = XLSX.utils.decode_range(sheet['!ref']);

  // Header scanning
  const headers = scanHeaders(sheet, range);

  // Parse source rows
  const sourceRows = parseSourceRows(sheet, range, headers);

  // Build preview with aggregation
  const preview = buildWarehouseStockPreview(sourceRows);

  input.logger?.info?.(
    {
      fileName: input.fileName,
      sheetName,
      sourceRowCount: sourceRows.length,
      uniqueSkuCount: preview.uniqueSkuCount,
      duplicateSkuRowsCount: preview.duplicateSkuRowsCount,
      missingSkuRowsCount: preview.missingSkuRowsCount,
      negativeStockRowsCount: preview.negativeStockRowsCount
    },
    'warehouse stock workbook parse done'
  );

  return { preview, fileName: input.fileName, pivotSheetFound };
}
