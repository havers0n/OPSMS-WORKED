import type {
  ShiftSummary,
  LineSummary,
  ActiveOrder,
  PickerWorkload,
  CheckQueue,
  LineDetail,
  PickerDetail,
  OrderDetail
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
  donePercent: 20
};

export const mockLines: LineSummary[] = [
  {
    lineId: 'line-1',
    lineName: 'קו צפון',
    lineStatus: 'in_progress',
    totalOrders: 10,
    totalLineCount: 50,
    totalPalletCount: 20,
    queued: 3,
    picking: 4,
    waitingCheck: 2,
    returned: 1,
    done: 0,
    errorCount: 1,
    donePercent: 0,
    wipCount: 7
  },
  {
    lineId: 'line-2',
    lineName: 'קו דרום',
    lineStatus: 'open',
    totalOrders: 10,
    totalLineCount: 30,
    totalPalletCount: 10,
    queued: 10,
    picking: 0,
    waitingCheck: 0,
    returned: 0,
    done: 0,
    errorCount: 0,
    donePercent: 0,
    wipCount: 0
  }
];

export const mockActiveOrders: ActiveOrder[] = [
  {
    orderId: 'order-1',
    orderNumber: 'ORD-001',
    customerName: null,
    pointName: 'נקודה א',
    lineCount: 5,
    pickerName: 'דוד',
    lineId: 'line-1',
    status: 'picking',
    ageSeconds: 720
  },
  {
    orderId: 'order-2',
    orderNumber: 'ORD-002',
    customerName: null,
    pointName: null,
    lineCount: null,
    pickerName: null,
    lineId: 'line-2',
    status: 'queued',
    ageSeconds: 60
  },
  {
    orderId: 'order-3',
    orderNumber: null,
    customerName: 'לקוח ב',
    pointName: null,
    lineCount: 3,
    pickerName: 'שרה',
    lineId: 'line-1',
    status: 'returned',
    ageSeconds: null
  }
];

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
    avgLinesPerOrder: 6.0,
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
    avgLinesPerOrder: 5.0,
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

export const mockLineDetail: LineDetail = {
  summary: mockLines[0],
  orders: [
    {
      orderId: 'order-1',
      status: 'returned',
      pointName: 'נקודה א',
      customerName: null,
      orderNumber: 'ORD-001',
      pickerName: 'דוד',
      size: 'M',
      lineCount: 5,
      palletCount: 2,
      ageSeconds: null
    }
  ]
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
  waitingCheckAt: null,
  checkedAt: null,
  finishedAt: null,
  ageSeconds: 120
};
