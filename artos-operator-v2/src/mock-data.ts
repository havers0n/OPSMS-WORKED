import { Order, Picker, OrderError, OrderEvent } from './types';

export const mockPickers: Picker[] = [
  { id: 'p1', name: 'יהודה', active: true },
  { id: 'p2', name: 'רפאל', active: true },
  { id: 'p3', name: 'הראל', active: true },
  { id: 'p4', name: 'סנד', active: true },
  { id: 'p5', name: 'דניאל', active: true },
];

export const mockLines = [
  'שרון דרומי',
  'מרכז',
  'חיפה',
  'עמקים',
  'צפון',
  'שפלה',
  'הום סנטר'
];

const now = Date.now();
const min = 60000;

export const initialOrders: Order[] = [
  {
    id: 'o1',
    orderNumber: 'ORD-1001',
    kav: 'שרון דרומי',
    lineCount: 2,
    size: 'S',
    status: 'new',
    createdAt: now - 30 * min,
    errorIds: []
  },
  {
    id: 'o2',
    orderNumber: 'ORD-1002',
    kav: 'מרכז',
    pickerId: 'p1',
    lineCount: 5,
    size: 'M',
    status: 'assigned',
    createdAt: now - 45 * min,
    errorIds: []
  },
  {
    id: 'o3',
    orderNumber: 'ORD-1003',
    kav: 'חיפה',
    pickerId: 'p2',
    lineCount: 15,
    size: 'L',
    status: 'picking',
    createdAt: now - 60 * min,
    startedAt: now - 20 * min,
    errorIds: []
  },
  {
    id: 'o4',
    orderNumber: 'ORD-1004',
    kav: 'עמקים',
    pickerId: 'p3',
    lineCount: 25,
    size: 'XL',
    status: 'picking',
    createdAt: now - 120 * min,
    startedAt: now - 50 * min,
    errorIds: []
  },
  {
    id: 'o5',
    orderNumber: 'ORD-1005',
    kav: 'צפון',
    pickerId: 'p4',
    lineCount: 1,
    size: 'S',
    status: 'picking',
    createdAt: now - 10 * min,
    startedAt: now - 5 * min,
    errorIds: []
  },
  {
    id: 'o6',
    orderNumber: 'ORD-1006',
    kav: 'שפלה',
    pickerId: 'p5',
    lineCount: 4,
    size: 'M',
    status: 'picking',
    createdAt: now - 15 * min,
    startedAt: now - 10 * min,
    errorIds: []
  },
  {
    id: 'o7',
    orderNumber: 'ORD-1007',
    kav: 'הום סנטר',
    pickerId: 'p1',
    lineCount: 10,
    size: 'L',
    status: 'waiting_check',
    createdAt: now - 120 * min,
    startedAt: now - 100 * min,
    waitingCheckAt: now - 30 * min,
    errorIds: []
  },
  {
    id: 'o8',
    orderNumber: 'ORD-1008',
    kav: 'מרכז',
    pickerId: 'p2',
    lineCount: 6,
    size: 'M',
    status: 'waiting_check',
    createdAt: now - 80 * min,
    startedAt: now - 60 * min,
    waitingCheckAt: now - 15 * min,
    errorIds: []
  },
  {
    id: 'o9',
    orderNumber: 'ORD-1009',
    kav: 'שרון דרומי',
    pickerId: 'p3',
    lineCount: 12,
    size: 'L',
    status: 'waiting_check',
    createdAt: now - 200 * min,
    startedAt: now - 180 * min,
    waitingCheckAt: now - 5 * min,
    errorIds: []
  },
  {
    id: 'o10',
    orderNumber: 'ORD-1010',
    kav: 'חיפה',
    pickerId: 'p4',
    lineCount: 18,
    size: 'L',
    status: 'returned',
    createdAt: now - 240 * min,
    startedAt: now - 220 * min,
    waitingCheckAt: now - 100 * min,
    errorIds: ['e1'],
    comment: 'חסר פריט בארון שמאל'
  },
  {
    id: 'o11',
    orderNumber: 'ORD-1011',
    kav: 'עמקים',
    pickerId: 'p5',
    lineCount: 22,
    size: 'XL',
    status: 'returned',
    createdAt: now - 180 * min,
    startedAt: now - 160 * min,
    waitingCheckAt: now - 40 * min,
    errorIds: ['e2']
  },
  {
    id: 'o12',
    orderNumber: 'ORD-1012',
    kav: 'צפון',
    pickerId: 'p1',
    lineCount: 7,
    size: 'M',
    status: 'ready_packing',
    createdAt: now - 300 * min,
    startedAt: now - 280 * min,
    waitingCheckAt: now - 200 * min,
    checkedAt: now - 180 * min,
    errorIds: []
  },
  {
    id: 'o13',
    orderNumber: 'ORD-1013',
    kav: 'שפלה',
    pickerId: 'p2',
    lineCount: 3,
    size: 'S',
    status: 'ready_packing',
    createdAt: now - 150 * min,
    startedAt: now - 120 * min,
    waitingCheckAt: now - 80 * min,
    checkedAt: now - 60 * min,
    errorIds: []
  },
  {
    id: 'o14',
    orderNumber: 'ORD-1014',
    kav: 'הום סנטר',
    pickerId: 'p3',
    lineCount: 5,
    size: 'M',
    status: 'done',
    createdAt: now - 400 * min,
    startedAt: now - 380 * min,
    waitingCheckAt: now - 340 * min,
    checkedAt: now - 320 * min,
    finishedAt: now - 200 * min,
    errorIds: []
  },
  {
    id: 'o15',
    orderNumber: 'ORD-1015',
    kav: 'מרכז',
    pickerId: 'p4',
    lineCount: 9,
    size: 'L',
    status: 'done',
    createdAt: now - 350 * min,
    startedAt: now - 330 * min,
    waitingCheckAt: now - 290 * min,
    checkedAt: now - 270 * min,
    finishedAt: now - 150 * min,
    errorIds: []
  },
  {
    id: 'o16',
    orderNumber: 'ORD-1016',
    kav: 'שרון דרומי',
    pickerId: 'p5',
    lineCount: 2,
    size: 'S',
    status: 'done',
    createdAt: now - 250 * min,
    startedAt: now - 200 * min,
    waitingCheckAt: now - 150 * min,
    checkedAt: now - 140 * min,
    finishedAt: now - 100 * min,
    errorIds: []
  }
];

export const initialErrors: OrderError[] = [
  {
    id: 'e1',
    orderId: 'o10',
    type: 'missing_item',
    createdAt: now - 90 * min,
    comment: 'חסר פריט מק\"ט 12345'
  },
  {
    id: 'e2',
    orderId: 'o11',
    type: 'wrong_quantity',
    createdAt: now - 35 * min
  }
];

export const initialEvents: OrderEvent[] = [];
