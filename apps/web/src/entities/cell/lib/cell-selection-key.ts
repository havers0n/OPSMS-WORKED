/**
 * Cell selection key utilities.
 *
 * The B2 cell selection key format: "${rackId}:${sectionId}:${slotNo}"
 *   rackId    — rack UUID
 *   sectionId — rack_section UUID (persists from draft to published layout)
 *   slotNo    — 1-based slot number, LTR/RTL adjusted; matches cells.slot_no in DB
 *
 * This key is constructed in RackCells (canvas click) and stored in EditorSelection.
 * It is the canonical B2 selection identifier for placement mode.
 */

export type CellSelectionKey = {
  rackId: string;
  sectionId: string;
  slotNo: number;
};

/**
 * Parses a B2 cell selection key string into its structural components.
 * Returns null if the key is malformed.
 *
 * UUIDs contain hyphens but not colons, so splitting on ':' yields exactly 3 parts.
 */
export function parseCellSelectionKey(cellId: string): CellSelectionKey | null {
  const parts = cellId.split(':');
  if (parts.length !== 3) return null;
  const [rackId, sectionId, slotNoStr] = parts;
  if (!rackId || !sectionId || !slotNoStr) return null;
  const slotNo = parseInt(slotNoStr, 10);
  if (!Number.isInteger(slotNo) || slotNo < 1) return null;
  return { rackId, sectionId, slotNo };
}
