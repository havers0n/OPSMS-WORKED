import { ApiError } from '../../errors.js';

export class PickTaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Pick task ${taskId} was not found.`);
  }
}

export function mapPickingError(error: unknown): ApiError | null {
  if (error instanceof PickTaskNotFoundError) {
    return new ApiError(404, 'PICK_TASK_NOT_FOUND', error.message);
  }
  return null;
}
