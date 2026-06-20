import type { ProductControlRow, ProductControlStatus } from './product-control-types';

function deriveStatus(
  shortageQty: number,
  bondedCoverQty: number,
  _bondedAvailableQty: number
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
  affectedLinesCount?: number;
  affectedOrdersCount?: number;
  bondedCandidateLabel?: string;
  notes?: string;
  bondedCandidateBlock?: string;
  bondedCandidateSource?: string;
  bondedCandidateUnitsPerPallet?: number;
  bondedCandidateCartonsPerPallet?: number;
  bondedCandidatePackFactor?: number;
  bondedCandidateAlreadyPulled?: number;
  bondedCandidateAvailableBalance?: number;
  workLines?: { name: string; units: number; blockedOrders: number }[];
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
    workLines: [],
  }),
  makeRow({
    sku: '100002',
    description: 'טונר דיו שחור HP 85A',
    category: 'דיו והדפסה',
    demandQty: 200,
    warehouseQty: 50,
    bondedAvailableQty: 200,
    affectedLinesCount: 8,
    affectedOrdersCount: 3,
    bondedCandidateLabel: 'מחסן בונדד A — מדף 12',
    bondedCandidateBlock: '3346/26',
    bondedCandidateSource: 'נעמן',
    bondedCandidateUnitsPerPallet: 960,
    bondedCandidateCartonsPerPallet: 40,
    bondedCandidatePackFactor: 24,
    bondedCandidateAlreadyPulled: 0,
    bondedCandidateAvailableBalance: 200,
    notes: 'בוצעה הזמנת רכש חלופית לספק משנה',
    workLines: [
      { name: 'משלוח דרום הגדול', units: 80, blockedOrders: 2 },
      { name: 'קמעונאות מרכז', units: 50, blockedOrders: 0 },
      { name: 'סיטונאי צפון', units: 70, blockedOrders: 1 },
    ],
  }),
  makeRow({
    sku: '100003',
    description: 'קלסר טבעות 5 ס"מ כחול',
    category: 'ניירת',
    demandQty: 300,
    warehouseQty: 100,
    bondedAvailableQty: 100,
    affectedLinesCount: 4,
    affectedOrdersCount: 2,
    bondedCandidateLabel: 'מחסן בונדד B — מדף 7',
    bondedCandidateBlock: '3772/24',
    bondedCandidateSource: 'בונדד',
    bondedCandidateUnitsPerPallet: 180,
    bondedCandidateCartonsPerPallet: 30,
    bondedCandidatePackFactor: 6,
    bondedCandidateAlreadyPulled: 0,
    bondedCandidateAvailableBalance: 100,
    workLines: [
      { name: 'משלוח דרום הגדול', units: 80, blockedOrders: 1 },
      { name: 'סיטונאי צפון', units: 120, blockedOrders: 2 },
    ],
  }),
  makeRow({
    sku: '100004',
    description: 'תיקיית נייר A4 קשיחה',
    category: 'ניירת',
    demandQty: 400,
    warehouseQty: 80,
    bondedAvailableQty: 0,
    affectedLinesCount: 12,
    affectedOrdersCount: 5,
    notes: 'מלאי מבונדד אזל — נדרשת רכש',
    workLines: [
      { name: 'משלוח דרום הגדול', units: 150, blockedOrders: 3 },
      { name: 'קמעונאות מרכז', units: 100, blockedOrders: 1 },
      { name: 'סיטונאי צפון', units: 70, blockedOrders: 2 },
    ],
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
    affectedLinesCount: 0,
    affectedOrdersCount: 0,
    notes: 'ביקורת נתונים נדרשת: כמות דרישה שלילית',
    workLines: [],
  },
];
