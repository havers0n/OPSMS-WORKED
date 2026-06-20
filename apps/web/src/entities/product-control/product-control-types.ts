export type ProductControlStatus =
  | 'ok'
  | 'covered_by_bonded'
  | 'partial_bonded'
  | 'unresolved'
  | 'data_issue';

export interface ProductControlRow {
  sku: string;
  description: string;
  category: string;
  demandQty: number;
  warehouseQty: number;
  shortageQty: number;
  bondedAvailableQty: number;
  bondedCoverQty: number;
  finalMissingQty: number;
  surplusQty: number;
  status: ProductControlStatus;

  affectedLinesCount?: number;
  affectedOrdersCount?: number;
  bondedCandidateLabel?: string;
  notes?: string;
}
