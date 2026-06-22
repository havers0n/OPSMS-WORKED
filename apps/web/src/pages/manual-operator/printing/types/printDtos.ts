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

export type PickerSheetScope = 'area' | 'line' | 'workGroup';

export interface PickerPrintItem {
  sku: string;
  displaySku: string;
  productName: string;
  quantity: number;
  warning?: 'sku_display_collision';
}

export interface PickerSheetWorkGroup {
  name: string;
  items: PickerPrintItem[];
}

export interface PickerSheetLine {
  name: string;
  workGroups: PickerSheetWorkGroup[];
}

export interface PickerSheetPrintData {
  shift: string;
  scope: PickerSheetScope;
  shiftDate: string;
  distributionArea: string;
  generatedAt: string;
  totals: {
    lines: number;
    workGroups: number;
    items: number;
  };
  planningLines: PickerSheetLine[];
}

export function getDisplaySku(sku: string): string {
  if (sku.length <= 6) return sku;
  return sku.slice(-6);
}

export function processCollisions(data: PickerSheetPrintData): PickerSheetPrintData {
  const displaySkuMap = new Map<string, string[]>();
  for (const line of data.planningLines) {
    for (const wg of line.workGroups) {
      for (const item of wg.items) {
        const existing = displaySkuMap.get(item.displaySku) ?? [];
        if (!existing.includes(item.sku)) {
          existing.push(item.sku);
        }
        displaySkuMap.set(item.displaySku, existing);
      }
    }
  }
  const collided = new Set<string>();
  for (const [_displaySku, skus] of displaySkuMap) {
    if (skus.length > 1) {
      for (const sku of skus) {
        collided.add(sku);
      }
    }
  }
  return {
    ...data,
    planningLines: data.planningLines.map(line => ({
      ...line,
      workGroups: line.workGroups.map(wg => ({
        ...wg,
        items: wg.items.map(item => ({
          ...item,
          warning: collided.has(item.sku) ? 'sku_display_collision' as const : undefined,
        })),
      })),
    })),
  };
}

export function getDemoPickerSheetData(
  shiftId: string,
  distributionArea: string,
  scope: PickerSheetScope = 'area',
  planningLineName?: string,
  workGroupName?: string
): PickerSheetPrintData {
  const raw: PickerSheetPrintData = {
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
              { sku: 'PREM-ABC001', displaySku: getDisplaySku('PREM-ABC001'), productName: 'מחברת A4 100 דפים', quantity: 50 },
              { sku: 'SECO-ABC001', displaySku: getDisplaySku('SECO-ABC001'), productName: 'עט כדורי שחור', quantity: 30 },
              { sku: '300001', displaySku: getDisplaySku('300001'), productName: 'קלסר A4', quantity: 20 },
            ],
          },
          {
            name: 'משמרת בוקר — קבוצה ב',
            items: [
              { sku: '100001', displaySku: getDisplaySku('100001'), productName: 'תיקיית קרטון', quantity: 40 },
              { sku: '100002', displaySku: getDisplaySku('100002'), productName: 'מחדד מכונה', quantity: 25 },
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
              { sku: '200001', displaySku: getDisplaySku('200001'), productName: 'נייר A4 חבילה', quantity: 60 },
              { sku: '200002', displaySku: getDisplaySku('200002'), productName: 'דיו למדפסת', quantity: 15 },
            ],
          },
          {
            name: 'משמרת בוקר — קבוצה ד',
            items: [
              { sku: 'EXTR-ABC001', displaySku: getDisplaySku('EXTR-ABC001'), productName: 'קרטון אריזה גדול', quantity: 35 },
            ],
          },
        ],
      },
    ],
  };

  const processed = processCollisions(raw);

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
): SchemePrintData {
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
        orders: [
          {
            orderNumber: 'SO-1001',
            customerName: 'שופרסל רחובות',
            pointName: 'רחובות',
            quantity: 80,
            status: 'ממתין',
            items: [
              { sku: '100001', description: 'מחברת A4 100 דפים', quantity: 50 },
              { sku: '100002', description: 'עט כדורי שחור', quantity: 30 }
            ]
          },
          {
            orderNumber: 'SO-1002',
            customerName: 'שופרסל ראשל"צ',
            pointName: 'ראשון לציון',
            quantity: 60,
            status: 'ממתין',
            items: [
              { sku: '100003', description: 'תיקיית קרטון', quantity: 40 },
              { sku: '100004', description: 'מחדד מכונה', quantity: 20 }
            ]
          },
          {
            orderNumber: 'SO-1003',
            customerName: 'שופרסל תל אביב',
            pointName: 'תל אביב',
            quantity: 70,
            status: 'ממתין',
            items: [
              { sku: '100005', description: 'קלסר A4', quantity: 70 }
            ]
          }
        ]
      },
      {
        groupName: 'קו 2 — אזור דרום',
        orderCount: 2,
        totalQuantity: 140,
        orders: [
          {
            orderNumber: 'SO-2001',
            customerName: 'בזק באר שבע',
            pointName: 'באר שבע',
            quantity: 90,
            status: 'ממתין',
            items: [
              { sku: '200001', description: 'נייר A4 חבילה', quantity: 60 },
              { sku: '200002', description: 'דיו למדפסת', quantity: 30 }
            ]
          },
          {
            orderNumber: 'SO-2002',
            customerName: 'בזק אשדוד',
            pointName: 'אשדוד',
            quantity: 50,
            status: 'ממתין',
            items: [
              { sku: '200003', description: 'תגיות מחיר', quantity: 50 }
            ]
          }
        ]
      },
      {
        groupName: 'קו 3 — אזור צפון',
        orderCount: 3,
        totalQuantity: 175,
        orders: [
          {
            orderNumber: 'SO-3001',
            customerName: 'מחסני השוק חיפה',
            pointName: 'חיפה',
            quantity: 65,
            status: 'ממתין',
            items: [
              { sku: '300001', description: 'קרטון אריזה גדול', quantity: 30 },
              { sku: '300002', description: 'סרט הדבקה', quantity: 35 }
            ]
          },
          {
            orderNumber: 'SO-3002',
            customerName: 'מחסני השוק נצרת',
            pointName: 'נצרת',
            quantity: 55,
            status: 'ממתין',
            items: [
              { sku: '300003', description: 'מדבקות ברקוד', quantity: 55 }
            ]
          },
          {
            orderNumber: 'SO-3003',
            customerName: 'מחסני השוק עכו',
            pointName: 'עכו',
            quantity: 55,
            status: 'ממתין',
            items: [
              { sku: '300004', description: 'חוטי קשירה', quantity: 25 },
              { sku: '300005', description: 'תוויות משלוח', quantity: 30 }
            ]
          }
        ]
      }
    ]
  };
}
