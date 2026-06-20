import type { ProductControlRow, ProductControlStatus } from './product-control-types';

function deriveStatus(
  shortageQty: number,
  bondedCoverQty: number,
  bondedAvailableQty: number
): ProductControlStatus {
  if (shortageQty === 0) return 'ok';
  if (bondedCoverQty >= shortageQty) return 'covered_by_bonded';
  if (bondedCoverQty > 0) return 'partial_bonded';
  return 'unresolved';
}

function makeRow(data: {
  sku: string;
  description: string;
  category: string;
  demandQty: number;
  warehouseQty: number;
  bondedAvailableQty: number;
  status?: ProductControlStatus;
}): ProductControlRow {
  const shortageQty = Math.max(0, data.demandQty - data.warehouseQty);
  const bondedCoverQty = Math.min(shortageQty, data.bondedAvailableQty);
  const finalMissingQty = Math.max(0, shortageQty - bondedCoverQty);
  const surplusQty = Math.max(0, data.warehouseQty - data.demandQty);

  return {
    ...data,
    shortageQty,
    bondedCoverQty,
    finalMissingQty,
    surplusQty,
    status: data.status ?? deriveStatus(shortageQty, bondedCoverQty, data.bondedAvailableQty),
  };
}

export const productControlFixtures: ProductControlRow[] = [
  makeRow({
    sku: '100001',
    description: 'מחברת A4 100 דפים',
    category: 'ניירת',
    demandQty: 500,
    warehouseQty: 500,
    bondedAvailableQty: 0,
  }),
  makeRow({
    sku: '100002',
    description: 'טונר דיו שחור HP 85A',
    category: 'דיו והדפסה',
    demandQty: 200,
    warehouseQty: 50,
    bondedAvailableQty: 200,
  }),
  makeRow({
    sku: '100003',
    description: 'קלסר טבעות 5 ס"מ כחול',
    category: 'ניירת',
    demandQty: 300,
    warehouseQty: 100,
    bondedAvailableQty: 100,
  }),
  makeRow({
    sku: '100004',
    description: 'תיקיית נייר A4 קשיחה',
    category: 'ניירת',
    demandQty: 400,
    warehouseQty: 80,
    bondedAvailableQty: 0,
  }),
  {
    sku: '999999',
    description: '?!? נתונים לא תקינים',
    category: '—-',
    demandQty: -5,
    warehouseQty: 9999,
    shortageQty: 0,
    bondedAvailableQty: 0,
    bondedCoverQty: 0,
    finalMissingQty: 0,
    surplusQty: 0,
    status: 'data_issue',
  },
];
