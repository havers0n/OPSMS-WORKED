import * as XLSX from 'xlsx';
import type { ManualShiftMonthlyParsedRow, ParseManualShiftMonthlyPreviewInput } from '@wos/domain';
import { ApiError } from '../../errors.js';

const MONTHLY_MANUAL_SHIFT_SHEET_NAME = 'Ч™Ч•Ч Ч™ 26';
const REQUIRED_HEADERS = [
  'ЧЄЧђЧЁЧ™Чљ Ч”Ч¤Ч¦Ч”',
  'Ч§Ч• Ч”Ч¤Ч¦Ч”',
  'Ч©Чќ ЧњЧ§Ч•Ч—',
  'Ч”Ч–ЧћЧ Ч”',
  "ЧћЧ§''Ч",
  'Ч›ЧћЧ•ЧЄ'
] as const;

type HeaderName = typeof REQUIRED_HEADERS[number] | 'ЧЄЧ™ЧђЧ•ЧЁ' | 'Ч§ЧЧ’Ч•ЧЁЧ™Ч”' | 'Ч”ЧўЧЁЧ•ЧЄ' | 'ЧђЧ™Ч–Ч•ЧЁ Ч”Ч¤Ч¦Ч”';

const FALLBACK_MONTHLY_COLUMN_INDEX: Record<HeaderName, number> = {
  'ЧЄЧђЧЁЧ™Чљ Ч”Ч¤Ч¦Ч”': 8,
  'Ч§Ч• Ч”Ч¤Ч¦Ч”': 7,
  'Ч©Чќ ЧњЧ§Ч•Ч—': 1,
  'Ч”Ч–ЧћЧ Ч”': 2,
  "ЧћЧ§''Ч": 3,
  'Ч›ЧћЧ•ЧЄ': 6,
  'ЧЄЧ™ЧђЧ•ЧЁ': 4,
  'Ч§ЧЧ’Ч•ЧЁЧ™Ч”': 5,
  'Ч”ЧўЧЁЧ•ЧЄ': 9,
  'ЧђЧ™Ч–Ч•ЧЁ Ч”Ч¤Ч¦Ч”': 10
};

type ImportLogger = {
  info: (data: Record<string, unknown>, message?: string) => void;
  warn?: (data: Record<string, unknown>, message?: string) => void;
  error?: (data: Record<string, unknown>, message?: string) => void;
};

function ensureWorkbookBuffer(buffer: Buffer) {
  const isZipContainer = buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b;

  if (!isZipContainer) {
    throw new ApiError(422, 'INVALID_WORKBOOK', 'Uploaded file is not a valid .xlsx workbook.');
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
  logger?: ImportLogger;
}): Omit<ParseManualShiftMonthlyPreviewInput, 'selectedDate'> {
  input.logger?.info(
    {
      fileName: input.fileName,
      bufferLength: input.buffer.length,
      sheetName: MONTHLY_MANUAL_SHIFT_SHEET_NAME
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

  const exactSheetName = workbook.SheetNames.find((name) => name.trim() === MONTHLY_MANUAL_SHIFT_SHEET_NAME) ?? null;
  const candidateSheetName = exactSheetName ?? (workbook.SheetNames.length === 1 ? workbook.SheetNames[0] : null);
  if (!candidateSheetName) {
    input.logger?.warn?.(
      {
        fileName: input.fileName,
        sheetName: MONTHLY_MANUAL_SHIFT_SHEET_NAME,
        workbookSheets: workbook.SheetNames
      },
      'monthly manual shift workbook sheet missing'
    );
    throw new ApiError(422, 'MISSING_SHEET', `Workbook is missing required sheet ${MONTHLY_MANUAL_SHIFT_SHEET_NAME}.`);
  }

  const candidateSheet = workbook.Sheets[candidateSheetName];
  if (!candidateSheet?.['!ref']) {
    input.logger?.warn?.(
      {
        fileName: input.fileName,
        sheetName: candidateSheetName,
        workbookSheets: workbook.SheetNames
      },
      'monthly manual shift workbook sheet missing'
    );
    throw new ApiError(422, 'MISSING_SHEET', `Workbook is missing required sheet ${MONTHLY_MANUAL_SHIFT_SHEET_NAME}.`);
  }

  const candidateRange = XLSX.utils.decode_range(candidateSheet['!ref']);
  if (!exactSheetName && candidateRange.e.c - candidateRange.s.c + 1 < 2) {
    input.logger?.warn?.(
      {
        fileName: input.fileName,
        sheetName: candidateSheetName,
        workbookSheets: workbook.SheetNames
      },
      'monthly manual shift workbook sheet missing'
    );
    throw new ApiError(422, 'MISSING_SHEET', `Workbook is missing required sheet ${MONTHLY_MANUAL_SHIFT_SHEET_NAME}.`);
  }

  const sheetName = candidateSheetName;
  input.logger?.info(
    {
      fileName: input.fileName,
      sheetName
    },
    'monthly manual shift workbook sheet found'
  );

  const sheet = candidateSheet;
  if (!sheet?.['!ref']) {
    throw new ApiError(422, 'INVALID_WORKBOOK', 'Uploaded workbook sheet is empty.');
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
      if (range.e.c - range.s.c + 1 >= 11) {
        for (const [headerName, columnIndex] of Object.entries(FALLBACK_MONTHLY_COLUMN_INDEX) as Array<
          [HeaderName, number]
        >) {
          if (!headerIndexByName.has(headerName)) {
            headerIndexByName.set(headerName, columnIndex);
          }
        }
      }
      break;
    }
  }

  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!headerIndexByName.has(requiredHeader)) {
      throw new ApiError(422, 'MISSING_REQUIRED_HEADER', `Workbook is missing required header ${requiredHeader}.`);
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

    const distributionDateCell = getCell('ЧЄЧђЧЁЧ™Чљ Ч”Ч¤Ч¦Ч”');
    const normalizedDate = normalizeDistributionDate(
      distributionDateCell?.v,
      distributionDateCell?.w ?? distributionDateCell?.v
    );

    rows.push({
      rowIndex: rowIndex + 1,
      ...normalizedDate,
      rawDistributionValue: normalizeStringCell(getCell('Ч§Ч• Ч”Ч¤Ч¦Ч”')?.w ?? getCell('Ч§Ч• Ч”Ч¤Ч¦Ч”')?.v),
      customerName: normalizeStringCell(getCell('Ч©Чќ ЧњЧ§Ч•Ч—')?.w ?? getCell('Ч©Чќ ЧњЧ§Ч•Ч—')?.v),
      orderNumber: normalizeStringCell(getCell('Ч”Ч–ЧћЧ Ч”')?.w ?? getCell('Ч”Ч–ЧћЧ Ч”')?.v),
      sku: getCell("ЧћЧ§''Ч")?.w ?? getCell("ЧћЧ§''Ч")?.v ?? null,
      description: normalizeStringCell(getCell('ЧЄЧ™ЧђЧ•ЧЁ')?.w ?? getCell('ЧЄЧ™ЧђЧ•ЧЁ')?.v),
      category: normalizeStringCell(getCell('Ч§ЧЧ’Ч•ЧЁЧ™Ч”')?.w ?? getCell('Ч§ЧЧ’Ч•ЧЁЧ™Ч”')?.v),
      quantity: getCell('Ч›ЧћЧ•ЧЄ')?.v ?? getCell('Ч›ЧћЧ•ЧЄ')?.w ?? null,
      notes: normalizeStringCell(getCell('Ч”ЧўЧЁЧ•ЧЄ')?.w ?? getCell('Ч”ЧўЧЁЧ•ЧЄ')?.v),
      zone: normalizeStringCell(getCell('ЧђЧ™Ч–Ч•ЧЁ Ч”Ч¤Ч¦Ч”')?.w ?? getCell('ЧђЧ™Ч–Ч•ЧЁ Ч”Ч¤Ч¦Ч”')?.v)
    });
  }

  if (rows.length === 0) {
    throw new ApiError(422, 'EMPTY_IMPORT', 'Workbook does not contain any importable monthly rows.');
  }

  input.logger?.info(
    {
      fileName: input.fileName,
      sheetName,
      rowCount: rows.length
    },
    'monthly manual shift workbook parse done'
  );

  return {
    source: {
      fileName: input.fileName,
      sheetName
    },
    rows
  };
}
