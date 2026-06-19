import type {
  ShiftSummary,
  PickerWorkload,
  CheckQueue,
  PickerDetail,
  OrderDetail,
  LineHierarchySummary,
  WorkBucketSummary,
  AreaHierarchySummary
} from '@/entities/manual-shift/model/shift-selectors';
import type { ManualShiftSession } from '@wos/domain';

export const mockShift: ManualShiftSession = {
  id: 'shift-1',
  tenantId: 'tenant-1',
  date: '2026-05-27',
  name: 'משמרת בוקר',
  status: 'active',
  createdBy: null,
  createdAt: new Date().toISOString(),
  closedAt: null
};

export const mockKpi: ShiftSummary = {
  totalOrders: 20,
  queued: 5,
  picking: 7,
  waitingCheck: 3,
  returned: 1,
  done: 4,
  errorsCount: 2,
  donePercent: 20,
  totalPalletCount: 0
};

export const mockPickers: PickerWorkload[] = [
  {
    pickerKey: 'דוד',
    pickerName: 'דוד',
    pickerWorkerId: 'w-1',
    totalOrders: 5,
    totalLineCount: 30,
    totalPalletCount: 10,
    queued: 0,
    picking: 3,
    waitingCheck: 1,
    returned: 1,
    done: 0,
    wipCount: 5,
    avgLinesPerOrder: 6,
    humanMinutes: null
  },
  {
    pickerKey: 'שרה',
    pickerName: 'שרה',
    pickerWorkerId: 'w-2',
    totalOrders: 3,
    totalLineCount: 15,
    totalPalletCount: 5,
    queued: 0,
    picking: 2,
    waitingCheck: 0,
    returned: 1,
    done: 0,
    wipCount: 3,
    avgLinesPerOrder: 5,
    humanMinutes: null
  }
];

export const mockCheckQueue: CheckQueue = {
  orders: [
    {
      orderId: 'order-1',
      orderNumber: 'ORD-001',
      customerName: null,
      pointName: 'נקודה א',
      lineCount: 5,
      pickerName: 'דוד',
      lineId: 'line-1',
      waitingCheckAt: new Date(Date.now() - 600_000).toISOString(),
      waitingSeconds: 600
    }
  ],
  count: 1,
  oldestOrder: {
    orderId: 'order-1',
    orderNumber: 'ORD-001',
    customerName: null,
    pointName: 'נקודה א',
    lineCount: 5,
    pickerName: 'דוד',
    lineId: 'line-1',
    waitingCheckAt: new Date(Date.now() - 600_000).toISOString(),
    waitingSeconds: 600
  }
};

export const emptyCheckQueue: CheckQueue = {
  orders: [],
  count: 0,
  oldestOrder: null
};

export const mockPickerDetail: PickerDetail = {
  summary: mockPickers[0],
  orders: [
    {
      orderId: 'order-2',
      status: 'picking',
      lineId: 'line-1',
      lineName: 'קו צפון',
      pointName: 'נקודה ב',
      customerName: null,
      orderNumber: 'ORD-002',
      size: 'L',
      lineCount: 8,
      palletCount: 1,
      ageSeconds: 120
    }
  ],
  lineBreakdown: [
    {
      lineId: 'line-1',
      lineName: 'קו צפון',
      totalOrders: 1,
      totalLineCount: 8,
      totalPalletCount: 1
    }
  ]
};

export const mockOrderDetail: OrderDetail = {
  orderId: 'order-1',
  status: 'picking',
  lineId: 'line-1',
  lineName: 'קו צפון',
  pointName: 'נקודה א',
  customerName: 'לקוח א',
  orderNumber: 'ORD-001',
  pickerName: 'דוד',
  checkerName: null,
  size: 'M',
  lineCount: 5,
  palletCount: 2,
  createdAt: '2026-05-27T08:00:00.000Z',
  startedAt: '2026-05-27T08:10:00.000Z',
  checkStartedAt: null,
  waitingCheckAt: null,
  checkedAt: null,
  finishedAt: null,
  ageSeconds: 120
};

export const mockLineHierarchySummaries: LineHierarchySummary[] = [
  {
    lineId: 'line-1',
    lineName: 'קו צפון',
    distributionArea: 'צפון',
    lineStatus: 'in_progress',
    ordersCount: 10,
    itemLinesCount: 50,
    totalQuantity: 320,
    statusBreakdown: { queued: 3, picking: 4, waitingCheck: 2, returned: 1, done: 0 }
  },
  {
    lineId: 'line-2',
    lineName: 'קו דרום',
    distributionArea: null,
    lineStatus: 'open',
    ordersCount: 10,
    itemLinesCount: 30,
    totalQuantity: 0,
    statusBreakdown: { queued: 10, picking: 0, waitingCheck: 0, returned: 0, done: 0 }
  }
];

export const mockWorkBucketSummaries: WorkBucketSummary[] = [
  {
    workBucketName: 'Point A',
    ordersCount: 2,
    itemLinesCount: 8,
    totalQuantity: 32,
    statusBreakdown: { queued: 0, picking: 1, waitingCheck: 0, returned: 1, done: 0 },
    orders: [
      {
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        customerName: 'לקוח א',
        status: 'picking',
        workBucketName: 'Point A',
        pickerName: 'דוד',
        checkerName: null,
        lineCount: 5,
        totalQuantity: 32
      },
      {
        orderId: 'order-3',
        orderNumber: null,
        customerName: null,
        status: 'returned',
        workBucketName: 'No Point',
        pickerName: 'שרה',
        checkerName: null,
        lineCount: 3,
        totalQuantity: 0
      }
    ]
  }
];

export const mockAreaSummaries: AreaHierarchySummary[] = [
  {
    areaKey: 'צפון',
    displayName: 'צפון',
    areaName: 'צפון',
    totalLines: 1,
    totalBuckets: 2,
    totalOrders: 10,
    totalQuantity: 320,
    statusBreakdown: { queued: 3, picking: 4, waitingCheck: 2, returned: 1, done: 0 }
  },
  {
    areaKey: 'דרום',
    displayName: 'דרום',
    areaName: 'דרום',
    totalLines: 1,
    totalBuckets: 1,
    totalOrders: 10,
    totalQuantity: 0,
    statusBreakdown: { queued: 10, picking: 0, waitingCheck: 0, returned: 0, done: 0 }
  }
];
