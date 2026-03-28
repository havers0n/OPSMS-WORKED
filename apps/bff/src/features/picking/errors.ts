import { ApiError } from '../../errors.js';

export class PickTaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Pick task ${taskId} was not found.`);
  }
}

export class PickStepNotFoundError extends Error {
  constructor(stepId: string) {
    super(`Pick step ${stepId} was not found.`);
  }
}

export class PickStepNotExecutableError extends Error {
  constructor(stepId: string, reason: string) {
    super(`Pick step ${stepId} is not executable: ${reason}.`);
  }
}

export class InvalidPickQuantityError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function mapPickingError(error: unknown): ApiError | null {
  if (error instanceof PickTaskNotFoundError) {
    return new ApiError(404, 'PICK_TASK_NOT_FOUND', error.message);
  }
  if (error instanceof PickStepNotFoundError) {
    return new ApiError(404, 'PICK_STEP_NOT_FOUND', error.message);
  }
  if (error instanceof PickStepNotExecutableError) {
    return new ApiError(409, 'PICK_STEP_NOT_EXECUTABLE', error.message);
  }
  if (error instanceof InvalidPickQuantityError) {
    return new ApiError(422, 'INVALID_PICK_QUANTITY', error.message);
  }
  return null;
}
