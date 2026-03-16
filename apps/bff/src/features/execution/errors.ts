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
