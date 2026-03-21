import { ApiError } from '../../errors.js';

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

export function mapPlacementError(error: unknown): ApiError | null {
  if (error instanceof ContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', error.message);
  }

  if (error instanceof LocationNotFoundError) {
    return new ApiError(404, 'LOCATION_NOT_FOUND', error.message);
  }

  if (error instanceof LocationOccupiedError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', error.message);
  }

  if (error instanceof LocationNotActiveError) {
    return new ApiError(409, 'LOCATION_NOT_WRITABLE', error.message);
  }

  return null;
}
