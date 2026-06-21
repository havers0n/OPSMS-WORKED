import { useState } from 'react';

type ID = string;

export interface ItemRow {
  id: ID;
  orderId: ID;
  sku: string;
  description: string;
  category: string;
  quantity: number;
  assignment?: {
    workLineId: ID;
    bucketId: ID;
  };
}

export interface Order {
  id: ID;
  orderNumber: string;
  customerName: string;
}

export interface Bucket {
  id: ID;
  workLineId: ID;
  name: string;
}

export interface WorkLine {
  id: ID;
  name: string;
}

export type OrderStatus = 'unassigned' | 'partial' | 'assigned' | 'split' | 'needs_review';

export interface OrderWithStatus extends Order {
  items: ItemRow[];
  unassignedItems: ItemRow[];
  status: OrderStatus;
  splitCount: number;
  totalQty: number;
}

const mockWorkLines: WorkLine[] = [
  { id: 'wl-dromi-1', name: 'דרומי 1' },
  { id: 'wl-dromi-2', name: 'דרומי 2' },
];

const mockBuckets: Bucket[] = [
  { id: 'b-dromi-1-klali', workLineId: 'wl-dromi-1', name: 'כללי' },
  { id: 'b-dromi-1-cellular', workLineId: 'wl-dromi-1', name: 'סלולר' },
  { id: 'b-dromi-2-super', workLineId: 'wl-dromi-2', name: 'סופר שוק' },
];

const mockOrders: Order[] = [
  { id: 'o-4521', orderNumber: 'SO26014521', customerName: 'סופר שוק - באר שבע' },
  { id: 'o-4544', orderNumber: 'SO26014544', customerName: 'מחסני הדרום בע"מ' },
  { id: 'o-4602', orderNumber: 'SO26014602', customerName: 'לקוח קמפינג דרום' },
  { id: 'o-3614', orderNumber: 'SO26013614', customerName: 'פז נהריה - 316' },
];

function buildInitialItems(): ItemRow[] {
  return [
    { id: 'i-4521-1', orderId: 'o-4521', sku: '478988', description: 'בוסטר התנעה 12000MAH - CRUZO', category: 'רכב', quantity: 4 },
    { id: 'i-4521-2', orderId: 'o-4521', sku: '475529', description: 'בוסטר התנעה לרכבים פרטיים', category: 'רכב', quantity: 2 },
    { id: 'i-4521-3', orderId: 'o-4521', sku: '63052', description: 'ספריי ריח לרכב', category: 'רכב', quantity: 6 },
    { id: 'i-4521-4', orderId: 'o-4521', sku: '11111', description: 'מוצר כללי 1', category: 'כללי', quantity: 10 },
    { id: 'i-4521-5', orderId: 'o-4521', sku: '22222', description: 'מוצר כללי 2', category: 'כללי', quantity: 5 },

    ...Array.from({ length: 8 }).map((_, i) => ({
      id: `i-4544-${i + 1}`,
      orderId: 'o-4544' as ID,
      sku: `SKU-4544-${i}`,
      description: `פריט מחסני הדרום ${i + 1}`,
      category: 'כללי' as string,
      quantity: i + 2,
    })),

    { id: 'i-4602-1', orderId: 'o-4602', sku: 'CAM-001', description: 'אוהל קמפינג 4 מושבים', category: 'קמפינג', quantity: 3 },
    { id: 'i-4602-2', orderId: 'o-4602', sku: 'CAM-002', description: 'כיסא מתקפל', category: 'קמפינג', quantity: 8 },
    { id: 'i-4602-3', orderId: 'o-4602', sku: 'CAM-003', description: 'שולחן קמפינג מתקפל', category: 'קמפינג', quantity: 2 },

    { id: 'i-3614-1', orderId: 'o-3614', sku: 'PET-001', description: 'שמן מנוע 15W40', category: 'רכב', quantity: 12,
      assignment: { workLineId: 'wl-dromi-1', bucketId: 'b-dromi-1-klali' } },
    { id: 'i-3614-2', orderId: 'o-3614', sku: 'PET-002', description: 'שמן מנוע 10W30', category: 'רכב', quantity: 6,
      assignment: { workLineId: 'wl-dromi-1', bucketId: 'b-dromi-1-klali' } },
    { id: 'i-3614-3', orderId: 'o-3614', sku: 'PET-003', description: 'נוזל קירור', category: 'רכב', quantity: 8,
      assignment: { workLineId: 'wl-dromi-1', bucketId: 'b-dromi-1-klali' } },
    { id: 'i-3614-4', orderId: 'o-3614', sku: 'CELL-01', description: 'מטען סלולרי לרכב', category: 'סלולר', quantity: 4,
      assignment: { workLineId: 'wl-dromi-1', bucketId: 'b-dromi-1-cellular' } },
    { id: 'i-3614-5', orderId: 'o-3614', sku: 'SUPER-01', description: 'מארז שתיה קלה', category: 'סופר שוק', quantity: 24,
      assignment: { workLineId: 'wl-dromi-2', bucketId: 'b-dromi-2-super' } },
    { id: 'i-3614-6', orderId: 'o-3614', sku: 'SUPER-02', description: 'מארז חטיפים', category: 'סופר שוק', quantity: 12,
      assignment: { workLineId: 'wl-dromi-2', bucketId: 'b-dromi-2-super' } },
  ];
}

function computeOrderStatus(order: Order, items: ItemRow[]): OrderWithStatus {
  const orderItems = items.filter(i => i.orderId === order.id);
  const unassignedItems = orderItems.filter(i => !i.assignment);
  const assignedItems = orderItems.filter(i => i.assignment);
  const uniqueAssignments = new Set(assignedItems.map(i => `${i.assignment!.workLineId}-${i.assignment!.bucketId}`));
  const totalQty = orderItems.reduce((acc, i) => acc + i.quantity, 0);

  let status: OrderStatus = 'unassigned';
  if (assignedItems.length > 0 && unassignedItems.length > 0) {
    status = 'partial';
  } else if (unassignedItems.length === 0 && assignedItems.length > 0) {
    status = uniqueAssignments.size > 1 ? 'split' : 'assigned';
  }

  return { ...order, items: orderItems, unassignedItems, status, splitCount: uniqueAssignments.size, totalQty };
}

export function useLineSchemeState() {
  const [workLines, setWorkLines] = useState<WorkLine[]>(mockWorkLines);
  const [buckets, setBuckets] = useState<Bucket[]>(mockBuckets);
  const [items, setItems] = useState<ItemRow[]>(buildInitialItems);

  const ordersWithStatus = mockOrders.map(o => computeOrderStatus(o, items));
  const unassignedCount = items.filter(i => !i.assignment).length;

  function createWorkLine(name: string) {
    const id = `wl-${Date.now()}`;
    setWorkLines(prev => [...prev, { id, name }]);
    return id;
  }

  function createBucket(workLineId: string, name: string) {
    const id = `b-${Date.now()}`;
    setBuckets(prev => [...prev, { id, workLineId, name }]);
    return id;
  }

  function assignItems(itemIds: string[], workLineId: string, bucketId: string) {
    setItems(prev => prev.map(item =>
      itemIds.includes(item.id)
        ? { ...item, assignment: { workLineId, bucketId } }
        : item
    ));
  }

  function assignWholeOrder(orderId: string, workLineId: string, bucketId: string) {
    setItems(prev => prev.map(item =>
      item.orderId === orderId && !item.assignment
        ? { ...item, assignment: { workLineId, bucketId } }
        : item
    ));
  }

  return {
    workLines,
    buckets,
    items,
    ordersWithStatus,
    unassignedCount,
    createWorkLine,
    createBucket,
    assignItems,
    assignWholeOrder,
  };
}

export type LineSchemeState = ReturnType<typeof useLineSchemeState>;
