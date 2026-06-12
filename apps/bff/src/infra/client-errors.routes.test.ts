import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { ApiError, sendApiError } from '../errors.js';
import { registerClientErrorsRoutes } from './client-errors.routes.js';

describe('client error routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a valid client runtime error report with the existing success response', async () => {
    const app = Fastify({ logger: false });
    registerClientErrorsRoutes(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/client-errors',
      payload: {
        clientErrorId: '6f7ed8b1-6c91-4c08-b68c-55f9b5d79235',
        source: 'window-error',
        message: 'Storage page crashed on mobile',
        stack: 'Error: Storage page crashed on mobile',
        componentStack: null,
        route: '/warehouse/view?debug=1',
        url: 'https://example.com/warehouse/view?debug=1',
        userAgent: 'Mozilla/5.0 (iPhone)',
        occurredAt: '2026-06-07T12:00:00.000Z',
        viewport: {
          width: 390,
          height: 844,
          pixelRatio: 3
        },
        context: {
          viewMode: 'storage'
        }
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      accepted: true,
      requestId: expect.any(String)
    });

    await app.close();
  });

  it('returns the existing validation error for an invalid body', async () => {
    const app = Fastify({ logger: false });
    app.setErrorHandler((error, request, reply) => {
      const apiError =
        error instanceof ZodError
          ? new ApiError(400, 'VALIDATION_ERROR', error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
          : new ApiError(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Unexpected BFF error');

      void sendApiError(reply, apiError, request.id);
    });
    registerClientErrorsRoutes(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/client-errors',
      payload: {
        source: 'window-error',
        message: ''
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR'
    });

    await app.close();
  });

  it('invokes request logging with the existing payload and message', async () => {
    const errorSpy = vi.fn();
    const app = Fastify({ logger: false });

    app.addHook('onRequest', async (request) => {
      (request.log as unknown as { error: typeof errorSpy }).error = errorSpy;
    });

    registerClientErrorsRoutes(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/client-errors',
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone)',
        'x-forwarded-for': '203.0.113.9'
      },
      payload: {
        clientErrorId: '6f7ed8b1-6c91-4c08-b68c-55f9b5d79235',
        source: 'window-error',
        message: 'Storage page crashed on mobile',
        stack: 'Error: Storage page crashed on mobile',
        componentStack: null,
        route: '/warehouse/view?debug=1',
        url: 'https://example.com/warehouse/view?debug=1',
        userAgent: 'Mozilla/5.0 (iPhone)',
        occurredAt: '2026-06-07T12:00:00.000Z',
        viewport: {
          width: 390,
          height: 844,
          pixelRatio: 3
        },
        context: {
          viewMode: 'storage'
        }
      }
    });

    expect(response.statusCode).toBe(202);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      {
        clientErrorId: '6f7ed8b1-6c91-4c08-b68c-55f9b5d79235',
        source: 'window-error',
        route: '/warehouse/view?debug=1',
        message: 'Storage page crashed on mobile',
        stack: 'Error: Storage page crashed on mobile',
        componentStack: null,
        context: {
          viewMode: 'storage'
        },
        url: 'https://example.com/warehouse/view?debug=1',
        viewport: {
          width: 390,
          height: 844,
          pixelRatio: 3
        },
        reportedUserAgent: 'Mozilla/5.0 (iPhone)',
        requestUserAgent: 'Mozilla/5.0 (iPhone)',
        forwardedFor: '203.0.113.9'
      },
      'client runtime error reported'
    );

    await app.close();
  });
});
