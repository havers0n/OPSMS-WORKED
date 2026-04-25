import { ApiError } from '../../errors.js';

export class ExecutionContainerNotFoundError extends Error {
  constructor() {
    super('Container was not found for canonical execution.');
  }
}

export class ExecutionContainerNotPlacedError extends Error {
  constructor() {
    super('Container does not have an active execution location.');
  }
}

export class ExecutionInventoryUnitNotFoundError extends Error {
  constructor() {
    super('Inventory unit was not found for canonical execution.');
  }
}

export class ExecutionInvalidSplitQuantityError extends Error {
  constructor() {
    super('Split quantity must be greater than zero and less than the source quantity.');
  }
}

export class ExecutionSerialSplitNotAllowedError extends Error {
  constructor() {
    super('Serial-tracked inventory units cannot be split.');
  }
}

export class ExecutionOpenedPackagingSplitNotAllowedError extends Error {
  constructor() {
    super('Opened packaged inventory cannot be split without repacking.');
  }
}

export class ExecutionSealedSplitRequiresWholePacksError extends Error {
  constructor() {
    super('Sealed packaged inventory can only be split on whole-pack boundaries.');
  }
}

export class ExecutionTargetContainerNotFoundError extends Error {
  constructor() {
    super('Target container was not found for canonical execution.');
  }
}

export class ExecutionTargetContainerTenantMismatchError extends Error {
  constructor() {
    super('Target container does not belong to the same tenant as the source inventory unit.');
  }
}

export class ExecutionTargetContainerSameAsSourceError extends Error {
  constructor() {
    super('Stage 4 split does not support using the source container as the target container.');
  }
}

export class ExecutionTargetContainerNotPlacedError extends Error {
  constructor() {
    super('Target container does not have an active execution location.');
  }
}

export class ExecutionSourceLocationNotExactlyOneContainerError extends Error {
  constructor() {
    super('Source location must contain exactly one active container for swap.');
  }
}

export class ExecutionTargetLocationEmptyError extends Error {
  constructor() {
    super('Target location is empty; use move instead of swap.');
  }
}

export class ExecutionTargetLocationNotExactlyOneContainerError extends Error {
  constructor() {
    super('Target location must contain exactly one active container for swap.');
  }
}

export class ExecutionTargetLocationOccupantMismatchError extends Error {
  constructor() {
    super('Selected target container no longer matches the target location occupant.');
  }
}

export class ExecutionTargetLocationNotFoundError extends Error {
  constructor() {
    super('Target location was not found for canonical execution.');
  }
}

export class ExecutionTargetLocationTenantMismatchError extends Error {
  constructor() {
    super('Target location does not belong to the same tenant as the container.');
  }
}

export class ExecutionTargetLocationNotActiveError extends Error {
  constructor() {
    super('Target location is not active.');
  }
}

export class ExecutionTargetLocationOccupiedError extends Error {
  constructor() {
    super('Target location already has an active container.');
  }
}

export class ExecutionTargetLocationSameAsSourceError extends Error {
  constructor() {
    super('Container is already at the target execution location.');
  }
}

export class ExecutionTargetLocationDimensionUnknownError extends Error {
  constructor() {
    super('Target location enforces dimensions that are missing on the container type.');
  }
}

export class ExecutionTargetLocationDimensionOverflowError extends Error {
  constructor() {
    super('Container dimensions exceed the target location limits.');
  }
}

export class ExecutionTargetLocationWeightUnknownError extends Error {
  constructor() {
    super('Target location enforces weight, but container gross weight cannot be computed.');
  }
}

export class ExecutionTargetLocationWeightOverflowError extends Error {
  constructor() {
    super('Container gross weight exceeds the target location weight limit.');
  }
}

export function mapExecutionMoveError(error: unknown): ApiError | null {
  if (error instanceof ExecutionContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', 'Container was not found.');
  }

  if (error instanceof ExecutionContainerNotPlacedError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', 'Container is not currently placed.');
  }

  if (error instanceof ExecutionTargetLocationNotFoundError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell was not found.');
  }

  if (error instanceof ExecutionTargetLocationTenantMismatchError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell belongs to a different tenant.');
  }

  if (error instanceof ExecutionTargetLocationNotActiveError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell is not currently writable.');
  }

  if (error instanceof ExecutionTargetLocationSameAsSourceError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', 'Container is already in the target cell.');
  }

  if (error instanceof ExecutionTargetLocationOccupiedError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', 'Target cell is already occupied.');
  }

  if (error instanceof ExecutionTargetLocationDimensionUnknownError) {
    return new ApiError(
      409,
      'PLACEMENT_CONSTRAINT',
      'Target cell enforces dimensions that are missing on this container type.'
    );
  }

  if (error instanceof ExecutionTargetLocationDimensionOverflowError) {
    return new ApiError(409, 'PLACEMENT_CONSTRAINT', 'Container dimensions exceed the target cell limits.');
  }

  if (error instanceof ExecutionTargetLocationWeightUnknownError) {
    return new ApiError(
      409,
      'PLACEMENT_CONSTRAINT',
      'Target cell enforces weight, but the container gross weight cannot be computed.'
    );
  }

  if (error instanceof ExecutionTargetLocationWeightOverflowError) {
    return new ApiError(409, 'PLACEMENT_CONSTRAINT', 'Container gross weight exceeds the target cell limit.');
  }

  return null;
}

export function mapExecutionLocationMoveError(error: unknown): ApiError | null {
  if (error instanceof ExecutionContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', 'Container was not found.');
  }

  if (error instanceof ExecutionContainerNotPlacedError) {
    return new ApiError(409, 'CONTAINER_LOCATION_UNSET', 'Container does not have a current execution location.');
  }

  if (error instanceof ExecutionTargetLocationNotFoundError) {
    return new ApiError(404, 'LOCATION_NOT_FOUND', 'Target location was not found.');
  }

  if (error instanceof ExecutionTargetLocationTenantMismatchError) {
    return new ApiError(409, 'LOCATION_TENANT_MISMATCH', 'Target location belongs to a different tenant.');
  }

  if (error instanceof ExecutionTargetLocationNotActiveError) {
    return new ApiError(409, 'LOCATION_NOT_WRITABLE', 'Target location is not active.');
  }

  if (error instanceof ExecutionTargetLocationSameAsSourceError) {
    return new ApiError(409, 'SAME_LOCATION', 'Container is already at the target location.');
  }

  if (error instanceof ExecutionTargetLocationOccupiedError) {
    return new ApiError(409, 'LOCATION_OCCUPIED', 'Target location already has an active container.');
  }

  if (error instanceof ExecutionTargetLocationDimensionUnknownError) {
    return new ApiError(
      409,
      'LOCATION_DIMENSION_UNKNOWN',
      'Target location enforces dimensions that are missing on this container type.'
    );
  }

  if (error instanceof ExecutionTargetLocationDimensionOverflowError) {
    return new ApiError(409, 'LOCATION_DIMENSION_OVERFLOW', 'Container dimensions exceed the target location limits.');
  }

  if (error instanceof ExecutionTargetLocationWeightUnknownError) {
    return new ApiError(
      409,
      'LOCATION_WEIGHT_UNKNOWN',
      'Target location enforces weight, but the container gross weight cannot be computed.'
    );
  }

  if (error instanceof ExecutionTargetLocationWeightOverflowError) {
    return new ApiError(409, 'LOCATION_WEIGHT_OVERFLOW', 'Container gross weight exceeds the target location weight limit.');
  }

  return null;
}

export function mapExecutionTransferError(error: unknown): ApiError | null {
  if (error instanceof ExecutionInventoryUnitNotFoundError) {
    return new ApiError(404, 'INVENTORY_UNIT_NOT_FOUND', 'Inventory unit was not found.');
  }

  if (error instanceof ExecutionInvalidSplitQuantityError) {
    return new ApiError(
      409,
      'INVALID_SPLIT_QUANTITY',
      'Split quantity must be greater than zero and less than the source quantity.'
    );
  }

  if (error instanceof ExecutionSerialSplitNotAllowedError) {
    return new ApiError(409, 'SERIAL_SPLIT_NOT_ALLOWED', 'Serial-tracked inventory units cannot be split.');
  }

  if (error instanceof ExecutionOpenedPackagingSplitNotAllowedError) {
    return new ApiError(422, 'OPENED_PACKAGING_SPLIT_NOT_ALLOWED', 'Opened packaged inventory cannot be split without repacking.');
  }

  if (error instanceof ExecutionSealedSplitRequiresWholePacksError) {
    return new ApiError(422, 'SEALED_SPLIT_REQUIRES_WHOLE_PACKS', 'Sealed packaged inventory can only be split on whole-pack boundaries.');
  }

  if (error instanceof ExecutionTargetContainerNotFoundError) {
    return new ApiError(404, 'TARGET_CONTAINER_NOT_FOUND', 'Target container was not found.');
  }

  if (error instanceof ExecutionTargetContainerTenantMismatchError) {
    return new ApiError(409, 'TARGET_CONTAINER_TENANT_MISMATCH', 'Target container belongs to a different tenant.');
  }

  if (error instanceof ExecutionTargetContainerSameAsSourceError) {
    return new ApiError(409, 'TARGET_CONTAINER_CONFLICT', 'Target container cannot be the same as the source container.');
  }

  if (error instanceof ExecutionContainerNotPlacedError) {
    return new ApiError(409, 'CONTAINER_LOCATION_UNSET', 'Source container does not have a current execution location.');
  }

  if (error instanceof ExecutionContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', 'Source container was not found.');
  }

  return null;
}

export function mapExecutionSwapError(error: unknown): ApiError | null {
  if (error instanceof ExecutionContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', 'Source container was not found.');
  }

  if (error instanceof ExecutionTargetContainerNotFoundError) {
    return new ApiError(404, 'TARGET_CONTAINER_NOT_FOUND', 'Target container was not found.');
  }

  if (error instanceof ExecutionTargetContainerSameAsSourceError) {
    return new ApiError(409, 'TARGET_CONTAINER_CONFLICT', 'Target container cannot be the same as the source container.');
  }

  if (error instanceof ExecutionTargetContainerTenantMismatchError) {
    return new ApiError(409, 'TARGET_CONTAINER_TENANT_MISMATCH', 'Target container belongs to a different tenant.');
  }

  if (error instanceof ExecutionContainerNotPlacedError) {
    return new ApiError(409, 'CONTAINER_LOCATION_UNSET', 'Source container is not currently placed.');
  }

  if (error instanceof ExecutionTargetContainerNotPlacedError) {
    return new ApiError(409, 'TARGET_CONTAINER_LOCATION_UNSET', 'Target container is not currently placed.');
  }

  if (error instanceof ExecutionTargetLocationSameAsSourceError) {
    return new ApiError(409, 'SAME_LOCATION', 'Source and target containers are already in the same location.');
  }

  if (error instanceof ExecutionSourceLocationNotExactlyOneContainerError) {
    return new ApiError(409, 'SOURCE_LOCATION_NOT_EXACTLY_ONE_CONTAINER', 'Source location must contain exactly one active container.');
  }

  if (error instanceof ExecutionTargetLocationEmptyError) {
    return new ApiError(409, 'TARGET_LOCATION_EMPTY', 'Target location is empty; use Move instead of Swap.');
  }

  if (error instanceof ExecutionTargetLocationNotExactlyOneContainerError) {
    return new ApiError(409, 'TARGET_LOCATION_NOT_EXACTLY_ONE_CONTAINER', 'Target location must contain exactly one active container.');
  }

  if (error instanceof ExecutionTargetLocationOccupantMismatchError) {
    return new ApiError(409, 'TARGET_LOCATION_OCCUPANT_MISMATCH', 'Target location contents changed. Select the target again.');
  }

  return (
    mapExecutionLocationMoveError(error) ??
    mapExecutionTransferError(error)
  );
}
