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
