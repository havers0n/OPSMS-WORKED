import {
  getDisplaySku as _getDisplaySku,
  processCollisions as _processCollisions,
} from '@wos/domain';

export {
  getDisplaySku,
  processCollisions,
  aggregatePickerItems,
} from '@wos/domain';

export type {
  PickerSheetScope,
  PickerPrintItem,
  PickerSheetWorkGroup,
  PickerSheetLine,
  PickerSheetPrintData,
} from '@wos/domain';

export interface SchemePrintData {
  shiftName: string;
  shiftDate: string;
  distributionArea: string;
  generatedAt: string;
  workGroups: SchemePrintWorkGroup[];
}

export interface SchemePrintWorkGroup {
  groupName: string;
  orderCount: number;
  totalQuantity: number;
  orders: SchemePrintOrder[];
}

export interface SchemePrintOrder {
  orderNumber: string;
  customerName: string;
  pointName: string;
  quantity: number;
  status: string;
  items: SchemePrintItem[];
}

export interface SchemePrintItem {
  sku: string;
  description: string;
  quantity: number;
}

export interface PalletLabelData {
  shiftId: string;
  orderId: string;
  palletNumber: number;
  palletCount: number;
  customerName: string;
  pointName: string;
  routeName: string;
}

export function getDemoPickerSheetData(
  shiftId: string,
  distributionArea: string,
  scope: 'area' | 'line' | 'workGroup' = 'area',
  planningLineName?: string,
  workGroupName?: string
) {
  const raw = {
    shift: shiftId,
    scope,
    shiftDate: '22/06/2026',
    distributionArea,
    generatedAt: new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
    totals: { lines: 2, workGroups: 4, items: 9 },
    planningLines: [
      {
        name: 'קו אריזה 1',
        workGroups: [
          {
            name: 'משמרת בוקר — קבוצה א',
            items: [
              { sku: 'PREM-ABC001', displaySku: _getDisplaySku('PREM-ABC001'), description: 'מחברת A4 100 דפים', quantity: 50 },
              { sku: 'SECO-ABC001', displaySku: _getDisplaySku('SECO-ABC001'), description: 'עט כדורי שחור', quantity: 30 },
              { sku: '300001', displaySku: _getDisplaySku('300001'), description: 'קלסר A4', quantity: 20 },
            ],
          },
          {
            name: 'משמרת בוקר — קבוצה ב',
            items: [
              { sku: '100001', displaySku: _getDisplaySku('100001'), description: 'תיקיית קרטון', quantity: 40 },
              { sku: '100002', displaySku: _getDisplaySku('100002'), description: 'מחדד מכונה', quantity: 25 },
            ],
          },
        ],
      },
      {
        name: 'קו אריזה 2',
        workGroups: [
          {
            name: 'משמרת בוקר — קבוצה ג',
            items: [
              { sku: '200001', displaySku: _getDisplaySku('200001'), description: 'נייר A4 חבילה', quantity: 60 },
              { sku: '200002', displaySku: _getDisplaySku('200002'), description: 'דיו למדפסת', quantity: 15 },
            ],
          },
          {
            name: 'משמרת בוקר — קבוצה ד',
            items: [
              { sku: 'EXTR-ABC001', displaySku: _getDisplaySku('EXTR-ABC001'), description: 'קרטון אריזה גדול', quantity: 35 },
            ],
          },
        ],
      },
    ],
  };

  const processed = _processCollisions(raw);

  if (scope === 'line' && planningLineName) {
    processed.planningLines = processed.planningLines.filter(l => l.name === planningLineName);
    processed.totals.lines = processed.planningLines.length;
    processed.totals.workGroups = processed.planningLines.reduce((s, l) => s + l.workGroups.length, 0);
    processed.totals.items = processed.planningLines.reduce((s, l) => s + l.workGroups.reduce((s2, wg) => s2 + wg.items.length, 0), 0);
  } else if (scope === 'workGroup' && planningLineName && workGroupName) {
    processed.planningLines = processed.planningLines
      .filter(l => l.name === planningLineName)
      .map(l => ({
        ...l,
        workGroups: l.workGroups.filter(wg => wg.name === workGroupName),
      }));
    processed.totals.lines = processed.planningLines.length;
    processed.totals.workGroups = processed.planningLines.reduce((s, l) => s + l.workGroups.length, 0);
    processed.totals.items = processed.planningLines.reduce((s, l) => s + l.workGroups.reduce((s2, wg) => s2 + wg.items.length, 0), 0);
  }

  return processed;
}

export function getDemoSchemeData(
  _shiftId: string,
  distributionArea: string
) {
  return {
    shiftName: 'משמרת בוקר',
    shiftDate: '22/06/2026',
    distributionArea,
    generatedAt: new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
    workGroups: [
      {
        groupName: 'קו 1 — אזור מרכז',
        orderCount: 3,
        totalQuantity: 210,
        orders: [],
      },
    ],
  };
}
