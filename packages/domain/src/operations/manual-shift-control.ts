import { z } from 'zod';

export const manualShiftWorkerRoleSchema = z.enum(['picker', 'checker', 'packer', 'other']);
export type ManualShiftWorkerRole = z.infer<typeof manualShiftWorkerRoleSchema>;

export const MANUAL_SHIFT_WORKER_ROLE_LABELS: Record<ManualShiftWorkerRole, string> = {
  picker: 'מלקט',
  checker: 'בודק',
  packer: 'אורז',
  other: 'אחר'
};

export const manualShiftWorkerSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shiftId: z.string().uuid(),
  name: z.string().trim().min(1),
  role: manualShiftWorkerRoleSchema,
  active: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ManualShiftWorker = z.infer<typeof manualShiftWorkerSchema>;

export const manualShiftSessionStatusSchema = z.enum(['active', 'closed']);
export type ManualShiftSessionStatus = z.infer<typeof manualShiftSessionStatusSchema>;

export const manualShiftLineStatusSchema = z.enum(['open', 'in_progress', 'done']);
export type ManualShiftLineStatus = z.infer<typeof manualShiftLineStatusSchema>;

export const manualShiftOrderStatusSchema = z.enum([
  'queued',
  'picking',
  'waiting_check',
  'returned',
  'done'
]);
export type ManualShiftOrderStatus = z.infer<typeof manualShiftOrderStatusSchema>;

export const manualShiftOrderSizeSchema = z.enum(['S', 'M', 'L', 'XL', 'unknown']);
export type ManualShiftOrderSize = z.infer<typeof manualShiftOrderSizeSchema>;

export const manualShiftOrderCheckUnitStatusSchema = z.enum([
  'open',
  'checked',
  'returned',
  'voided'
]);
export type ManualShiftOrderCheckUnitStatus = z.infer<typeof manualShiftOrderCheckUnitStatusSchema>;

export const manualShiftOrderErrorTypeSchema = z.enum([
  'wrong_quantity',
  'wrong_item',
  'missing_item',
  'bad_packing',
  'small_items_loose',
  'damaged',
  'other'
]);
export type ManualShiftOrderErrorType = z.infer<typeof manualShiftOrderErrorTypeSchema>;

export const manualShiftOrderEventTypeSchema = z.enum([
  'created',
  'updated',
  'status_changed',
  'error_reported',
  'error_fixed',
  'comment_updated',
  'picker_changed',
  'checker_changed',
  'bulk_imported',
  'point_deleted',
  'point_restored',
  'check_unit_created',
  'check_unit_status_changed',
  'check_unit_note_changed'
]);
export type ManualShiftOrderEventType = z.infer<typeof manualShiftOrderEventTypeSchema>;

export const manualShiftLineEventTypeSchema = z.enum(['line_deleted', 'line_restored']);
export type ManualShiftLineEventType = z.infer<typeof manualShiftLineEventTypeSchema>;

export const manualShiftSessionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  date: z.string().trim().min(1),
  name: z.string().trim().min(1),
  status: manualShiftSessionStatusSchema,
  createdBy: z.string().trim().min(1).nullable(),
  createdAt: z.string(),
  closedAt: z.string().nullable()
});
export type ManualShiftSession = z.infer<typeof manualShiftSessionSchema>;

export const manualShiftLineSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shiftId: z.string().uuid(),
  name: z.string().trim().min(1),
  sortOrder: z.number().int(),
  status: manualShiftLineStatusSchema,
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
  deletedByProfileId: z.string().uuid().nullable(),
  deletedByName: z.string().trim().min(1).nullable(),
  deleteReason: z.string().trim().min(1).nullable()
});
export type ManualShiftLine = z.infer<typeof manualShiftLineSchema>;

export const manualShiftOrderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shiftId: z.string().uuid(),
  lineId: z.string().uuid(),
  orderNumber: z.string().trim().min(1).nullable(),
  customerName: z.string().trim().min(1).nullable(),
  pointName: z.string().trim().min(1).nullable(),
  palletCount: z.number().min(0).nullable(),
  pickerName: z.string().trim().min(1).nullable(),
  pickerWorkerId: z.string().uuid().nullable(),
  checkerName: z.string().trim().min(1).nullable(),
  lineCount: z.number().int().positive().nullable(),
  size: manualShiftOrderSizeSchema,
  status: manualShiftOrderStatusSchema,
  startedAt: z.string().nullable(),
  waitingCheckAt: z.string().nullable(),
  checkedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  comment: z.string().trim().min(1).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  deletedByProfileId: z.string().uuid().nullable(),
  deletedByName: z.string().trim().min(1).nullable(),
  deleteReason: z.string().trim().min(1).nullable()
});
export type ManualShiftOrder = z.infer<typeof manualShiftOrderSchema>;

export const manualShiftOrderCheckUnitSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shiftId: z.string().uuid(),
  lineId: z.string().uuid(),
  orderId: z.string().uuid(),
  unitNumber: z.number().int().positive(),
  status: manualShiftOrderCheckUnitStatusSchema,
  note: z.string().trim().min(1).nullable(),
  reason: z.string().trim().min(1).nullable(),
  checkedAt: z.string().nullable(),
  returnedAt: z.string().nullable(),
  voidedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ManualShiftOrderCheckUnit = z.infer<typeof manualShiftOrderCheckUnitSchema>;

export const manualShiftLineEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shiftId: z.string().uuid(),
  lineId: z.string().uuid(),
  eventType: manualShiftLineEventTypeSchema,
  actorName: z.string().trim().min(1).nullable(),
  actorProfileId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string()
});
export type ManualShiftLineEvent = z.infer<typeof manualShiftLineEventSchema>;

export const manualShiftOrderEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shiftId: z.string().uuid(),
  lineId: z.string().uuid(),
  orderId: z.string().uuid(),
  eventType: manualShiftOrderEventTypeSchema,
  actorName: z.string().trim().min(1).nullable(),
  actorProfileId: z.string().uuid().nullable(),
  fromStatus: manualShiftOrderStatusSchema.nullable(),
  toStatus: manualShiftOrderStatusSchema.nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string()
});
export type ManualShiftOrderEvent = z.infer<typeof manualShiftOrderEventSchema>;

export const manualShiftOrderErrorSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shiftId: z.string().uuid(),
  lineId: z.string().uuid(),
  orderId: z.string().uuid(),
  type: manualShiftOrderErrorTypeSchema,
  comment: z.string().trim().min(1).nullable(),
  createdBy: z.string().trim().min(1).nullable(),
  createdAt: z.string(),
  fixedAt: z.string().nullable()
});
export type ManualShiftOrderError = z.infer<typeof manualShiftOrderErrorSchema>;

export const manualShiftLineSummarySchema = z.object({
  line: manualShiftLineSchema,
  totalOrders: z.number().int().min(0),
  queuedOrders: z.number().int().min(0),
  pickingOrders: z.number().int().min(0),
  waitingCheckOrders: z.number().int().min(0),
  returnedOrders: z.number().int().min(0),
  doneOrders: z.number().int().min(0),
  errorCount: z.number().int().min(0)
});
export type ManualShiftLineSummary = z.infer<typeof manualShiftLineSummarySchema>;

export const manualShiftTodayResponseSchema = z.object({
  shift: manualShiftSessionSchema.nullable(),
  lines: z.array(manualShiftLineSummarySchema)
});
export type ManualShiftTodayResponse = z.infer<typeof manualShiftTodayResponseSchema>;

export const manualShiftPeopleSummaryItemSchema = z.object({
  pickerName: z.string().trim().min(1),
  activeOrdersCount: z.number().int().min(0),
  waitingCheckCount: z.number().int().min(0),
  returnedCount: z.number().int().min(0),
  doneCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  currentActiveOrder: manualShiftOrderSchema.nullable()
});
export type ManualShiftPeopleSummaryItem = z.infer<typeof manualShiftPeopleSummaryItemSchema>;

export const manualShiftPeopleSummarySchema = z.object({
  shiftId: z.string().uuid(),
  items: z.array(manualShiftPeopleSummaryItemSchema)
});
export type ManualShiftPeopleSummary = z.infer<typeof manualShiftPeopleSummarySchema>;

export const manualShiftDaySummaryByErrorSchema = z.object({
  type: manualShiftOrderErrorTypeSchema,
  count: z.number().int().min(0)
});
export type ManualShiftDaySummaryByError = z.infer<typeof manualShiftDaySummaryByErrorSchema>;

export const manualShiftDaySummaryByPickerSchema = z.object({
  pickerName: z.string().trim().min(1),
  totalOrders: z.number().int().min(0),
  queuedOrders: z.number().int().min(0),
  pickingOrders: z.number().int().min(0),
  waitingCheckOrders: z.number().int().min(0),
  returnedOrders: z.number().int().min(0),
  doneOrders: z.number().int().min(0),
  errorCount: z.number().int().min(0)
});
export type ManualShiftDaySummaryByPicker = z.infer<typeof manualShiftDaySummaryByPickerSchema>;

export const manualShiftDaySummarySchema = z.object({
  shiftId: z.string().uuid(),
  totalOrders: z.number().int().min(0),
  queuedOrders: z.number().int().min(0),
  pickingOrders: z.number().int().min(0),
  waitingCheckOrders: z.number().int().min(0),
  returnedOrders: z.number().int().min(0),
  doneOrders: z.number().int().min(0),
  errorsCount: z.number().int().min(0),
  byErrorType: z.array(manualShiftDaySummaryByErrorSchema),
  byLine: z.array(manualShiftLineSummarySchema),
  byPicker: z.array(manualShiftDaySummaryByPickerSchema)
});
export type ManualShiftDaySummary = z.infer<typeof manualShiftDaySummarySchema>;

export const manualShiftBulkAddInputRowSchema = z.object({
  raw: z.string(),
  pointName: z.string().trim().min(1),
  orderNumber: z.string().trim().min(1).nullable(),
  pickerName: z.string().trim().min(1).nullable(),
  lineCount: z.number().int().positive().nullable(),
  palletCount: z.number().min(0).nullable(),
  size: manualShiftOrderSizeSchema
});
export type ManualShiftBulkAddInputRow = z.infer<typeof manualShiftBulkAddInputRowSchema>;

export const manualShiftBulkAddResultSchema = z.object({
  createdCount: z.number().int().min(0),
  rows: z.array(manualShiftBulkAddInputRowSchema),
  skippedRows: z.array(z.string())
});
export type ManualShiftBulkAddResult = z.infer<typeof manualShiftBulkAddResultSchema>;

export const manualShiftOrderCheckUnitProgressSchema = z.object({
  totalUnits: z.number().int().min(0),
  activeUnits: z.number().int().min(0),
  checkedUnits: z.number().int().min(0),
  openUnits: z.number().int().min(0),
  returnedUnits: z.number().int().min(0),
  voidedUnits: z.number().int().min(0),
  physicallyChecked: z.boolean(),
  partiallyChecked: z.boolean()
});
export type ManualShiftOrderCheckUnitProgress = z.infer<typeof manualShiftOrderCheckUnitProgressSchema>;

const allowedManualShiftOrderTransitions: Record<
  ManualShiftOrderStatus,
  readonly ManualShiftOrderStatus[]
> = {
  queued: ['picking'],
  picking: ['waiting_check'],
  waiting_check: ['done', 'returned'],
  returned: ['waiting_check'],
  done: []
};

export function calculateSizeFromLineCount(
  lineCount: number | null | undefined
): ManualShiftOrderSize {
  if (!Number.isInteger(lineCount) || (lineCount ?? 0) <= 0) {
    return 'unknown';
  }

  const normalizedLineCount = lineCount as number;

  if (normalizedLineCount <= 3) return 'S';
  if (normalizedLineCount <= 8) return 'M';
  if (normalizedLineCount <= 20) return 'L';
  return 'XL';
}

export function canTransitionManualShiftOrderStatus(
  from: ManualShiftOrderStatus,
  to: ManualShiftOrderStatus
): boolean {
  return allowedManualShiftOrderTransitions[from].includes(to);
}

export function deriveManualShiftLineStatus(
  orders: ReadonlyArray<Pick<ManualShiftOrder, 'status'>>
): ManualShiftLineStatus {
  if (orders.length === 0) {
    return 'open';
  }

  if (orders.every((order) => order.status === 'queued')) {
    return 'open';
  }

  if (orders.every((order) => order.status === 'done')) {
    return 'done';
  }

  return 'in_progress';
}

export function summarizeManualShiftOrderCheckUnits(
  checkUnits: ReadonlyArray<Pick<ManualShiftOrderCheckUnit, 'status'>>
): ManualShiftOrderCheckUnitProgress {
  let checkedUnits = 0;
  let openUnits = 0;
  let returnedUnits = 0;
  let voidedUnits = 0;

  for (const unit of checkUnits) {
    switch (unit.status) {
      case 'checked':
        checkedUnits += 1;
        break;
      case 'open':
        openUnits += 1;
        break;
      case 'returned':
        returnedUnits += 1;
        break;
      case 'voided':
        voidedUnits += 1;
        break;
    }
  }

  const totalUnits = checkUnits.length;
  const activeUnits = checkedUnits + openUnits + returnedUnits;
  const physicallyChecked = activeUnits > 0 && openUnits === 0 && returnedUnits === 0;
  const partiallyChecked = checkedUnits > 0 && openUnits > 0;

  return {
    totalUnits,
    activeUnits,
    checkedUnits,
    openUnits,
    returnedUnits,
    voidedUnits,
    physicallyChecked,
    partiallyChecked
  };
}

export function canTransitionManualShiftOrderToDoneWithCheckUnits(
  checkUnits: ReadonlyArray<Pick<ManualShiftOrderCheckUnit, 'status'>>,
  expectedUnitsCount?: number | null
): boolean {
  if (expectedUnitsCount == null || expectedUnitsCount <= 0) {
    return false;
  }

  if (checkUnits.length === 0) {
    return false;
  }

  const progress = summarizeManualShiftOrderCheckUnits(checkUnits);
  if (progress.checkedUnits < expectedUnitsCount) {
    return false;
  }

  if (progress.activeUnits < expectedUnitsCount) {
    return false;
  }

  return progress.activeUnits > 0 && progress.openUnits === 0 && progress.returnedUnits === 0;
}
