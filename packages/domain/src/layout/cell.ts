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

export const cellSchema = z.object({
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
export type Cell = z.infer<typeof cellSchema>;

const pad2 = (value: number | string) => String(value).padStart(2, '0');
const pad4 = (value: number | string) => String(value).padStart(4, '0');

export function buildCellAddress(parts: AddressParts): CellAddress {
  const raw = `${pad2(parts.rackCode)}-${parts.face}.${pad2(parts.section)}.${pad2(parts.level)}.${pad2(parts.slot)}`;
  const sortKey = `${pad4(parts.rackCode)}-${parts.face}-${pad2(parts.section)}-${pad2(parts.level)}-${pad2(parts.slot)}`;

  return {
    raw,
    parts,
    sortKey
  };
}
