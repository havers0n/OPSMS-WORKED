import type { FastifyInstance } from 'fastify';
import {
  clientErrorReportRequestBodySchema,
  clientErrorReportResponseSchema
} from '../schemas.js';
import { parseOrThrow } from '../validation.js';

export function registerClientErrorsRoutes(app: FastifyInstance): void {
  app.post('/api/client-errors', async (request, reply) => {
    const body = parseOrThrow(clientErrorReportRequestBodySchema, request.body);

    if ('kind' in body && body.kind === 'canvas-lifecycle-snapshot') {
      request.log.info(
        {
          snapshot: body.snapshot,
          requestUserAgent: request.headers['user-agent'],
          forwardedFor: request.headers['x-forwarded-for']
        },
        'client runtime canvas snapshot reported'
      );
    } else {
      const error = 'kind' in body && body.kind === 'error' ? body.error : body;

      request.log.error(
        {
          clientErrorId: error.clientErrorId,
          source: error.source,
          route: error.route,
          message: error.message,
          stack: error.stack,
          componentStack: error.componentStack,
          context: error.context,
          url: error.url,
          viewport: error.viewport,
          reportedUserAgent: error.userAgent,
          requestUserAgent: request.headers['user-agent'],
          forwardedFor: request.headers['x-forwarded-for']
        },
        'client runtime error reported'
      );
    }

    return reply.code(202).send(
      parseOrThrow(clientErrorReportResponseSchema, {
        accepted: true,
        requestId: request.id
      })
    );
  });
}
