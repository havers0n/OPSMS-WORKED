import { buildProductControlRow, computeProductControlTotals } from '@wos/domain';
import type { ProductControlRow, ProductControlResponse } from '@wos/domain';

export function getMockProductControlResponse(shiftId: string): ProductControlResponse {
  const rows: ProductControlRow[] = [
    buildProductControlRow({
      sku: '100001',
      description: 'מחברת A4 100 דפים',
      category: 'ניירת',
      demandQty: 500,
      warehouseQty: 500,
      bondedAvailableQty: 0
    }),
    buildProductControlRow({
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
        { name: 'סיטונאי צפון', units: 70, blockedOrders: 1 }
      ]
    }),
    buildProductControlRow({
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
        { name: 'סיטונאי צפון', units: 120, blockedOrders: 2 }
      ]
    }),
    buildProductControlRow({
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
        { name: 'סיטונאי צפון', units: 70, blockedOrders: 2 }
      ]
    }),
    buildProductControlRow({
      sku: '999999',
      description: '?!? נתונים לא תקינים',
      category: '—-',
      demandQty: 0,
      warehouseQty: 9999,
      bondedAvailableQty: 0,
      status: 'data_issue',
      notes: 'ביקורת נתונים נדרשת: כמות דרישה שלילית'
    })
  ];

  const totals = computeProductControlTotals(rows);

  return {
    shiftId,
    generatedAt: new Date().toISOString(),
    rows,
    totals
  };
}
