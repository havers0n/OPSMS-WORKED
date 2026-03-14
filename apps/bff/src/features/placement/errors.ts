export class ContainerNotFoundError extends Error {
  constructor() {
    super('Container was not found.');
  }
}

export class PublishedLayoutNotFoundError extends Error {
  constructor() {
    super('Placement is allowed only against a published structure.');
  }
}

export class TargetCellNotFoundError extends Error {
  constructor() {
    super('Target cell was not found.');
  }
}

export class ContainerAlreadyPlacedError extends Error {
  constructor() {
    super('Container is already actively placed.');
  }
}

export class ActivePlacementNotFoundError extends Error {
  constructor() {
    super('Container has no active placement.');
  }
}

export class PlacementSourceMismatchError extends Error {
  constructor() {
    super('Active placement does not match the requested source cell.');
  }
}

export class TargetCellSameAsSourceError extends Error {
  constructor() {
    super('Target cell must differ from the current source cell.');
  }
}

export class CrossFloorPlacementMoveNotAllowedError extends Error {
  constructor() {
    super('Container moves must stay within the same floor.');
  }
}
