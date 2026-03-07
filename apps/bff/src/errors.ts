import { randomUUID } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import { errorResponseSchema } from './schemas.js';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function isSupabaseLikeError(error: unknown): error is SupabaseLikeError {
  return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
}

export function mapSupabaseError(error: unknown) {
  if (!isSupabaseLikeError(error)) {
    return null;
  }

  switch (error.code) {
    case '23505':
      return new ApiError(409, 'CONFLICT', 'Resource already exists.');
    case '23503':
      return new ApiError(409, 'CONSTRAINT_VIOLATION', 'Referenced resource does not exist or cannot be changed.');
    case '42501':
      return new ApiError(403, 'FORBIDDEN', 'You do not have access to this resource.');
    case 'PGRST116':
      return new ApiError(404, 'NOT_FOUND', 'Requested resource was not found.');
    default:
      return new ApiError(502, 'SUPABASE_ERROR', error.message ?? 'Supabase request failed.');
  }
}

export function sendApiError(reply: FastifyReply, apiError: ApiError, requestId: string) {
  const body = errorResponseSchema.parse({
    code: apiError.code,
    message: apiError.message,
    requestId,
    errorId: randomUUID()
  });

  return reply.header('x-request-id', requestId).code(apiError.statusCode).send(body);
}
