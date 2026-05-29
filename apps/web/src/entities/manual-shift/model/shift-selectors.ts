import type {
  ManualShiftDaySummary,
  ManualShiftLineSummary,
  ManualShiftOrder,
  ManualShiftOrderStatus,
  ManualShiftOrderCheckUnit
} from '@wos/domain';
import {
  summarizeManualShiftOrderCheckUnits as domainSummarizeManualShiftOrderCheckUnits,
  canTransitionManualShiftOrderToDoneWithCheckUnits as domainCanTransitionManualShiftOrderToDoneWithCheckUnits
} from '@wos/domain';

// ─────────────────────────────────────────────────────────────────────────────
// ShiftSummary
// ─────────────────────────────────────────────────────────────────────────────

export interface ShiftSummary {
  totalOrders: number;
  queued: number;
  picking: number;
  waitingCheck: number;
  returned: number;
  done: number;
  errorsCount: number;
  /** Integer 0-100. 0 when totalOrders is 0. */
  donePercent: number;
}

export function selectShiftSummary(daySummary: ManualShiftDaySummary): ShiftSummary {
  const {
    totalOrders,
    queuedOrders,
    pickingOrders,
    waitingCheckOrders,
    returnedOrders,
    doneOrders,
    errorsCount
  } = daySummary;
  return {
    totalOrders,
    queued: queuedOrders,
    picking: pickingOrders,
    waitingCheck: waitingCheckOrders,
    returned: returnedOrders,
    done: doneOrders,
    errorsCount,
    donePercent: totalOrders > 0 ? Math.round((doneOrders / totalOrders) * 100) : 0
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LineSummary
// Source rules:
//   identity (lineId, lineName, lineStatus): always from byLine.line
//   errorCount: always from byLine (server-authoritative, separate error table)
//   lineCount/palletCount: summed from raw orders (null treated as 0)
//   status counts + totalOrders: from raw orders when that line has raw order
//     data; falls back to byLine when raw orders are absent (e.g. not loaded)
// Lines present in byLine but absent from raw orders are preserved.
// ─────────────────────────────────────────────────────────────────────────────

export interface LineSummary {
  lineId: string;
  lineName: string;
  lineStatus: 'open' | 'in_progress' | 'done';
  totalOrders: number;
  /** Sum of order.lineCount; null counts as 0. */
  totalLineCount: number;
  /** Sum of order.palletCount; null counts as 0. */
  totalPalletCount: number;
  /** Backlog: no picker has started yet. */
  queued: number;
  picking: number;
  waitingCheck: number;
  returned: number;
  done: number;
  /** From byLine (server-authoritative). */
  errorCount: number;
  /** Integer 0-100. 0 when totalOrders is 0. */
  donePercent: number;
  /** Operational WIP: picking + waitingCheck + returned. */
  wipCount: number;
}

export function selectLineSummaries(
  byLine: ManualShiftLineSummary[],
  orders: ManualShiftOrder[]
): LineSummary[] {
  const ordersByLine = new Map<string, ManualShiftOrder[]>();
  for (const order of orders) {
    const bucket = ordersByLine.get(order.lineId);
    if (bucket) {
      bucket.push(order);
    } else {
      ordersByLine.set(order.lineId, [order]);
    }
  }

  return byLine.map((summary): LineSummary => {
    const lineId = summary.line.id;
    const lineOrders = ordersByLine.get(lineId);
    const hasRawOrders = lineOrders !== undefined;

    let queued = 0,
      picking = 0,
      waitingCheck = 0,
      returned = 0,
      done = 0;
    let totalLineCount = 0,
      totalPalletCount = 0;

    if (hasRawOrders) {
      for (const o of lineOrders) {
        switch (o.status) {
          case 'queued':
            queued++;
            break;
          case 'picking':
            picking++;
            break;
          case 'waiting_check':
            waitingCheck++;
            break;
          case 'returned':
            returned++;
            break;
          case 'done':
            done++;
            break;
        }
        totalLineCount += o.lineCount ?? 0;
        totalPalletCount += o.palletCount ?? 0;
      }
    }

    const totalOrders = hasRawOrders ? lineOrders.length : summary.totalOrders;
    const effectiveQueued = hasRawOrders ? queued : summary.queuedOrders;
    const effectivePicking = hasRawOrders ? picking : summary.pickingOrders;
    const effectiveWaiting = hasRawOrders ? waitingCheck : summary.waitingCheckOrders;
    const effectiveReturned = hasRawOrders ? returned : summary.returnedOrders;
    const effectiveDone = hasRawOrders ? done : summary.doneOrders;

    return {
      lineId,
      lineName: summary.line.name,
      lineStatus: summary.line.status,
      totalOrders,
      totalLineCount,
      totalPalletCount,
      queued: effectiveQueued,
      picking: effectivePicking,
      waitingCheck: effectiveWaiting,
      returned: effectiveReturned,
      done: effectiveDone,
      errorCount: summary.errorCount,
      donePercent: totalOrders > 0 ? Math.round((effectiveDone / totalOrders) * 100) : 0,
      wipCount: effectivePicking + effectiveWaiting + effectiveReturned
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PickerWorkload
// ─────────────────────────────────────────────────────────────────────────────

export interface PickerWorkload {
  /**
   * Stable bucket key. '__unassigned__' when pickerName is null.
   * UI should render this as "לא משויך" / "Unassigned".
   */
  pickerKey: string;
  pickerName: string | null;
  /** First non-null pickerWorkerId found among the picker's orders. */
  pickerWorkerId: string | null;
  totalOrders: number;
  /** Sum of order.lineCount; null treated as 0. Primary workload metric. */
  totalLineCount: number;
  /** Sum of order.palletCount; null treated as 0. */
  totalPalletCount: number;
  /** Backlog orders (no picker started). */
  queued: number;
  picking: number;
  waitingCheck: number;
  returned: number;
  done: number;
  /** Operational WIP: picking + waitingCheck + returned. */
  wipCount: number;
  /** One decimal. null when totalOrders is 0. */
  avgLinesPerOrder: number | null;
  /**
   * Total picking time in whole minutes.
   * Completed cycles: waitingCheckAt - startedAt.
   * In-progress (picking): now - startedAt.
   * null when no timed picking data exists.
   */
  humanMinutes: number | null;
}

export function selectPickerWorkloads(
  orders: ManualShiftOrder[],
  now: Date = new Date()
): PickerWorkload[] {
  const buckets = new Map<string, PickerWorkload>();
  const nowMs = now.getTime();

  for (const order of orders) {
    const key = order.pickerName ?? '__unassigned__';

    if (!buckets.has(key)) {
      buckets.set(key, {
        pickerKey: key,
        pickerName: order.pickerName,
        pickerWorkerId: order.pickerWorkerId,
        totalOrders: 0,
        totalLineCount: 0,
        totalPalletCount: 0,
        queued: 0,
        picking: 0,
        waitingCheck: 0,
        returned: 0,
        done: 0,
        wipCount: 0,
        avgLinesPerOrder: null,
        humanMinutes: null
      });
    }

    const bucket = buckets.get(key)!;
    bucket.totalOrders++;
    bucket.totalLineCount += order.lineCount ?? 0;
    bucket.totalPalletCount += order.palletCount ?? 0;

    switch (order.status) {
      case 'queued':
        bucket.queued++;
        break;
      case 'picking':
        bucket.picking++;
        break;
      case 'waiting_check':
        bucket.waitingCheck++;
        break;
      case 'returned':
        bucket.returned++;
        break;
      case 'done':
        bucket.done++;
        break;
    }

    if (!bucket.pickerWorkerId && order.pickerWorkerId) {
      bucket.pickerWorkerId = order.pickerWorkerId;
    }

    if (order.startedAt) {
      const endMs =
        order.waitingCheckAt != null
          ? new Date(order.waitingCheckAt).getTime()
          : order.status === 'picking'
            ? nowMs
            : null;
      if (endMs !== null) {
        const mins = Math.max(0, Math.floor((endMs - new Date(order.startedAt).getTime()) / 60000));
        bucket.humanMinutes = (bucket.humanMinutes ?? 0) + mins;
      }
    }
  }

  const result: PickerWorkload[] = [];
  for (const workload of buckets.values()) {
    workload.wipCount = workload.picking + workload.waitingCheck + workload.returned;
    workload.avgLinesPerOrder =
      workload.totalOrders > 0
        ? Math.round((workload.totalLineCount / workload.totalOrders) * 10) / 10
        : null;
    result.push(workload);
  }

  result.sort((a, b) => b.totalLineCount - a.totalLineCount);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// CheckQueue
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckQueueEntry {
  orderId: string;
  orderNumber: string | null;
  customerName: string | null;
  pointName: string | null;
  lineCount: number | null;
  pickerName: string | null;
  lineId: string;
  waitingCheckAt: string | null;
  /** Seconds since waitingCheckAt. null when waitingCheckAt is null. */
  waitingSeconds: number | null;
}

export interface CheckQueue {
  orders: CheckQueueEntry[];
  count: number;
  /** Oldest waiting order (lowest waitingCheckAt), or null if queue is empty. */
  oldestOrder: CheckQueueEntry | null;
}

export function selectCheckQueue(
  orders: ManualShiftOrder[],
  now: Date = new Date()
): CheckQueue {
  const waiting = orders.filter((o) => o.status === 'waiting_check');

  waiting.sort((a, b) => {
    if (a.waitingCheckAt === null && b.waitingCheckAt === null) return 0;
    if (a.waitingCheckAt === null) return 1;
    if (b.waitingCheckAt === null) return -1;
    return a.waitingCheckAt < b.waitingCheckAt ? -1 : a.waitingCheckAt > b.waitingCheckAt ? 1 : 0;
  });

  const nowMs = now.getTime();
  const entries: CheckQueueEntry[] = waiting.map((order) => ({
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    pointName: order.pointName,
    lineCount: order.lineCount,
    pickerName: order.pickerName,
    lineId: order.lineId,
    waitingCheckAt: order.waitingCheckAt,
    waitingSeconds:
      order.waitingCheckAt !== null
        ? Math.floor((nowMs - new Date(order.waitingCheckAt).getTime()) / 1000)
        : null
  }));

  return {
    orders: entries,
    count: entries.length,
    oldestOrder: entries[0] ?? null
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ActiveOrders
// ─────────────────────────────────────────────────────────────────────────────

export type ActiveOrderStatus = Exclude<ManualShiftOrderStatus, 'done'>;

export interface ActiveOrder {
  orderId: string;
  orderNumber: string | null;
  customerName: string | null;
  pointName: string | null;
  lineCount: number | null;
  pickerName: string | null;
  lineId: string;
  status: ActiveOrderStatus;
  /**
   * Seconds spent in the current status, using status-specific timestamps:
   *   queued        → createdAt (always present)
   *   picking       → startedAt (null when not yet set → null)
   *   waiting_check → waitingCheckAt (null when not yet set → null)
   *   returned      → null (no returnedAt field; checkedAt excluded from PR1)
   */
  ageSeconds: number | null;
}

export interface DetailOrderRowBase {
  orderId: string;
  status: ManualShiftOrderStatus;
  pointName: string | null;
  customerName: string | null;
  orderNumber: string | null;
  size: ManualShiftOrder['size'] | null;
  lineCount: number | null;
  palletCount: number | null;
  ageSeconds: number | null;
}

export interface LineDetailOrderRow extends DetailOrderRowBase {
  pickerName: string | null;
}

export interface PickerDetailOrderRow extends DetailOrderRowBase {
  lineId: string;
  lineName: string | null;
}

export interface LineDetail {
  summary: LineSummary | null;
  orders: LineDetailOrderRow[];
}

export interface PickerLineBreakdownEntry {
  lineId: string;
  lineName: string;
  totalOrders: number;
  totalLineCount: number;
  totalPalletCount: number;
}

export interface PickerDetail {
  summary: PickerWorkload | null;
  orders: PickerDetailOrderRow[];
  lineBreakdown: PickerLineBreakdownEntry[];
}

export interface OrderDetail {
  orderId: string;
  status: ManualShiftOrderStatus;
  lineId: string;
  lineName: string | null;
  pointName: string | null;
  customerName: string | null;
  orderNumber: string | null;
  pickerName: string | null;
  checkerName: string | null;
  size: ManualShiftOrder['size'] | null;
  lineCount: number | null;
  palletCount: number | null;
  createdAt: string;
  startedAt: string | null;
  waitingCheckAt: string | null;
  checkedAt: string | null;
  finishedAt: string | null;
  ageSeconds: number | null;
}

export function summarizeManualShiftOrderCheckUnits(
  checkUnits: ReadonlyArray<Pick<ManualShiftOrderCheckUnit, 'status'>>
) {
  return domainSummarizeManualShiftOrderCheckUnits(checkUnits);
}

export function canCloseOrderFromCheckUnits(
  checkUnits: ReadonlyArray<Pick<ManualShiftOrderCheckUnit, 'status'>>
): boolean {
  return domainCanTransitionManualShiftOrderToDoneWithCheckUnits(checkUnits);
}

const DETAIL_STATUS_PRIORITY: Record<ManualShiftOrderStatus, number> = {
  returned: 0,
  waiting_check: 1,
  picking: 2,
  queued: 3,
  done: 4
};

function isActiveStatus(status: ManualShiftOrderStatus): status is ActiveOrderStatus {
  return (
    status === 'queued' ||
    status === 'picking' ||
    status === 'waiting_check' ||
    status === 'returned'
  );
}

function resolveStatusTimestamp(order: ManualShiftOrder): string | null {
  switch (order.status) {
    case 'queued':
      return order.createdAt;
    case 'picking':
      return order.startedAt;
    case 'waiting_check':
      return order.waitingCheckAt;
    case 'returned':
      return null;
    case 'done':
      return order.finishedAt;
    default:
      return null;
  }
}

function toAgeSeconds(order: ManualShiftOrder, nowMs: number): number | null {
  const ts = resolveStatusTimestamp(order);
  return ts !== null ? Math.floor((nowMs - new Date(ts).getTime()) / 1000) : null;
}

function sortOrdersByOperationalAttention<T extends ManualShiftOrder>(orders: T[]): T[] {
  return orders
    .map((order, index) => ({ order, index }))
    .sort((a, b) => {
      const byStatus = DETAIL_STATUS_PRIORITY[a.order.status] - DETAIL_STATUS_PRIORITY[b.order.status];
      if (byStatus !== 0) return byStatus;
      return a.index - b.index;
    })
    .map(({ order }) => order);
}

export function selectActiveOrders(
  orders: ManualShiftOrder[],
  now: Date = new Date()
): ActiveOrder[] {
  const nowMs = now.getTime();
  const result: ActiveOrder[] = [];

  for (const order of orders) {
    if (!isActiveStatus(order.status)) continue;

    const ts = resolveStatusTimestamp(order);
    const ageSeconds = ts !== null ? Math.floor((nowMs - new Date(ts).getTime()) / 1000) : null;

    result.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      pointName: order.pointName,
      lineCount: order.lineCount,
      pickerName: order.pickerName,
      lineId: order.lineId,
      status: order.status,
      ageSeconds
    });
  }

  return result;
}

export function selectOrdersForLine(lineId: string, orders: ManualShiftOrder[]): ManualShiftOrder[] {
  return sortOrdersByOperationalAttention(orders.filter((order) => order.lineId === lineId));
}

export function selectOrdersForPicker(
  pickerKey: string,
  orders: ManualShiftOrder[]
): ManualShiftOrder[] {
  return sortOrdersByOperationalAttention(
    orders.filter((order) => (order.pickerName ?? '__unassigned__') === pickerKey)
  );
}

export function selectLineDetail(
  lineId: string,
  lineSummaries: LineSummary[],
  orders: ManualShiftOrder[],
  now: Date = new Date()
): LineDetail {
  const summary = lineSummaries.find((line) => line.lineId === lineId) ?? null;
  if (!summary) {
    return {
      summary: null,
      orders: []
    };
  }

  const nowMs = now.getTime();
  const rows: LineDetailOrderRow[] = selectOrdersForLine(lineId, orders).map((order) => ({
    orderId: order.id,
    status: order.status,
    pointName: order.pointName,
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    pickerName: order.pickerName,
    size: order.size ?? null,
    lineCount: order.lineCount,
    palletCount: order.palletCount,
    ageSeconds: toAgeSeconds(order, nowMs)
  }));

  return {
    summary,
    orders: rows
  };
}

export function selectPickerDetail(
  pickerKey: string,
  pickerWorkloads: PickerWorkload[],
  orders: ManualShiftOrder[],
  lineSummaries: LineSummary[],
  now: Date = new Date()
): PickerDetail {
  const summary = pickerWorkloads.find((picker) => picker.pickerKey === pickerKey) ?? null;
  if (!summary) {
    return {
      summary: null,
      orders: [],
      lineBreakdown: []
    };
  }

  const lineNameById = new Map(lineSummaries.map((line) => [line.lineId, line.lineName]));
  const filteredOrders = selectOrdersForPicker(pickerKey, orders);
  const nowMs = now.getTime();
  const rows: PickerDetailOrderRow[] = filteredOrders.map((order) => ({
    orderId: order.id,
    status: order.status,
    lineId: order.lineId,
    lineName: lineNameById.get(order.lineId) ?? null,
    pointName: order.pointName,
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    size: order.size ?? null,
    lineCount: order.lineCount,
    palletCount: order.palletCount,
    ageSeconds: toAgeSeconds(order, nowMs)
  }));

  const lineBreakdownMap = new Map<string, PickerLineBreakdownEntry>();
  for (const order of filteredOrders) {
    const existing = lineBreakdownMap.get(order.lineId);
    if (existing) {
      existing.totalOrders += 1;
      existing.totalLineCount += order.lineCount ?? 0;
      existing.totalPalletCount += order.palletCount ?? 0;
      continue;
    }

    lineBreakdownMap.set(order.lineId, {
      lineId: order.lineId,
      lineName: lineNameById.get(order.lineId) ?? order.lineId,
      totalOrders: 1,
      totalLineCount: order.lineCount ?? 0,
      totalPalletCount: order.palletCount ?? 0
    });
  }

  const lineBreakdown = Array.from(lineBreakdownMap.values()).sort(
    (a, b) => b.totalLineCount - a.totalLineCount
  );

  return {
    summary,
    orders: rows,
    lineBreakdown
  };
}

export function selectOrderDetail(
  orderId: string,
  orders: ManualShiftOrder[],
  lineSummaries: LineSummary[],
  now: Date = new Date()
): OrderDetail | null {
  const order = orders.find((item) => item.id === orderId);
  if (!order) return null;

  const lineName = lineSummaries.find((line) => line.lineId === order.lineId)?.lineName ?? null;

  return {
    orderId: order.id,
    status: order.status,
    lineId: order.lineId,
    lineName,
    pointName: order.pointName,
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    pickerName: order.pickerName,
    checkerName: order.checkerName,
    size: order.size ?? null,
    lineCount: order.lineCount,
    palletCount: order.palletCount,
    createdAt: order.createdAt,
    startedAt: order.startedAt,
    waitingCheckAt: order.waitingCheckAt,
    checkedAt: order.checkedAt,
    finishedAt: order.finishedAt,
    ageSeconds: toAgeSeconds(order, now.getTime())
  };
}
