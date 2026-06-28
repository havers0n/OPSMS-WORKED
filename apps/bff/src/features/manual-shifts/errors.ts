import { ApiError } from '../../errors.js';
import type { ManualShiftOrderCheckUnitStatus, ManualShiftOrderStatus } from '@wos/domain';
import type { MonthlyImportShiftCounts } from './repo.js';

export function manualShiftNotFound(shiftId: string) {
  return new ApiError(404, 'MANUAL_SHIFT_NOT_FOUND', `Manual shift ${shiftId} was not found.`);
}

export function manualShiftLineNotFound(lineId: string) {
  return new ApiError(404, 'MANUAL_SHIFT_LINE_NOT_FOUND', `Manual shift line ${lineId} was not found.`);
}

export function manualShiftLineNotFoundByName(lineName: string) {
  return new ApiError(404, 'MANUAL_SHIFT_LINE_NOT_FOUND', `Manual shift line "${lineName}" was not found.`);
}

export function manualShiftLineAreaMismatch(lineName: string, expectedArea: string) {
  return new ApiError(400, 'LINE_AREA_MISMATCH', `Line "${lineName}" does not belong to distribution area "${expectedArea}".`);
}

export function manualShiftOrderNotFound(orderId: string) {
  return new ApiError(404, 'MANUAL_SHIFT_ORDER_NOT_FOUND', `Manual shift order ${orderId} was not found.`);
}

export function manualShiftImportShiftNotFound(shiftId: string) {
  return new ApiError(404, 'SHIFT_NOT_FOUND', `Manual shift ${shiftId} was not found.`);
}

export function manualShiftImportShiftNotActive(shiftId: string) {
  return new ApiError(409, 'SHIFT_NOT_ACTIVE', `Manual shift ${shiftId} is not active.`);
}

export function manualShiftImportShiftDateMismatch(shiftId: string, expectedDate: string, previewDate: string) {
  return new ApiError(
    409,
    'SHIFT_DATE_MISMATCH',
    `Manual shift ${shiftId} date ${expectedDate} does not match import date ${previewDate}.`
  );
}

export function manualShiftImportShiftNotEmpty(shiftId: string) {
  return new ApiError(409, 'SHIFT_NOT_EMPTY', `Manual shift ${shiftId} already has lines or orders.`);
}

export function manualShiftMonthlyImportRequiresReplaceMode(
  shiftId: string,
  details?: MonthlyImportShiftCounts
) {
  return new ApiError(
    409,
    'MONTHLY_IMPORT_REQUIRES_REPLACE_MODE',
    `Manual shift ${shiftId} already has lines or orders. Use replace mode to re-import.`,
    details
  );
}

export function manualShiftMonthlyReplaceNotSafe(
  shiftId: string,
  reasons: string[]
) {
  return new ApiError(
    409,
    'MONTHLY_REPLACE_NOT_SAFE',
    `Cannot replace monthly import for shift ${shiftId}. Operational work already started.`,
    { shiftId, reasons }
  );
}

export function manualShiftMonthlyImportBlockingWarnings(details: unknown) {
  return new ApiError(
    409,
    'MONTHLY_IMPORT_BLOCKED_BY_WARNINGS',
    'Monthly import preview contains blocking warnings.',
    details
  );
}

export function manualShiftImportInvalidPreviewPayload() {
  return new ApiError(400, 'INVALID_PREVIEW_PAYLOAD', 'Import preview payload is invalid.');
}

export function manualShiftImportForbidden() {
  return new ApiError(403, 'FORBIDDEN', 'You do not have permission to import into this shift.');
}

export function manualShiftAlreadyActive(date: string) {
  return new ApiError(409, 'MANUAL_SHIFT_ALREADY_ACTIVE', `An active manual shift already exists for ${date}.`);
}

export function manualShiftClosed(shiftId: string) {
  return new ApiError(409, 'MANUAL_SHIFT_CLOSED', `Manual shift ${shiftId} is closed.`);
}

export function invalidManualShiftOrderTransition(
  from: ManualShiftOrderStatus,
  to: ManualShiftOrderStatus
) {
  return new ApiError(
    409,
    'MANUAL_SHIFT_INVALID_STATUS_TRANSITION',
    `Manual shift order transition ${from} -> ${to} is not allowed.`
  );
}

export function invalidManualShiftOrderCreateStatus(status: string) {
  return new ApiError(
    422,
    'MANUAL_SHIFT_INVALID_INITIAL_STATUS',
    `Manual shift order cannot be created with initial status ${status}.`
  );
}

export function manualShiftWorkerNotFound(workerId: string) {
  return new ApiError(404, 'MANUAL_SHIFT_WORKER_NOT_FOUND', `Manual shift worker ${workerId} was not found.`);
}

export function manualShiftPickerWorkerInvalid(
  workerId: string,
  reason: 'WRONG_TENANT' | 'WRONG_SHIFT' | 'INACTIVE'
) {
  return new ApiError(
    422,
    'MANUAL_SHIFT_PICKER_WORKER_INVALID',
    `Manual shift worker ${workerId} cannot be assigned as picker (${reason}).`
  );
}

export function manualShiftWorkerAuthUserForbidden(workerId: string) {
  return new ApiError(
    403,
    'WORKER_AUTH_USER_FORBIDDEN',
    `Worker ${workerId} does not belong to current tenant.`
  );
}

export function manualShiftWorkerAuthUserNotInTenant(authUserId: string) {
  return new ApiError(
    422,
    'WORKER_AUTH_USER_FORBIDDEN',
    `Selected auth user ${authUserId} does not belong to current tenant.`
  );
}

export function manualShiftWorkerAuthUserAlreadyBound(authUserId: string, existingWorkerId: string) {
  return new ApiError(
    409,
    'WORKER_AUTH_USER_ALREADY_BOUND',
    `Auth user ${authUserId} is already bound to worker ${existingWorkerId}.`
  );
}

export function manualShiftOrderNoPickerWorker(orderId: string) {
  return new ApiError(
    422,
    'MANUAL_SHIFT_ORDER_NO_PICKER_WORKER',
    `Order ${orderId} has no picker worker assigned. Set pickerWorkerId before starting picking.`
  );
}

export function manualShiftOrderNotPickable(orderId: string, status: string) {
  return new ApiError(
    409,
    'MANUAL_SHIFT_ORDER_NOT_PICKABLE',
    `Order ${orderId} cannot start picking from status '${status}'.`
  );
}

export function manualShiftLineDeleteBlocked() {
  return new ApiError(
    409,
    'MANUAL_SHIFT_LINE_NOT_EMPTY',
    'אי אפשר למחוק קו שיש בו נקודות. מחק או העבר את הנקודות קודם.'
  );
}

export function manualShiftOrderCheckUnitNotFound(checkUnitId: string) {
  return new ApiError(
    404,
    'MANUAL_SHIFT_ORDER_CHECK_UNIT_NOT_FOUND',
    `Manual shift order check unit ${checkUnitId} was not found.`
  );
}

export function invalidManualShiftOrderCheckUnitTransition(
  from: ManualShiftOrderCheckUnitStatus,
  to: ManualShiftOrderCheckUnitStatus
) {
  return new ApiError(
    409,
    'MANUAL_SHIFT_CHECK_UNIT_INVALID_STATUS_TRANSITION',
    `Manual shift order check unit transition ${from} -> ${to} is not allowed.`
  );
}

export function manualShiftOrderDoneBlockedByCheckUnits(orderId: string) {
  return new ApiError(
    409,
    'MANUAL_SHIFT_ORDER_DONE_BLOCKED_BY_CHECK_UNITS',
    `Order ${orderId} cannot be moved to done while check units remain open or returned.`
  );
}

export function manualShiftOrderDoneBlockedByOpenAshlama(orderId: string) {
  return new ApiError(
    409,
    'MANUAL_SHIFT_ORDER_DONE_BLOCKED_BY_OPEN_ASHLAMA',
    `Order ${orderId} cannot be moved to done while open ashlama exists.`
  );
}

export function manualShiftOrderCheckUnitNumberConflict(orderId: string) {
  return new ApiError(
    409,
    'MANUAL_SHIFT_ORDER_CHECK_UNIT_NUMBER_CONFLICT',
    `Failed to allocate check unit number for order ${orderId}. Please retry.`
  );
}

export function manualShiftOrderCheckUnitReturnedReasonRequired(checkUnitId: string) {
  return new ApiError(
    422,
    'MANUAL_SHIFT_CHECK_UNIT_RETURNED_REASON_REQUIRED',
    `Manual shift order check unit ${checkUnitId} requires a repair reason when marked returned.`
  );
}

export function manualShiftAshlamaRequiresReturnedCheckUnit(checkUnitId: string) {
  return new ApiError(
    422,
    'MANUAL_SHIFT_ASHLAMA_REQUIRES_RETURNED_CHECK_UNIT',
    `Ashlama can be created only for returned check unit ${checkUnitId}.`
  );
}

export function manualShiftAshlamaRequiresMissingProductReason(checkUnitId: string) {
  return new ApiError(
    422,
    'MANUAL_SHIFT_ASHLAMA_REQUIRES_MISSING_PRODUCT_REASON',
    `Ashlama can be created only when check unit ${checkUnitId} reason is מוצר אזל.`
  );
}

export function manualShiftAshlamaDuplicateOpenForCheckUnit(checkUnitId: string) {
  return new ApiError(
    409,
    'MANUAL_SHIFT_ASHLAMA_DUPLICATE_OPEN_FOR_CHECK_UNIT',
    `Open ashlama already exists for check unit ${checkUnitId}.`
  );
}

export function manualShiftAshlamaCheckUnitOrderMismatch(checkUnitId: string, orderId: string) {
  return new ApiError(
    422,
    'MANUAL_SHIFT_ASHLAMA_CHECK_UNIT_ORDER_MISMATCH',
    `Check unit ${checkUnitId} does not belong to order ${orderId}.`
  );
}

// --- Demand Planning Draft errors ---

export function demandPlanningDraftNotFound(draftId: string) {
  return new ApiError(404, 'DEMAND_PLANNING_DRAFT_NOT_FOUND', `Demand planning draft ${draftId} was not found.`);
}

export function demandPlanningDraftNotMutable(draftId: string, status: string) {
  return new ApiError(
    409,
    'DEMAND_PLANNING_DRAFT_NOT_MUTABLE',
    `Demand planning draft ${draftId} has status '${status}' and cannot be modified.`
  );
}

export function demandPlanningAllocationOverflow(rawDemandRowId: string, requested: number, available: number) {
  return new ApiError(
    422,
    'DEMAND_PLANNING_ALLOCATION_OVERFLOW',
    `Allocation for raw demand row ${rawDemandRowId}: requested ${requested}, but only ${available} remaining.`
  );
}

export function demandPlanningRawDemandRowNotFound(rawDemandRowId: string) {
  return new ApiError(
    404,
    'DEMAND_PLANNING_RAW_DEMAND_ROW_NOT_FOUND',
    `Raw demand row ${rawDemandRowId} was not found in this batch/tenant.`
  );
}

export function demandPlanningBucketNotFound(bucketKey: string) {
  return new ApiError(
    404,
    'DEMAND_PLANNING_BUCKET_NOT_FOUND',
    `Bucket '${bucketKey}' was not found in the plan.`
  );
}

export function demandPlanningDraftAlreadyApplied(draftId: string) {
  return new ApiError(
    409,
    'DEMAND_PLANNING_DRAFT_ALREADY_APPLIED',
    `Demand planning draft ${draftId} was already published.`
  );
}

export function demandPlanningTargetDateAmbiguous(draftId: string, dates: string[]) {
  return new ApiError(
    409,
    'DEMAND_PLANNING_TARGET_DATE_AMBIGUOUS',
    `Demand planning draft ${draftId} contains multiple planned delivery dates: ${dates.join(', ')}.`
  );
}

export function demandPlanningExistingLineConflict(lineName: string, distributionArea: string | null) {
  const suffix = distributionArea ? ` in distribution area "${distributionArea}"` : '';
  return new ApiError(
    409,
    'DEMAND_PLANNING_EXISTING_LINE_CONFLICT',
    `Target shift contains multiple active lines named "${lineName}"${suffix}.`
  );
}

export function demandPlanningNoPublishableRows(draftId: string) {
  return new ApiError(
    422,
    'DEMAND_PLANNING_NO_PUBLISHABLE_ROWS',
    `Demand planning draft ${draftId} has no publishable rows.`
  );
}
