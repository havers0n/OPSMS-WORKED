export class ContainerNotFoundError extends Error {
  constructor() {
    super('Container was not found.');
  }
}

export class LocationOccupiedError extends Error {
  constructor() {
    super('Target cell is already occupied by another container.');
  }
}

export class LocationNotActiveError extends Error {
  constructor() {
    super('Target cell is not currently available for placement.');
  }
}

export class LocationNotFoundError extends Error {
  constructor() {
    super('Location was not found.');
  }
}
