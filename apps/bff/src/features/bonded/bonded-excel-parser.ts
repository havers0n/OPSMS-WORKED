import * as XLSX from 'xlsx';
import {
  buildBondedSnapshotDraftRow,
  buildSnapshotDiagnostics,
  type BondedSnapshotDraft,
  type BondedSnapshotDraftRow
} from '@wos/domain';
import { ApiError } from '../../errors.js';

// ── Constants ─────────────────────────────────────────────────────────────

const BONDED_SHEET_NAME = 'בונדד!';
const PIVOT_SHEET_NAME = 'PIVOT!';

// ── Header mapping ────────────────────────────────────────────────────────

const HEADER_ALIASES: Record<string, string[]> = {
  'עמודה7': ['עמודה7'],
  'גוש': ['גוש'],
  'פריט': ['פריט'],
  'תיאור חדש': ['תיאור חדש'],
  'כמות משוחררת': ['כמות משוחררת'],
  'גורם אירוז': ['גורם אירוז'],
  'כמות קרטונים במשטח': ['כמות קרטונים במשטח'],
  "יח' במשטח": ["יח' במשטח", 'יח במשטח'],
  'עמודה1': ['עמודה1'],
  'עמודה2': ['עמודה2'],
  'עמודה3': ['עמודה3'],
  'עמודה4': ['עמודה4'],
  'עמודה5': ['עמודה5'],
  'עמודה6': ['עמודה6'],
  'משיכה7': ['משיכה7'],
  'משיכה8': ['משיכה8'],
  'משיכה9': ['משיכה9'],
  'סה"כ נמשך': ['סה"כ נמשך', 'סה״כ נמשך', 'סהכ נמשך'],
  'יתרה משוחררת': ['יתרה משוחררת'],
  'הערות': ['הערות'],
  'נותר בונדד': ['נותר בונדד']
};

const ALL_CANONICAL_HEADERS = Object.keys(HEADER_ALIASES);
type CanonicalHeader = keyof typeof HEADER_ALIASES;

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

function readCellFormula(sheet: XLSX.WorkSheet, row: number, col: number): string | null {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  return cell?.f ?? null;
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

function readCellNumberOrZero(sheet: XLSX.WorkSheet, row: number, col: number): number {
  return readCellNumber(sheet, row, col) ?? 0;
}

// ── Workbook validation ───────────────────────────────────────────────────

function ensureWorkbookBuffer(buffer: Buffer): void {
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) {
    throw new ApiError(422, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
  }
}

// ── Sheet selection ───────────────────────────────────────────────────────

function selectBondedSheet(workbook: XLSX.WorkBook): {
  sheetName: string;
  pivotSheetFound: boolean;
} {
  const sheetNames = workbook.SheetNames;
  const bondedSheet = sheetNames.find(name => name.trim() === BONDED_SHEET_NAME);
  const pivotFound = sheetNames.some(name => name.trim() === PIVOT_SHEET_NAME);

  if (!bondedSheet) {
    throw new ApiError(
      422,
      'MISSING_SHEET',
      `Workbook is missing required sheet "${BONDED_SHEET_NAME}". Available: ${sheetNames.join(', ') || '(none)'}.`,
      { expectedSheet: BONDED_SHEET_NAME, availableSheets: sheetNames }
    );
  }

  return { sheetName: bondedSheet, pivotSheetFound: pivotFound };
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

  const missing = ALL_CANONICAL_HEADERS.filter(h => !headerIndexByName.has(h));
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

function hasAnyCell(sheet: XLSX.WorkSheet, row: number, cols: number[]): boolean {
  for (const c of cols) {
    const v = readCellString(sheet, row, c);
    if (v !== null) return true;
  }
  return false;
}

function parseRow(
  sheet: XLSX.WorkSheet,
  rowIndex: number,
  headers: Map<CanonicalHeader, number>
): BondedSnapshotDraftRow | null {
  const h = (name: CanonicalHeader) => headers.get(name)!;

  // SKU check — if all meaningful columns are empty, skip row
  const skuRaw = readCellString(sheet, rowIndex, h('פריט'));
  const releasedQty = readCellNumber(sheet, rowIndex, h('כמות משוחררת'));
  const gushRaw = readCellString(sheet, rowIndex, h('גוש'));

  if (!skuRaw && !releasedQty && !gushRaw) {
    const meaningfulCols = [
      h('עמודה7'), h('תיאור חדש'), h('גורם אירוז'),
      h('כמות קרטונים במשטח'), h("יח' במשטח"),
      h('עמודה1'), h('עמודה2'), h('עמודה3'), h('עמודה4'),
      h('עמודה5'), h('עמודה6'), h('משיכה7'), h('משיכה8'), h('משיכה9'),
      h('סה"כ נמשך'), h('יתרה משוחררת'), h('הערות'), h('נותר בונדד')
    ];
    if (!hasAnyCell(sheet, rowIndex, meaningfulCols)) {
      return null;
    }
  }

  // Read pull columns (עמודה1-6, משיכה7-9)
  const pullCols: CanonicalHeader[] = [
    'עמודה1', 'עמודה2', 'עמודה3', 'עמודה4', 'עמודה5', 'עמודה6',
    'משיכה7', 'משיכה8', 'משיכה9'
  ];
  const pullValues: (number | null)[] = pullCols.map(pc => readCellNumber(sheet, rowIndex, h(pc)));

  // Core numeric fields
  const totalPulledQty = readCellNumberOrZero(sheet, rowIndex, h('סה"כ נמשך'));
  const rawReleasedBalance = readCellNumber(sheet, rowIndex, h('יתרה משוחררת'));

  // Remaining bonded raw text
  const remainingBonded = readCellString(sheet, rowIndex, h('נותר בונדד'));

  // Build row
  return buildBondedSnapshotDraftRow({
    rowNumber: rowIndex + 1,
    sourceLabel: readCellString(sheet, rowIndex, h('עמודה7')),
    block: gushRaw,
    sku: skuRaw,
    description: readCellString(sheet, rowIndex, h('תיאור חדש')),
    releasedQty: releasedQty ?? 0,
    packFactor: readCellNumber(sheet, rowIndex, h('גורם אירוז')),
    cartonsPerPallet: readCellNumber(sheet, rowIndex, h('כמות קרטונים במשטח')),
    unitsPerPallet: readCellNumber(sheet, rowIndex, h("יח' במשטח")),
    pullColumns: pullValues,
    totalPulledQty,
    notes: readCellString(sheet, rowIndex, h('הערות')),
    remainingBondedRaw: remainingBonded,
    rawReleasedBalanceCellValue: rawReleasedBalance
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

type ImportLogger = {
  info?: (data: Record<string, unknown>, message?: string) => void;
  warn?: (data: Record<string, unknown>, message?: string) => void;
  error?: (data: Record<string, unknown>, message?: string) => void;
};

export function parseBondedWorkbook(input: {
  fileName: string;
  buffer: Buffer;
  logger?: ImportLogger;
}): BondedSnapshotDraft {
  input.logger?.info?.(
    { fileName: input.fileName, bufferLength: input.buffer.length },
    'bonded workbook parse started'
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
  const { sheetName, pivotSheetFound } = selectBondedSheet(workbook);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.['!ref']) {
    throw new ApiError(422, 'EMPTY_SHEET', `Sheet "${sheetName}" contains no data.`);
  }

  input.logger?.info?.(
    { fileName: input.fileName, sheetName, pivotSheetFound },
    'bonded workbook sheet selected'
  );

  const range = XLSX.utils.decode_range(sheet['!ref']);

  // Header scanning
  const headers = scanHeaders(sheet, range);

  // Row parsing
  const rows: BondedSnapshotDraftRow[] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row = parseRow(sheet, r, headers);
    if (row) {
      rows.push(row);
    }
  }

  // Diagnostics
  const diagnostics = buildSnapshotDiagnostics(rows);

  input.logger?.info?.(
    {
      fileName: input.fileName,
      sheetName,
      rowCount: rows.length,
      totalRows: diagnostics.totalRows,
      missingSkuRows: diagnostics.missingSkuRows,
      negativeBalanceRows: diagnostics.negativeBalanceRows
    },
    'bonded workbook parse done'
  );

  return {
    sourceSheetName: sheetName,
    rowCount: rows.length,
    rows,
    diagnostics
  };
}
