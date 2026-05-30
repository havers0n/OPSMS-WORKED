import { ApiError } from '../../errors.js';
import type { ManualShiftOrderCheckUnitStatus, ManualShiftOrderStatus } from '@wos/domain';

export function manualShiftNotFound(shiftId: string) {
  return new ApiError(404, 'MANUAL_SHIFT_NOT_FOUND', `Manual shift ${shiftId} was not found.`);
}

export function manualShiftLineNotFound(lineId: string) {
  return new ApiError(404, 'MANUAL_SHIFT_LINE_NOT_FOUND', `Manual shift line ${lineId} was not found.`);
}

export function manualShiftOrderNotFound(orderId: string) {
  return new ApiError(404, 'MANUAL_SHIFT_ORDER_NOT_FOUND', `Manual shift order ${orderId} was not found.`);
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
