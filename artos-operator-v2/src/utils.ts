import { OrderStatus, OrderSize, Order, Picker, OrderError } from './types';

export const calculateOrderSize = (lineCount: number): OrderSize => {
  if (lineCount <= 3) return 'S';
  if (lineCount <= 8) return 'M';
  if (lineCount <= 20) return 'L';
  return 'XL';
};

export const getElapsedTime = (timestamp?: number): string => {
  if (!timestamp) return '0דק\'';
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}דק'`;
  const hrs = Math.floor(diffMins / 60);
  return `${hrs}ש'`;
};

export const getStatusLabel = (status: OrderStatus): string => {
  const map: Record<OrderStatus, string> = {
    new: 'חדש',
    assigned: 'שויך',
    picking: 'בליקוט',
    waiting_check: 'ממתין לבדיקה',
    returned: 'הוחזר לתיקון',
    ready_packing: 'מוכן לאריזה',
    done: 'הסתיים'
  };
  return map[status] || status;
};

export const getStatusColor = (status: OrderStatus): string => {
  const map: Record<OrderStatus, string> = {
    new: 'bg-gray-100 text-gray-800 border-gray-200',
    assigned: 'bg-gray-100 text-gray-800 border-gray-200',
    picking: 'bg-blue-100 text-blue-800 border-blue-200',
    waiting_check: 'bg-amber-100 text-amber-800 border-amber-200',
    returned: 'bg-red-100 text-red-800 border-red-200',
    ready_packing: 'bg-green-100 text-green-800 border-green-200',
    done: 'bg-neutral-100 text-neutral-800 border-neutral-200'
  };
  return map[status] || 'bg-gray-100; text-gray-800';
};

export const getErrorTypeLabel = (type: string): string => {
  const map: Record<string, string> = {
    wrong_quantity: 'כמות לא נכונה',
    wrong_item: 'פריט שגוי',
    missing_item: 'פריט חסר',
    bad_packing: 'אריזה פגומה',
    small_items_loose: 'פריטים קטנים בתפזורת',
    damaged: 'פגום',
    other: 'אחר'
  };
  return map[type] || type;
};

export const summarizeDay = (orders: Order[], errors: OrderError[]) => {
  const activeStatuses = ['new', 'assigned', 'picking', 'waiting_check', 'returned', 'ready_packing'];
  const activeOrders = orders.filter(o => activeStatuses.includes(o.status)).length;
  const waitingCheck = orders.filter(o => o.status === 'waiting_check').length;
  const returned = orders.filter(o => o.status === 'returned').length;
  const doneToday = orders.filter(o => o.status === 'done').length;
  const total = orders.length;

  const errorRate = total > 0 ? (errors.length / total) * 100 : 0;

  return {
    total,
    activeOrders,
    waitingCheck,
    returned,
    doneToday,
    errorRate: errorRate.toFixed(1) + '%'
  };
};

export const summarizePickers = (orders: Order[], pickers: Picker[], errors: OrderError[]) => {
  return pickers.map(picker => {
    const pickerOrders = orders.filter(o => o.pickerId === picker.id);
    const activeOrders = pickerOrders.filter(o => ['assigned', 'picking'].includes(o.status));
    const waitingCheck = pickerOrders.filter(o => o.status === 'waiting_check');
    const returned = pickerOrders.filter(o => o.status === 'returned');
    const doneToday = pickerOrders.filter(o => o.status === 'done');
    
    const pickerErrorIds = new Set(
      errors.filter(e => pickerOrders.find(po => po.id === e.orderId)).map(e => e.id)
    );

    return {
      ...picker,
      activeCount: activeOrders.length,
      waitingCheckCount: waitingCheck.length,
      returnedCount: returned.length,
      doneTodayCount: doneToday.length,
      currentActiveOrder: activeOrders[0] || null,
      errorCountToday: pickerErrorIds.size
    };
  });
};
