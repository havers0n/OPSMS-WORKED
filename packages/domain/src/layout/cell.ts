import { z } from 'zod';

export const addressPartsSchema = z.object({
  rackCode: z.string(),
  face: z.enum(['A', 'B']),
  section: z.number().int().min(1),
  level: z.number().int().min(1),
  slot: z.number().int().min(1)
});
export type AddressParts = z.infer<typeof addressPartsSchema>;

export const cellAddressSchema = z.object({
  raw: z.string(),
  parts: addressPartsSchema,
  sortKey: z.string()
});
export type CellAddress = z.infer<typeof cellAddressSchema>;

const cellBaseSchema = z.object({
  id: z.string(),
  layoutVersionId: z.string(),
  rackId: z.string(),
  rackFaceId: z.string(),
  rackSectionId: z.string(),
  rackLevelId: z.string(),
  slotNo: z.number().int().min(1),
  address: cellAddressSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  status: z.enum(['active', 'inactive'])
});
export const cellSchema = cellBaseSchema.extend({
  cellCode: z.string()
});
export type Cell = z.infer<typeof cellSchema>;

// Preview cells reuse the structural slot/address shape but intentionally keep
// a preview-only identifier separate from persisted cells.cell_code.
export const previewCellSchema = cellBaseSchema.extend({
  previewCellKey: z.string()
});
export type PreviewCell = z.infer<typeof previewCellSchema>;
export type CellStructureIdentity = Pick<
  Cell | PreviewCell,
  'rackId' | 'rackFaceId' | 'rackSectionId' | 'rackLevelId' | 'slotNo'
>;

export function buildCellStructureKey(identity: CellStructureIdentity): string {
  return [
    identity.rackId,
    identity.rackFaceId,
    identity.rackSectionId,
    identity.rackLevelId,
    identity.slotNo
  ].join(':');
}

const pad2 = (value: number | string) => String(value).padStart(2, '0');
const pad4 = (value: number | string) => String(value).padStart(4, '0');

export function buildPreviewCellKey(args: {
  rackId: string;
  face: 'A' | 'B';
  section: number;
  level: number;
  slot: number;
}): string {
  const { rackId, face, section, level, slot } = args;
  const key = `${rackId}:${face}:${section}:${level}:${slot}`;

  // Lightweight deterministic key for frontend-derived preview cells.
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }

  return `cell_${hash.toString(16).padStart(8, '0')}`;
}

export function buildCellAddress(parts: AddressParts): CellAddress {
  const raw = `${pad2(parts.rackCode)}-${parts.face}.${pad2(parts.section)}.${pad2(parts.level)}.${pad2(parts.slot)}`;
  const sortKey = `${pad4(parts.rackCode)}-${parts.face}-${pad2(parts.section)}-${pad2(parts.level)}-${pad2(parts.slot)}`;

  return {
    raw,
    parts,
    sortKey
  };
}

export function parseCellAddress(raw: string, sortKey?: string): CellAddress {
  const match = raw.match(/^([^.]+)-([AB])\.(\d{2})\.(\d{2})\.(\d{2})$/);

  if (!match) {
    throw new Error(`Invalid cell address: ${raw}`);
  }

  const [, rackCode, face, section, level, slot] = match;

  return cellAddressSchema.parse({
    raw,
    parts: {
      rackCode,
      face,
      section: Number(section),
      level: Number(level),
      slot: Number(slot)
    },
    sortKey: sortKey ?? `${pad4(rackCode)}-${face}-${section}-${level}-${slot}`
  });
}
